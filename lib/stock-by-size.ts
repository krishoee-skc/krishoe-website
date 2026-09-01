import { designKey } from "@/lib/design-name";
import type { BusinessChannel, FinishedStock } from "@/lib/operations";

/**
 * Size-wise stock, read from the finished-stock rows.
 *
 * A shoe is sold by size, so "55 in stock" is not enough — size 30 can be gone
 * while 35 is piled up. Once stock is entered size-wise, each finished-stock row
 * carries a single size in `sizeRun` ("30"), and these read the pairs available
 * for each size. Older rows may still carry "Mixed" or a range like "36-41";
 * those stay under that label so a caller can tell "size not tracked yet" apart
 * from "size 30 has 5 pairs" and fall back accordingly, rather than wrongly
 * treating a mixed pile as if every size were in it.
 */

/** Net pairs on the shelf for one row: made, minus sold, plus what came back. */
function availablePairs(
  row: Pick<FinishedStock, "stockPairs" | "soldPairs" | "returnedPairs">,
): number {
  const made = Number(row.stockPairs) || 0;
  const sold = Number(row.soldPairs) || 0;
  const returned = Number(row.returnedPairs) || 0;
  return Math.max(0, made - sold + returned);
}

/** Available pairs keyed by the size label, for one design (optionally one channel). */
export function availableBySize(
  rows: FinishedStock[],
  design: string,
  options: { channel?: BusinessChannel } = {},
): Map<string, number> {
  const key = designKey(design);
  const bySize = new Map<string, number>();

  for (const row of rows) {
    if (designKey(row.design) !== key) continue;
    if (options.channel && row.channel !== options.channel) continue;
    const size = (row.sizeRun ?? "").trim() || "Mixed";
    bySize.set(size, (bySize.get(size) ?? 0) + availablePairs(row));
  }

  return bySize;
}

/** Total available pairs for a design across all its sizes (optionally one channel). */
export function totalAvailable(
  rows: FinishedStock[],
  design: string,
  options: { channel?: BusinessChannel } = {},
): number {
  let total = 0;
  for (const pairs of availableBySize(rows, design, options).values()) total += pairs;
  return total;
}

/**
 * Whether a specific size can be sold for a design — that exact size has pairs.
 *
 * When a design's stock was never entered size-wise (only "Mixed"), no exact
 * size is known here, so this returns false for every real size; the caller then
 * decides the fallback (e.g. keep the current all-sizes behaviour until the shop
 * is entered size-wise), rather than this guessing.
 */
export function sizeInStock(
  rows: FinishedStock[],
  design: string,
  size: string,
  options: { channel?: BusinessChannel } = {},
): boolean {
  const wanted = (size ?? "").trim();
  if (!wanted) return false;
  return (availableBySize(rows, design, options).get(wanted) ?? 0) > 0;
}

/** True once a design has any size-wise stock (a real size, not just "Mixed"/a range). */
export function hasSizeWiseStock(rows: FinishedStock[], design: string): boolean {
  for (const size of availableBySize(rows, design).keys()) {
    if (/^\d{1,2}$/.test(size)) return true;
  }
  return false;
}
