/**
 * The sizes a shoe is made in.
 *
 * The work-entry screen offered 6, 7, 8, 9, 10 — a list written into the code
 * once and never revisited. Every shoe this shop makes runs 36 to 41, so the
 * chips were never the answer and the size was typed by hand every time, which
 * is how "36/42" and "36/41" both ended up in the same column.
 *
 * Nepali shoe sizes come in runs, and the run depends on who the shoe is for:
 * a child's is 25–30, a youth's 31–35, an adult's 36–41. Offering one fixed
 * list can only ever be right for one of them, and wrong again the day the
 * shop makes something new.
 *
 * So there are two answers here. When the product's own size run is known, the
 * chips are that run — nothing to keep in step by hand. When it is not, the
 * runs below fill a whole range in one tap.
 */

export type SizeRun = {
  /** What the run is called, in both languages. */
  en: string;
  ne: string;
  from: number;
  to: number;
};

/**
 * The runs this shop works in. Named for who wears them rather than by number,
 * because that is how the owner asks for them.
 */
export const SIZE_RUNS: SizeRun[] = [
  { en: "Kids", ne: "बच्चा", from: 25, to: 30 },
  { en: "Youth", ne: "मध्यम", from: 31, to: 35 },
  { en: "Adult", ne: "ठूलो", from: 36, to: 41 },
];

/** Every size in a run: 25–30 becomes ["25","26","27","28","29","30"]. */
export function sizesInRun(run: Pick<SizeRun, "from" | "to">): string[] {
  const sizes: string[] = [];
  for (let size = run.from; size <= run.to; size += 1) {
    sizes.push(String(size));
  }
  return sizes;
}

/** "Kids 25–30" — the label a run chip carries. */
export function sizeRunLabel(run: SizeRun, nepali: boolean) {
  return `${nepali ? run.ne : run.en} ${run.from}–${run.to}`;
}

/**
 * The sizes a product is stored as, cleaned up.
 *
 * They arrive as text — typed, imported, occasionally with stray spaces or an
 * empty entry — so they are trimmed, de-duplicated and put in numeric order.
 * "10" must not sort before "9", which is what plain text sorting would do.
 */
export function productSizes(sizes: readonly string[] | null | undefined): string[] {
  if (!sizes) return [];

  const seen = new Set<string>();
  for (const raw of sizes) {
    const size = String(raw ?? "").trim();
    if (size) seen.add(size);
  }

  return [...seen].sort((left, right) => {
    const a = Number(left);
    const b = Number(right);
    // Anything that is not a number keeps its place after the numbers, in
    // alphabetical order — a size written "Free" should still appear.
    if (Number.isFinite(a) && Number.isFinite(b)) return a - b;
    if (Number.isFinite(a)) return -1;
    if (Number.isFinite(b)) return 1;
    return left.localeCompare(right);
  });
}

/**
 * Which run a set of sizes belongs to, if any — so a product whose sizes are
 * known can still show its run's name beside them.
 */
export function runForSizes(sizes: readonly string[]): SizeRun | null {
  const numbers = sizes.map(Number).filter(Number.isFinite);
  if (numbers.length === 0) return null;

  const low = Math.min(...numbers);
  const high = Math.max(...numbers);

  return SIZE_RUNS.find((run) => low >= run.from && high <= run.to) ?? null;
}

/**
 * Adding or removing one size from a comma-separated list, keeping it ordered.
 *
 * The field stores what the clerk sees — "36, 37, 38" — so tapping a chip has
 * to put the size in its place rather than on the end, or the list reads as
 * the order they were tapped in.
 */
export function toggleSize(current: string, size: string): string {
  const list = current
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const next = list.includes(size)
    ? list.filter((entry) => entry !== size)
    : [...list, size];

  return productSizes(next).join(", ");
}

/** Every size in a run, added to what is already chosen. */
export function addRun(current: string, run: Pick<SizeRun, "from" | "to">): string {
  const list = current
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return productSizes([...list, ...sizesInRun(run)]).join(", ");
}

/**
 * The sizes a run names, whichever way the run was written.
 *
 * The same run reaches this app in three shapes, and all three are in the
 * factory's records today: "36/41" typed on one entry, "36, 37, 38, 39, 40, 41"
 * tapped from the chips on another, "36-41" from a phone keyboard. A person
 * reads those as one thing; the app read them as three, which is why sixty
 * uppers and sixty bottoms of the same shoe could not be matched to each other.
 *
 * A range is expanded into the sizes it covers; a list is taken as the sizes it
 * names. Nothing is invented: "36, 38, 40" stays three sizes, because two of
 * them were never made.
 */
export function expandSizeRun(value: string | null | undefined): string[] {
  const raw = String(value ?? "").trim();
  if (!raw) return [];

  // A range: two numbers with a slash, dash, en-dash or "to" between them.
  const range = raw.match(/^(\d+)\s*(?:\/|-|–|—|to)\s*(\d+)$/i);
  if (range) {
    const from = Number(range[1]);
    const to = Number(range[2]);
    // Backwards ("41/36") is a typo, not a range. Kept as written rather than
    // silently reversed, so the person who typed it sees their own mistake.
    if (Number.isFinite(from) && Number.isFinite(to) && from <= to) {
      return sizesInRun({ from, to });
    }
  }

  // Otherwise a list — productSizes already trims, de-duplicates and sorts
  // numerically, so "9, 10" does not come back as "10, 9".
  return productSizes(raw.split(","));
}

/**
 * One comparable key for a set of sizes, however it was written.
 *
 * Two runs match when they name exactly the same sizes. That is deliberately
 * strict: "36/42" and "36/41" are different runs and must stay different —
 * fom close shoes really was made 36–42 on the upper and 36–41 on the bottom,
 * and treating those as one would post a pair that does not exist.
 *
 * Blank stays blank rather than becoming a wildcard, and "Mixed" — what the app
 * writes when no size was given — keeps to itself for the same reason.
 */
export function sizeRunKey(value: string | null | undefined): string {
  return expandSizeRun(value).join(",");
}

/** Whether two size runs name the same sizes, however each was typed. */
export function sameSizeRun(left: string | null | undefined, right: string | null | undefined) {
  const key = sizeRunKey(left);
  return key.length > 0 && key === sizeRunKey(right);
}
