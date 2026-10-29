import { getDataBackend } from "@/lib/data-backend";
import { queryPostgres } from "@/lib/postgres/client";
import {
  buildDayBook,
  type AccountLineRow,
  type ChequeStateRow,
  type DayBookRow,
  type PosBillRow,
  type PurchaseBillRow,
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

  const [bills, purchases, customerLines, supplierLines, wages, cheques] = await Promise.all([
    queryPostgres<PosBillRow>(
      STORE,
      `SELECT id, invoice_number, created_at, kind, status, customer_name, payment_method,
              total, paid_amount, credit_amount, payments, ledger_transaction_id
         FROM pos_invoices WHERE ${DAY_RANGE("created_at")}
        LIMIT ${DAY_CEILING}`,
      [day],
    ),
    queryPostgres<PurchaseBillRow>(
      STORE,
      `SELECT id, purchase_number, created_at, supplier_name, total, paid_amount, credit_amount,
              payment_method, supplier_transaction_ids
         FROM purchase_invoices WHERE ${DAY_RANGE("created_at")}
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

  return buildDayBook({
    bills,
    purchases,
    customerLines,
    supplierLines,
    wages,
    cheques,
    billLedgerLineIds: customerLines.filter((line) => line.written_by_bill).map((line) => line.id),
    purchaseSupplierLineIds: supplierLines.filter((line) => line.written_by_bill).map((line) => line.id),
  });
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
