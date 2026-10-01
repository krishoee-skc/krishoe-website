import { randomUUID } from "node:crypto";
import {
  allowedActions,
  stateAfter,
  type Cheque,
  type ChequeAction,
  type ChequeBookState,
  type ChequeDirection,
  type ChequeSource,
} from "@/lib/cheque-book-rules";
import { chequeBookTableReady, setChequeState } from "@/lib/cheques";
import { getDataBackendConfig } from "@/lib/data-backend";
import { queryPostgres } from "@/lib/postgres/client";

/**
 * The cheque book (owner, 2026-10-01): every cheque taken on a counter bill or
 * given on a purchase bill, with its bank, number, date and what became of it.
 *
 * The table comes with the cheques' Owner button in Settings (lib/cheques.ts,
 * migration 20261001_cheques.sql). Until it is there, nothing here is written
 * and every read is empty — bills and purchases save exactly as before.
 *
 * A bill's cheque keeps pos_cheques in step, so the counter page's "Cheques to
 * clear" and anything else reading it say the same as this book.
 */

const STORE = "cheque book";

type ChequeRow = {
  id: string;
  direction: ChequeDirection;
  source: ChequeSource;
  source_id: string;
  source_number: string;
  party_name: string;
  party_phone: string;
  bank: string;
  cheque_no: string;
  amount: string | number;
  cheque_date: string | Date | null;
  name_on_cheque: string;
  state: ChequeBookState;
  deposited_on: string | Date | null;
  cleared_on: string | Date | null;
  bounced_on: string | Date | null;
  bounce_reason: string;
  bank_charge: string | number;
  note: string;
  created_at: string | Date;
  created_by: string;
};

/** A date column as a day key. pg gives a DATE back as a local-midnight Date. */
function dayKey(value: string | Date | null) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromRow(row: ChequeRow): Cheque {
  return {
    id: row.id,
    direction: row.direction,
    source: row.source,
    sourceId: row.source_id,
    sourceNumber: row.source_number ?? "",
    partyName: row.party_name ?? "",
    partyPhone: row.party_phone ?? "",
    bank: row.bank ?? "",
    chequeNo: row.cheque_no ?? "",
    amount: Number(row.amount) || 0,
    chequeDate: dayKey(row.cheque_date),
    nameOnCheque: row.name_on_cheque ?? "",
    state: row.state,
    depositedOn: dayKey(row.deposited_on),
    clearedOn: dayKey(row.cleared_on),
    bouncedOn: dayKey(row.bounced_on),
    bounceReason: row.bounce_reason ?? "",
    bankCharge: Number(row.bank_charge) || 0,
    note: row.note ?? "",
    createdAt: new Date(row.created_at).toISOString(),
    createdBy: row.created_by ?? "",
  };
}

/** Whether the cheque book's table is there. */
export async function chequeBookReady() {
  if (getDataBackendConfig().backend !== "postgres") return false;
  return chequeBookTableReady().catch(() => false);
}

/** Every cheque, newest first, bounded. Empty until the table is there. */
export async function getCheques(): Promise<Cheque[]> {
  if (!(await chequeBookReady())) return [];
  const rows = await queryPostgres<ChequeRow>(
    STORE,
    `SELECT * FROM cheques ORDER BY created_at DESC LIMIT 1000`,
  );
  return rows.map(fromRow);
}

export async function getCheque(id: string): Promise<Cheque | null> {
  if (!(await chequeBookReady())) return null;
  const rows = await queryPostgres<ChequeRow>(STORE, `SELECT * FROM cheques WHERE id = $1`, [id]);
  return rows[0] ? fromRow(rows[0]) : null;
}

/** Banks cheques have come from or been written on, most used first — for the picker. */
export async function getUsedBanks(direction: ChequeDirection): Promise<string[]> {
  if (!(await chequeBookReady())) return [];
  const rows = await queryPostgres<{ bank: string }>(
    STORE,
    `SELECT bank FROM cheques WHERE direction = $1 AND bank <> ''
      GROUP BY bank ORDER BY COUNT(*) DESC, MAX(created_at) DESC LIMIT 8`,
    [direction],
  );
  return rows.map((row) => row.bank);
}

export type NewCheque = {
  direction: ChequeDirection;
  source: ChequeSource;
  sourceId: string;
  sourceNumber: string;
  partyName: string;
  partyPhone: string;
  bank: string;
  chequeNo: string;
  amount: number;
  chequeDate: string;
  nameOnCheque: string;
  state?: ChequeBookState;
  by: string;
};

const clip = (value: string, length: number) => String(value ?? "").trim().slice(0, length);

/**
 * Files a cheque. One per bill or purchase: a second save of the same one
 * (a retried press) changes nothing.
 */
