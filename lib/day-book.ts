import { getDataBackend } from "@/lib/data-backend";
import { queryPostgres } from "@/lib/postgres/client";
import { shopPaymentsReady, twoBusinessReady } from "@/lib/two-business";
import {
  buildDayBook,
  type AccountLineRow,
  type ChequeStateRow,
  type DayBookRow,
  type PosBillRow,
  fifoFactoryShares,
  purchaseFactoryShare,
  type PurchaseBillRow,
  type ShopPaymentRow,
  type WagePaymentRow,
} from "@/lib/day-book-rules";

const STORE = "day book";

/**
 * One Nepal day as a timestamp range, so the created_at indexes are used —
 * a cast of the column to a date would read every row ever written.
 */
const DAY_RANGE = (column: string) =>
  `${column} >= ($1::date::timestamp AT TIME ZONE 'Asia/Kathmandu') AND ${column} < (($1::date + 1)::timestamp AT TIME ZONE 'Asia/Kathmandu')`;

/**
 * More lines than one shop writes in a day by far; a ceiling so a mistaken
 * range can never hand back the whole history (tests/query-limits.test.ts).
 */
const DAY_CEILING = 5000;

type Flagged<T> = T & { written_by_bill: boolean };

/** Every line of one day, read in parallel; null where the books are not in Postgres. */
export async function getDayBook(day: string): Promise<DayBookRow[] | null> {
  if (getDataBackend() !== "postgres") return null;
  // Whose each line is, once the factory and the shop are two businesses
  // (owner, 2026-10-31, part four).
  const twoBusinesses = await twoBusinessReady().catch(() => false);

  const [bills, purchases, customerLines, supplierLines, wages, cheques] = await Promise.all([
    queryPostgres<PosBillRow>(
      STORE,
      `SELECT id, invoice_number, created_at, kind, status, customer_name, payment_method,
              total, paid_amount, credit_amount, payments, ledger_transaction_id${twoBusinesses ? ", business" : ""}
         FROM pos_invoices WHERE ${DAY_RANGE("created_at")}
        LIMIT ${DAY_CEILING}`,
      [day],
    ),
    queryPostgres<PurchaseBillRow>(
      STORE,
      `SELECT p.id, p.purchase_number, p.created_at, p.supplier_name, p.total, p.paid_amount, p.credit_amount,
              p.payment_method, p.supplier_transaction_ids,
              (SELECT COALESCE(SUM(i.line_total), 0) FROM purchase_invoice_items i WHERE i.purchase_invoice_id = p.id AND i.kind = 'Raw Material') AS raw_value,
              (SELECT COALESCE(SUM(i.line_total), 0) FROM purchase_invoice_items i WHERE i.purchase_invoice_id = p.id AND i.kind = 'Trading Goods') AS trading_value
         FROM purchase_invoices p WHERE ${DAY_RANGE("p.created_at")}
        LIMIT ${DAY_CEILING}`,
      [day],
    ),
    queryPostgres<Flagged<AccountLineRow>>(
      STORE,
      `SELECT t.id, t.created_at, t.ledger_id AS account_id, t.customer_name AS name, t.type, t.amount, t.note,
              EXISTS (SELECT 1 FROM pos_invoices p WHERE p.ledger_transaction_id = t.id) AS written_by_bill
         FROM ledger_transactions t
        WHERE t.reversed_at IS NULL AND ${DAY_RANGE("t.created_at")}
        LIMIT ${DAY_CEILING}`,
      [day],
    ),
    queryPostgres<Flagged<AccountLineRow>>(
      STORE,
      `SELECT t.id, t.created_at, t.supplier_ledger_id AS account_id, t.supplier_name AS name, t.type, t.amount, t.note,
              EXISTS (SELECT 1 FROM purchase_invoices p WHERE t.id = ANY (p.supplier_transaction_ids)) AS written_by_bill
         FROM supplier_transactions t
        WHERE ${DAY_RANGE("t.created_at")}
        LIMIT ${DAY_CEILING}`,
      [day],
    ),
    // A wage is the day it was paid — the Saturday — whenever it was typed.
    queryPostgres<WagePaymentRow>(
      STORE,
      `SELECT id, created_at, employee_id, employee_name_snapshot, payment_type, direction, amount, payment_method
         FROM worker_payments
        WHERE reversed_at IS NULL AND payment_date = $1::date
        LIMIT ${DAY_CEILING}`,
      [day],
    ),
    // The cheque book is a later table; a database without it has no bounced cheques.
    queryPostgres<ChequeStateRow>(
      STORE,
      "SELECT source, source_id, state FROM cheques WHERE state = 'bounced'",
    ).catch((error: { code?: string }) => {
      if (error?.code === "42P01") return [];
      throw error;
    }),
  ]);

  const shares = twoBusinesses ? await businessShares(day, customerLines, supplierLines) : {};

  return buildDayBook({
    bills,
    purchases,
    customerLines,
    supplierLines,
    wages,
    cheques,
    billLedgerLineIds: customerLines.filter((line) => line.written_by_bill).map((line) => line.id),
    purchaseSupplierLineIds: supplierLines.filter((line) => line.written_by_bill).map((line) => line.id),
    ...shares,
  });
}

