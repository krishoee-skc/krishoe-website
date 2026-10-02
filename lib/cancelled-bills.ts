import type { StockMovement } from "@/lib/operations";

/**
 * Cancelled test bills, as the stock records carry them (owner, 2026-10-02:
 * "bantu hill 41% returned" — and not one pair had come back).
 *
 * Cancelling a test bill (lib/pos-void.ts) puts its pairs back with a "Return
 * In" for each of the bill's own "Sale Out", noted "<bill> cancelled — test
 * bill". The stock is right that way. But a sale that never happened is not a
 * sale, and a pair put back from it is not a return: counted as both, the
 * cancelled bills made every shoe they touched look sold and then sent back —
 * bantu hill 23 sold and 16 returned, when 7 had sold and none returned.
 *
 * So the selling figures leave both halves out. The movement list still shows
 * them, as what happened.
 */

/** The words a cancel's put-back carries after the bill number. */
export const CANCEL_NOTE = "cancelled — test bill";

/** The bill number a cancel's put-back names, or null if the movement is not one. */
export function cancelledBillOf(movement: Pick<StockMovement, "type" | "note">): string | null {
  if (movement.type !== "Return In") return null;
  const note = (movement.note ?? "").trim();
  if (!note.endsWith(` ${CANCEL_NOTE}`)) return null;
  const bill = note.slice(0, -(CANCEL_NOTE.length + 1)).trim();
  return bill || null;
}

/**
 * The movements that count as selling: everything except a cancelled bill's
 * sales and the put-backs that cancelled them. A sale is "<bill> sale <sku>"
 * (lib/pos.ts), so a cancelled bill's sales are the ones that start with its
 * number. Both halves go together, so the pairs on the shelf come out the same.
 */
export function withoutCancelledBills<T extends Pick<StockMovement, "type" | "note">>(movements: T[]): T[] {
  const cancelled = new Set<string>();
  for (const movement of movements) {
    const bill = cancelledBillOf(movement);
    if (bill) cancelled.add(bill);
  }
  if (cancelled.size === 0) return movements;
  return movements.filter((movement) => {
    if (cancelledBillOf(movement)) return false;
    if (movement.type !== "Sale Out") return true;
    const bill = (movement.note ?? "").trim().split(/\s+/)[0] ?? "";
    return !cancelled.has(bill);
  });
}