export async function addCheque(input: NewCheque) {
  if (!(await chequeBookReady())) return null;
  if (!(input.amount > 0)) return null;
  const id = `CHQ-${randomUUID()}`;
  const sourceId = input.source === "manual" ? id : input.sourceId;
  const chequeDate = /^\d{4}-\d{2}-\d{2}$/.test(input.chequeDate) ? input.chequeDate : null;
  const rows = await queryPostgres<ChequeRow>(
    STORE,
    `INSERT INTO cheques
       (id, direction, source, source_id, source_number, party_name, party_phone, bank,
        cheque_no, amount, cheque_date, name_on_cheque, state, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
     ON CONFLICT (source, source_id) DO NOTHING
     RETURNING *`,
    [
      id,
      input.direction,
      input.source,
      sourceId,
      clip(input.sourceNumber, 60),
      clip(input.partyName, 120),
      clip(input.partyPhone, 30),
      clip(input.bank, 80),
      clip(input.chequeNo, 40),
      Math.round(input.amount * 100) / 100,
      chequeDate,
      clip(input.nameOnCheque, 120),
      input.state ?? "waiting",
      clip(input.by, 80),
    ],
  );
  return rows[0] ? fromRow(rows[0]) : null;
}

/** Corrects a cheque's own details — the bank, the number, the date, the name. */
export async function editChequeDetails(
  id: string,
  details: { bank: string; chequeNo: string; chequeDate: string; nameOnCheque: string; partyPhone: string },
  by: string,
) {
  if (!(await chequeBookReady())) throw new Error("The cheque book is not ready yet. Prepare it in Settings.");
  const chequeDate = /^\d{4}-\d{2}-\d{2}$/.test(details.chequeDate) ? details.chequeDate : null;
  await queryPostgres(
    STORE,
    `UPDATE cheques
        SET bank = $2, cheque_no = $3, cheque_date = $4, name_on_cheque = $5, party_phone = $6,
            updated_at = now(), updated_by = $7
      WHERE id = $1`,
    [
      id,
      clip(details.bank, 80),
      clip(details.chequeNo, 40),
      chequeDate,
      clip(details.nameOnCheque, 120),
      clip(details.partyPhone, 30),
      clip(by, 80),
    ],
  );
}

/**
 * Moves a cheque on: deposited, cleared, bounced (with the reason and the
 * bank's charge), collected after a bounce, or cancelled. Refuses a move the
 * cheque cannot make from where it stands.
 */
export async function moveCheque(
  id: string,
  action: ChequeAction,
  details: { onKey: string; reason?: string; bankCharge?: number; note?: string },
  by: string,
) {
  const cheque = await getCheque(id);
  if (!cheque) throw new Error("That cheque was not found.");
  if (!allowedActions(cheque).includes(action)) {
    throw new Error(`A cheque that is ${cheque.state} cannot be marked ${action}.`);
  }
  const state = stateAfter(action);
  const day = details.onKey;
  await queryPostgres(
    STORE,
    `UPDATE cheques
        SET state = $2,
            deposited_on = CASE WHEN $3 = 'deposit' THEN $4::date ELSE deposited_on END,
            cleared_on = CASE WHEN $3 = 'clear' THEN $4::date ELSE cleared_on END,
            bounced_on = CASE WHEN $3 = 'bounce' THEN $4::date ELSE bounced_on END,
            bounce_reason = CASE WHEN $3 = 'bounce' THEN $5 ELSE bounce_reason END,
            bank_charge = CASE WHEN $3 = 'bounce' THEN $6 ELSE bank_charge END,
            note = CASE WHEN $7 <> '' THEN $7 ELSE note END,
            updated_at = now(), updated_by = $8
      WHERE id = $1`,
    [
      id,
      state,
      action,
      day,
      clip(details.reason ?? "", 40),
      Math.max(0, Math.round((details.bankCharge ?? 0) * 100) / 100),
      clip(details.note ?? "", 200),
      clip(by, 80),
    ],
  );
  // The counter page reads pos_cheques; a bill's cheque says the same there.
  if (cheque.source === "bill" && (state === "cleared" || state === "bounced" || state === "recovered")) {
    await setChequeState(cheque.sourceId, state, by);
  }
  return { ...cheque, state };
}

/** A bill cancelled as a test takes its cheque out of the book with it. */
export async function cancelBillCheque(invoiceId: string, by: string) {
  if (!(await chequeBookReady())) return;
  await queryPostgres(
    STORE,
    `UPDATE cheques
        SET state = 'cancelled', note = 'The bill was cancelled as a test bill.', updated_at = now(), updated_by = $2
      WHERE source = 'bill' AND source_id = $1 AND state <> 'cancelled'`,
    [invoiceId, clip(by, 80)],
  );
}