/**
 * Whose money each of the day's account lines is (owner, 2026-10-31): a
 * customer's payment by the bills it paid, oldest first (choice 2(क)); a
 * supplier's by what was bought from them, raw material the factory's
 * (choice 1(क)); and what the shop paid the factory that day.
 */
async function businessShares(
  day: string,
  customerLines: Array<AccountLineRow & { written_by_bill: boolean }>,
  supplierLines: Array<AccountLineRow & { written_by_bill: boolean }>,
) {
  const paidAccounts = [...new Set(customerLines.map((line) => line.account_id).filter(Boolean))];
  const suppliers = [...new Set(supplierLines.map((line) => line.account_id).filter(Boolean))];
  const [credits, payments, bought, shopPayments] = await Promise.all([
    paidAccounts.length
      ? queryPostgres<{ ledger_id: string; created_at: string; credit_amount: number | string; business: string }>(
          STORE,
          `SELECT ledger_id, created_at, credit_amount, business FROM pos_invoices
            WHERE ledger_id = ANY($1) AND kind = 'Sale' AND status <> 'Voided' AND credit_amount > 0
            LIMIT ${DAY_CEILING}`,
          [paidAccounts],
        )
      : Promise.resolve([]),
    paidAccounts.length
      ? queryPostgres<{ id: string; ledger_id: string; created_at: string; amount: number | string }>(
          STORE,
          `SELECT id, ledger_id, created_at, amount FROM ledger_transactions
            WHERE ledger_id = ANY($1) AND reversed_at IS NULL AND type IN ('Cash Payment', 'Cheque Payment', 'Return Adjustment')
            LIMIT ${DAY_CEILING}`,
          [paidAccounts],
        )
      : Promise.resolve([]),
    suppliers.length
      ? queryPostgres<{ supplier_ledger_id: string; raw_value: number | string; trading_value: number | string }>(
          STORE,
          `SELECT p.supplier_ledger_id,
                  COALESCE(SUM(i.line_total) FILTER (WHERE i.kind = 'Raw Material'), 0) AS raw_value,
                  COALESCE(SUM(i.line_total) FILTER (WHERE i.kind = 'Trading Goods'), 0) AS trading_value
             FROM purchase_invoice_items i JOIN purchase_invoices p ON p.id = i.purchase_invoice_id
            WHERE p.supplier_ledger_id = ANY($1)
            GROUP BY p.supplier_ledger_id`,
          [suppliers],
        )
      : Promise.resolve([]),
    (await shopPaymentsReady().catch(() => false))
      ? queryPostgres<ShopPaymentRow>(
          STORE,
          `SELECT id, created_at, amount, method, note FROM shop_factory_payments
            WHERE removed_at IS NULL AND paid_on = $1::date LIMIT ${DAY_CEILING}`,
          [day],
        )
      : Promise.resolve([] as ShopPaymentRow[]),
  ]);

  const customerShares: Record<string, number> = {};
  for (const account of paidAccounts) {
    Object.assign(
      customerShares,
      fifoFactoryShares(
        credits
          .filter((credit) => credit.ledger_id === account)
          .map((credit) => ({ at: String(credit.created_at), factory: credit.business === "factory", amount: Number(credit.credit_amount) || 0 })),
        payments
          .filter((payment) => payment.ledger_id === account)
          .map((payment) => ({ id: payment.id, at: String(payment.created_at), amount: Number(payment.amount) || 0 })),
      ),
    );
  }
  const supplierShares = Object.fromEntries(
    bought.map((row) => [row.supplier_ledger_id, purchaseFactoryShare(Number(row.raw_value) || 0, Number(row.trading_value) || 0)]),
  );
  return { customerShares, supplierShares, shopPayments };
}

export type PartyRow = {
  id: string;
  side: "customer" | "supplier";
  name: string;
  phone: string;
  /** What is owed on the account: by the customer, or to the supplier. */
  due: number;
};

/** Every customer and supplier account, for the money forms and the party search. */
export async function getParties(): Promise<PartyRow[] | null> {
  if (getDataBackend() !== "postgres") return null;
  const [customers, suppliers] = await Promise.all([
    queryPostgres<{ id: string; name: string; phone: string | null; due: string | number }>(
      STORE,
      "SELECT id, customer_name AS name, phone, balance_due AS due FROM customer_ledgers ORDER BY lower(customer_name)",
    ),
    queryPostgres<{ id: string; name: string; phone: string | null; due: string | number }>(
      STORE,
      "SELECT id, supplier_name AS name, phone, balance_due AS due FROM supplier_ledgers ORDER BY lower(supplier_name)",
    ),
  ]);
  const shape = (side: PartyRow["side"]) => (row: { id: string; name: string; phone: string | null; due: string | number }): PartyRow => ({
    id: row.id,
    side,
    name: row.name,
    phone: row.phone ?? "",
    due: Number(row.due) || 0,
  });
  return [...customers.map(shape("customer")), ...suppliers.map(shape("supplier"))];
}
