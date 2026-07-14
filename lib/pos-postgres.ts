import { queryPostgres, transactionPostgres, type PostgresExecutor } from "@/lib/postgres/client";
import type { PosInvoice, PosInvoicePostingPatch } from "@/lib/pos";
import type { LedgerTransaction, StockMovement } from "@/lib/operations";
import { insertLedgerTransaction, insertStockMovement } from "@/lib/operations-postgres";

type PosInvoiceRow = {
  id: string;
  invoice_number: string;
  created_at: Date | string;
  channel: PosInvoice["channel"];
  kind: PosInvoice["kind"];
  customer_name: string;
  phone: string;
  cashier: string;
  payment_method: PosInvoice["paymentMethod"];
  payment_reference: string;
  ledger_id: string | null;
  subtotal: number | string;
  discount: number | string;
  tax: number | string;
  total: number | string;
  paid_amount: number | string;
  credit_amount: number | string;
  status: PosInvoice["status"];
  posting_status: PosInvoice["postingStatus"];
  items: unknown;
  stock_movement_ids: string[] | null;
  ledger_transaction_id: string | null;
  barcode_value: string;
  qr_payload: string;
  note: string;
};

function cleanNumber(value: number | string) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function isoDate(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function posInvoiceFromRow(row: PosInvoiceRow): PosInvoice {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    createdAt: isoDate(row.created_at),
    channel: row.channel,
    kind: row.kind,
    customerName: row.customer_name,
    phone: row.phone,
    cashier: row.cashier,
    paymentMethod: row.payment_method,
    paymentReference: row.payment_reference,
    ledgerId: row.ledger_id ?? "",
    subtotal: cleanNumber(row.subtotal),
    discount: cleanNumber(row.discount),
    tax: cleanNumber(row.tax),
    total: cleanNumber(row.total),
    paidAmount: cleanNumber(row.paid_amount),
    creditAmount: cleanNumber(row.credit_amount),
    status: row.status,
    postingStatus: row.posting_status,
    items: Array.isArray(row.items) ? row.items as PosInvoice["items"] : [],
    stockMovementIds: Array.isArray(row.stock_movement_ids) ? row.stock_movement_ids : [],
    ledgerTransactionId: row.ledger_transaction_id ?? "",
    barcodeValue: row.barcode_value,
    qrPayload: row.qr_payload,
    note: row.note,
  };
}

const selectPosInvoiceColumns = `
  id,
  invoice_number,
  created_at,
  channel,
  kind,
  customer_name,
  phone,
  cashier,
  payment_method,
  payment_reference,
  ledger_id,
  subtotal,
  discount,
  tax,
  total,
  paid_amount,
  credit_amount,
  status,
  posting_status,
  items,
  stock_movement_ids,
  ledger_transaction_id,
  barcode_value,
  qr_payload,
  note
`;

export async function getPosInvoicesFromPostgres() {
  const rows = await queryPostgres<PosInvoiceRow>(
    "pos invoices",
    `SELECT ${selectPosInvoiceColumns} FROM pos_invoices ORDER BY created_at DESC`,
  );

  return rows.map(posInvoiceFromRow);
}

async function insertPosInvoiceRow(db: PostgresExecutor, invoice: PosInvoice) {
  const rows = await db.query<PosInvoiceRow>(
    `
      INSERT INTO pos_invoices (
        id,
        invoice_number,
        created_at,
        channel,
        kind,
        customer_name,
        phone,
        cashier,
        payment_method,
        payment_reference,
        ledger_id,
        subtotal,
        discount,
        tax,
        total,
        paid_amount,
        credit_amount,
        status,
        posting_status,
        items,
        stock_movement_ids,
        ledger_transaction_id,
        barcode_value,
        qr_payload,
        note
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19,
        $20::jsonb, $21, $22, $23, $24, $25
      )
      RETURNING ${selectPosInvoiceColumns}
    `,
    [
      invoice.id,
      invoice.invoiceNumber,
      new Date(invoice.createdAt),
      invoice.channel,
      invoice.kind,
      invoice.customerName,
      invoice.phone,
      invoice.cashier,
      invoice.paymentMethod,
      invoice.paymentReference,
      invoice.ledgerId || null,
      invoice.subtotal,
      invoice.discount,
      invoice.tax,
      invoice.total,
      invoice.paidAmount,
      invoice.creditAmount,
      invoice.status,
      invoice.postingStatus,
      JSON.stringify(invoice.items),
      invoice.stockMovementIds,
      invoice.ledgerTransactionId || null,
      invoice.barcodeValue,
      invoice.qrPayload,
      invoice.note,
    ],
  );

  return posInvoiceFromRow(rows[0]);
}

export async function savePosInvoiceToPostgres(invoice: PosInvoice) {
  return transactionPostgres("pos invoices", (db) => insertPosInvoiceRow(db, invoice));
}

// Post a POS sale/return atomically: stock movements, an optional credit
// ledger transaction, and the invoice row all commit together or not at all.
// This removes the half-posted-invoice window and, via each movement's
// SELECT ... FOR UPDATE, the concurrent-oversell race.
export async function createPosInvoicePostgres(params: {
  invoice: PosInvoice;
  stockMovements: Array<Omit<StockMovement, "id" | "createdAt">>;
  ledgerTransaction?: Omit<LedgerTransaction, "id" | "createdAt" | "customerName"> | null;
}) {
  return transactionPostgres("pos invoices", async (db) => {
    const stockMovementIds: string[] = [];

    for (const movement of params.stockMovements) {
      const created = await insertStockMovement(db, movement);
      stockMovementIds.push(created.id);
    }

    let ledgerTransactionId = "";

    if (params.ledgerTransaction) {
      const created = await insertLedgerTransaction(db, params.ledgerTransaction);
      ledgerTransactionId = created.id;
    }

    return insertPosInvoiceRow(db, {
      ...params.invoice,
      stockMovementIds,
      ledgerTransactionId,
      postingStatus: "Posted",
    });
  });
}

export async function updatePosInvoicePostingToPostgres(
  id: string,
  patch: PosInvoicePostingPatch,
) {
  const rows = await queryPostgres<PosInvoiceRow>(
    "pos invoices",
    `
      UPDATE pos_invoices
      SET stock_movement_ids = $2,
        ledger_transaction_id = $3,
        posting_status = $4
      WHERE id = $1
      RETURNING ${selectPosInvoiceColumns}
    `,
    [
      id,
      patch.stockMovementIds,
      patch.ledgerTransactionId || null,
      patch.postingStatus,
    ],
  );

  if (!rows[0]) {
    throw new Error("POS invoice was not found.");
  }

  return posInvoiceFromRow(rows[0]);
}
