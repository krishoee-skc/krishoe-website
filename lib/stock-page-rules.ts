import type { StockMovement } from "@/lib/operations";

/**
 * The stock page's wording and arithmetic, kept pure so the page and its tests
 * read them the same way (owner, 2026-09-30).
 */

/** A movement's kind on the page: its type, or "Counter In" for goods added from the counter bill. */
export type MovementKind = StockMovement["type"] | "Counter In";

/**
 * Goods put on the books from the counter bill as "already on the shelf" are
 * an Adjustment underneath, and read "adjusted 200" — as if a count had been
 * corrected — when 200 pairs of kitto 770 had just come onto the books.
 */
export function movementKind(movement: Pick<StockMovement, "type" | "note">): MovementKind {
  if (movement.type === "Adjustment" && /from the counter bill/i.test(movement.note ?? "")) return "Counter In";
  return movement.type;
}

/**
 * A movement's kind in the owner's words, with the sign it moves stock by. An
 * Adjustment always adds pairs (lib/stock-rules.ts), so it carries a plus: it
 * used to show a bare "6", which read as neither in nor out.
 */
export const movementWords: Record<MovementKind, { en: string; ne: string; sign: 1 | -1 | 0 }> = {
  "Production In": { en: "made", ne: "बन्यो", sign: 1 },
  "Purchase In": { en: "bought in", ne: "किनेर आयो", sign: 1 },
  "Counter In": { en: "added at the counter", ne: "बिलबाट थपियो", sign: 1 },
  "Return In": { en: "returned", ne: "फिर्ता आयो", sign: 1 },
  "Sale Out": { en: "sold", ne: "बिक्री", sign: -1 },
  "Market Sale": { en: "sold at a market", ne: "बजारमा बिक्री", sign: -1 },
  "Dispatch Out": { en: "sent out", ne: "पठाइयो", sign: -1 },
  "Damage Out": { en: "written off", ne: "बिग्रिएर हटाइयो", sign: -1 },
  Adjustment: { en: "added on a count", ne: "गन्तीमा थपियो", sign: 1 },
};

export type ReadyPart = { key: "made" | "bought" | "both" | "shelf"; en: string; ne: string; pairs: number };

/**
 * The pairs ready to sell, split by where they came from — every pair in one
 * part, so the parts add up to the whole. "156 made here · 59 bought in" under
 * 475 left 260 pairs unexplained: those already on the shelf, added at the
 * counter or on a count.
 */
export function readyParts(summary: {
  manufacturedPairs: number;
  purchasedPairs: number;
  mixedPairs: number;
  openingPairs: number;
}): ReadyPart[] {
  const parts: ReadyPart[] = [
    { key: "made", en: "made here", ne: "आफैँ बनाएको", pairs: summary.manufacturedPairs },
    { key: "bought", en: "bought in", ne: "किनेको", pairs: summary.purchasedPairs },
    { key: "both", en: "made and bought", ne: "बनाएको र किनेको", pairs: summary.mixedPairs },
    { key: "shelf", en: "already on the shelf / added at the counter", ne: "पहिले नै थियो / बिलबाट थपिएको", pairs: summary.openingPairs },
  ];
  return parts.filter((part) => part.pairs > 0);
}

/**
 * What can be said of a shoe's selling when "how long it lasts" cannot yet:
 * the pairs sold and over how many days. "Can't tell yet" on six shoes of
 * twelve said nothing, though bantu hill had sold 17.
 */
export function salesPace(soldInWindow: number, historyDays: number): { en: string; ne: string } | null {
  if (soldInWindow <= 0) return null;
  const days = Math.max(1, historyDays);
  return {
    en: `${soldInWindow} sold in ${days} day${days === 1 ? "" : "s"}`,
    ne: `${days} दिनमा ${soldInWindow} जोडी बिक्यो`,
  };
}

/** A shoe with this many pairs or more is counted size by size in the week's count. */
export const COUNT_BY_SIZE_FROM = 30;

/**
 * The sizes to count one by one, when a shoe is big enough that "count 200
 * pairs" is a morning's work and one wrong number hides in it. Only real
 * sizes; the uncounted pile stays one line.
 */
export function sizesToCount(rows: Array<{ sizeRun: string; total: number }>, total: number) {
  if (total < COUNT_BY_SIZE_FROM) return [];
  const sized = rows.filter((row) => row.total > 0);
  if (sized.filter((row) => row.sizeRun && row.sizeRun !== "Mixed").length < 2) return [];
  return [...sized]
    .sort((a, b) => {
      if (a.sizeRun === "Mixed") return 1;
      if (b.sizeRun === "Mixed") return -1;
      return Number(a.sizeRun) - Number(b.sizeRun) || a.sizeRun.localeCompare(b.sizeRun);
    })
    .map((row) => ({ size: row.sizeRun, pairs: row.total }));
}
