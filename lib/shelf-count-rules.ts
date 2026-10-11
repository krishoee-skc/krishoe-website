import { countChanges, type CountChange } from "@/lib/counter-item-rules";

/**
 * A count that finds this many pairs fewer than the app holds asks "I counted
 * again" before it is saved (owner, 2026-10-11). Pure, so the screen and the
 * server read the same figure.
 */
export const BIG_COUNT_DROP = 10;

export type ShelfCountPlan = {
  /** At the place counted, size by size: what the app had and what was found. */
  placeChanges: CountChange[];
  /** What the stock does, size by size: + in as an Adjustment, − off as not found. */
  stockMoves: Array<{ size: string; change: number }>;
  /** Pairs fewer at the place than the app held there. */
  fewer: number;
};

/**
 * What a count of one place does (owner, 2026-10-11). The place becomes the
 * count; a size it held but that was not typed goes to 0; the other place is
 * not touched. Each size's stock becomes the count here plus the other place,
 * so the stock and "where the pairs are" agree again.
 */
export function planShelfCount(input: {
  /** The stock (finished_stock), by size. */
  books: Record<string, number>;
  /** The place being counted, by size. */
  here: Record<string, number>;
  /** The other place, by size. */
  there: Record<string, number>;
  counted: Record<string, number>;
}): ShelfCountPlan {
  const placeChanges = countChanges(input.here, input.counted);
  const fewer = placeChanges.reduce((sum, change) => sum + Math.max(0, -change.change), 0);
  const sizes = [...new Set([...Object.keys(input.books), ...Object.keys(input.here), ...Object.keys(input.there), ...Object.keys(input.counted)])];
  sizes.sort((left, right) => Number(left) - Number(right) || left.localeCompare(right));
  const stockMoves = sizes
    .map((size) => ({ size, change: (input.counted[size] ?? 0) + (input.there[size] ?? 0) - (input.books[size] ?? 0) }))
    .filter((move) => move.change !== 0);
  return { placeChanges, stockMoves, fewer };
}
