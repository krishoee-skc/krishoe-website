import { getDataBackendConfig } from "@/lib/data-backend";
import { queryPostgres } from "@/lib/postgres/client";
import type { OperationRecordKind } from "@/lib/operations";

const STORE = "operations";

/**
 * What stays when an Operations record is removed (owner, 2026-10-20, audit 5).
 *
 * A customer's account went with every line on it (the lines cascade), and a
 * stock movement or production batch went with only a one-line note in an
 * audit log that kept 500 lines. Now an account with any line on it is not
 * removed at all — its lines are taken back one by one, and they stay — and a
 * movement or batch is removed only by the Owner, with a reason, and a full
 * copy of what it was goes into the audit log, which keeps every line.
 *
 * Removing a movement still undoes its pairs exactly, as before: a made-up
 * "opposite" movement would have to know how each type moves sold, returned
 * and placed pairs, and one wrong rule would put the stock off.
 */
export { PROOF_KINDS, REASON_MIN } from "@/lib/operation-record-rules";

/** Lines on a customer's account, taken-back ones included. */
export async function customerLedgerLineCount(ledgerId: string): Promise<number> {
  if (getDataBackendConfig().backend !== "postgres") return 0;
  const rows = await queryPostgres<{ n: number }>(
    STORE,
    `SELECT count(*)::integer AS n FROM ledger_transactions WHERE ledger_id = $1`,
    [ledgerId],
  );
  return Number(rows[0]?.n) || 0;
}

/** The whole record as it stands, for the audit log; null when it is not there. */
export async function operationRecordSnapshot(kind: OperationRecordKind, id: string): Promise<unknown> {
  if (getDataBackendConfig().backend !== "postgres") return null;
  if (kind === "stockMovement") {
    const rows = await queryPostgres<{ row: unknown }>(
      STORE,
      `SELECT to_jsonb(m) AS row FROM stock_movements m WHERE id = $1`,
      [id],
    );
    return rows[0]?.row ?? null;
  }
  if (kind === "productionBatch") {
    const rows = await queryPostgres<{ row: unknown; consumptions: unknown }>(
      STORE,
      `SELECT to_jsonb(b) AS row,
              COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM material_consumptions c WHERE c.batch_id = b.id), '[]'::jsonb) AS consumptions
         FROM production_batches b WHERE id = $1`,
      [id],
    );
    return rows[0] ? { batch: rows[0].row, consumptions: rows[0].consumptions } : null;
  }
  return null;
}
