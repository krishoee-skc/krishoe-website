import { getDataBackendConfig } from "@/lib/data-backend";
import type { BusinessChannel, StockMovementType } from "@/lib/operations";
import { insertStockMovement, undoCancelledSaleCounts } from "@/lib/operations-postgres";
import { CANCEL_NOTE } from "@/lib/cancelled-bills";
import { transactionPostgres } from "@/lib/postgres/client";
import { readPaymentParts } from "@/lib/pos-payments";

/**
 * Cancelling a test bill (owner, 2026-10-01: bills cut to try the counter —
 * "sample 2", "costomer 3", a Rs. 10,500 cheque from nobody — sat in the sales
 * and the cheque list as if real).
 *
 * A Return was the only way back, and a return must go to a customer's
 * account: it would have left a made-up customer owed Rs. 10,500 and the bill
 * itself still Paid. Cancelling instead puts back exactly the pairs the bill
 * took — a "Return In" mirroring each of its own stock movements, same design,
 * same pile, same pairs — and marks the bill Voided, which every report,
 * total, list and the cheque book already leave out. Nothing is deleted: the
 * bill stays, marked, with the reason.
 *
 * Only a plain sale: not a return, not one half of an exchange, not a bill
 * with anything on a customer's account (credit, old credit paid on it) — those
 * move money between accounts that a cancel here would not move back.
 */

export type VoidRefusal = { en: string; ne: string };

type BillRow = {
  id: string;
  invoice_number: string;
  kind: string;
  status: string;
  credit_amount: string | number;
  ledger_transaction_id: string | null;
  stock_movement_ids: string[] | null;
  note: string;
  payments?: unknown;
};

type MoveRow = { id: string; design: string; channel: string; size_run: string; type: string; pairs: string | number };

/** Why a bill cannot be cancelled as a test, or null when it can. */
export function voidRefusal(bill: {
  kind: string;
  status: string;
  creditAmount: number;
  ledgerTransactionId: string;
  payments: Array<{ method: string; purpose: string }>;
}): VoidRefusal | null {
  if (bill.kind !== "Sale") return { en: "Only a sale can be cancelled as a test.", ne: "बिक्री बिल मात्र परीक्षण भनेर रद्द गर्न मिल्छ।" };
  if (bill.status === "Voided") return { en: "This bill is already cancelled.", ne: "यो बिल पहिल्यै रद्द भइसक्यो।" };
  if (bill.status === "Returned") return { en: "This bill was returned.", ne: "यो बिल फिर्ता भइसकेको छ।" };
  if (bill.creditAmount > 0 || bill.ledgerTransactionId) {
    return { en: "Part of this bill is on a customer's account — it cannot be cancelled here.", ne: "यो बिलको केही रकम ग्राहकको खातामा छ — यहाँबाट रद्द गर्न मिल्दैन।" };
  }
  if (bill.payments.some((part) => part.method === "Exchange" || part.purpose !== "bill")) {
    return { en: "This bill is part of an exchange or paid old credit — it cannot be cancelled here.", ne: "यो बिल साटफेर वा पुरानो उधारोसँग जोडिएको छ — यहाँबाट रद्द गर्न मिल्दैन।" };
  }
  return null;
}

export class VoidRefused extends Error {
  constructor(public readonly words: VoidRefusal) {
    super(words.en);
  }
}

/**
 * Cancels a test bill in one transaction: the bill locked, its own Sale Out
 * movements read back and mirrored as Return In, the bill marked Voided with
 * the reason. All or nothing.
 */
export async function voidTestBill(invoiceId: string, reason: string, by: string) {
  if (getDataBackendConfig().backend !== "postgres") {
    throw new VoidRefused({ en: "Bills can be cancelled on the live database only.", ne: "बिल लाइभ database मा मात्र रद्द गर्न मिल्छ।" });
  }
  const why = reason.trim().slice(0, 160);
  if (!why) throw new VoidRefused({ en: "Write why it is cancelled.", ne: "किन रद्द गरेको, लेख्नुहोस्।" });

  return transactionPostgres("pos invoices", async (db) => {
    const bill = (await db.query<BillRow>(`SELECT * FROM pos_invoices WHERE id = $1 FOR UPDATE`, [invoiceId]))[0];
    if (!bill) throw new VoidRefused({ en: "That bill was not found.", ne: "त्यो बिल भेटिएन।" });

    const refusal = voidRefusal({
      kind: bill.kind,
      status: bill.status,
      creditAmount: Number(bill.credit_amount) || 0,
      ledgerTransactionId: bill.ledger_transaction_id ?? "",
      payments: readPaymentParts(bill.payments),
    });
    if (refusal) throw new VoidRefused(refusal);

    const ids = bill.stock_movement_ids ?? [];
    const moves = ids.length
      ? await db.query<MoveRow>(`SELECT id, design, channel, size_run, type, pairs FROM stock_movements WHERE id = ANY($1) LIMIT 500`, [ids])
      : [];
    if (moves.length !== ids.length || moves.some((move) => move.type !== "Sale Out")) {
      throw new VoidRefused({
        en: "This bill's stock records do not match it — it was not cancelled. Ask for help.",
        ne: "यो बिलको स्टकको रेकर्ड मिलेन — रद्द गरिएन। सहयोग माग्नुहोस्।",
      });
    }

    for (const move of moves) {
      const back = {
        design: move.design,
        channel: move.channel as BusinessChannel,
        sizeRun: move.size_run,
        pairs: Number(move.pairs) || 0,
      };
      await insertStockMovement(db, { ...back, type: "Return In" as StockMovementType, note: `${bill.invoice_number} ${CANCEL_NOTE}` });
      // Not sold, and not returned either (owner, 2026-10-02): the shoe's
      // sold and returned counts go back to what they were before the bill.
      await undoCancelledSaleCounts(db, back);
    }

    const stamp = `[Cancelled as a test bill by ${by.slice(0, 60) || "?"}: ${why}]`;
    await db.query(`UPDATE pos_invoices SET status = 'Voided', note = btrim(note || ' ' || $2) WHERE id = $1`, [invoiceId, stamp]);
    return { invoiceNumber: bill.invoice_number, pairs: moves.reduce((sum, move) => sum + (Number(move.pairs) || 0), 0) };
  });
}
