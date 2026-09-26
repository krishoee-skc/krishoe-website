/**
 * Finished pairs posted one size at a time.
 *
 * Stock used to go in as one pile per run — sixty pairs of "36-41", or
 * "Mixed" — and the counter bill cannot tell what is in a pile: it showed
 * lose hill panja's sizes 36–40 as "not counted" and had no button at all for
 * the 41s the factory had made. A pile written as one row per size is what
 * the bill already knows how to count ("41 · 6 pairs"), so the posting splits
 * the pairs here and nothing downstream has to change.
 *
 * Shared by the factory's "Post to stock" and by Packing/QC, so the two never
 * disagree about what counts as a size.
 */

/** One real shoe size, the same test the counter bill uses: "41", not "36-41" or "Mixed". */
export function isSingleShoeSize(value: string) {
  return /^\d{1,2}$/.test(value.trim());
}

/**
 * The split as stock rows, smallest size first — or null when it cannot be one.
 *
 * Null for anything the bill could not count: a size that is not a single shoe
 * size, a pair count that is not a whole positive number, or sizes that do not
 * add up to the pairs being posted. The caller then posts one pile, as before,
 * rather than inventing a split.
 */
export function sizeWiseRows(breakdown: Record<string, unknown> | null | undefined, totalPairs: number) {
  if (!breakdown || typeof breakdown !== "object") return null;
  const rows: Array<[string, number]> = [];
  for (const [rawSize, rawPairs] of Object.entries(breakdown)) {
    const size = rawSize.trim();
    const pairs = Number(rawPairs);
    if (!isSingleShoeSize(size) || !Number.isInteger(pairs) || pairs < 0) return null;
    if (pairs > 0) rows.push([size, pairs]);
  }
  if (rows.length === 0) return null;
  const sum = rows.reduce((total, [, pairs]) => total + pairs, 0);
  if (sum !== Math.trunc(totalPairs)) return null;
  return rows.sort(([left], [right]) => Number(left) - Number(right));
}

/**
 * The even split a counted run most likely is, to prefill the boxes.
 *
 * Sixty pairs of 36–41 are usually ten sets of six. Only offered when it comes
 * out whole; otherwise the boxes stay empty for the godown count, because a
 * guessed 11/10/10/10/10/9 would be posted as if someone had counted it.
 */
export function evenSplit(sizes: string[], pairs: number): Record<string, number> | null {
  const count = sizes.length;
  const whole = Math.trunc(pairs);
  if (count === 0 || whole <= 0 || whole % count !== 0) return null;
  return Object.fromEntries(sizes.map((size) => [size, whole / count]));
}
