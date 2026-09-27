/**
 * One line per shoe on a bill, not one per size.
 *
 * A wholesale bill of two designs in five sizes each ran to ten lines — the
 * same name and rate five times over — on the counter screen and on the
 * printed bill alike. Lines of one design, one colour and one rate are shown
 * together, with their sizes inside the line.
 *
 * Only the showing changes. Every size is still its own line underneath, so
 * stock still comes off size by size and the saved bill is unchanged. A size
 * sold at a different rate keeps a line of its own, so no line ever carries
 * two prices.
 */

export type BillLineLike = {
  design: string;
  color?: string;
  rate: number;
};

export type BillLineGroup<T extends BillLineLike> = {
  key: string;
  design: string;
  color: string;
  rate: number;
  lines: T[];
};

function norm(value: string | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

/**
 * Lines grouped by design, colour and rate, in the order they first appear.
 *
 * `apart` keeps lines that must not merge in groups of their own — a pair
 * coming back in an exchange, say, or a line carrying its own discount.
 */
export function groupBillLines<T extends BillLineLike>(
  lines: T[],
  apart: (line: T) => string = () => "",
): BillLineGroup<T>[] {
  const groups = new Map<string, BillLineGroup<T>>();

  for (const line of lines) {
    const key = [norm(line.design), norm(line.color), String(line.rate), apart(line)].join("|");
    const group = groups.get(key);
    if (group) {
      group.lines.push(line);
    } else {
      groups.set(key, {
        key,
        design: line.design,
        color: String(line.color ?? "").trim(),
        rate: line.rate,
        lines: [line],
      });
    }
  }

  return [...groups.values()];
}

export type SizeCount = { size: string; pairs: number };

function sizeNumber(size: string) {
  const value = Number(size);
  return Number.isFinite(value) ? value : Number.NaN;
}

/** Sizes in shoe order: 36 before 40, and anything that is not a number last. */
export function sortSizes<T extends SizeCount>(sizes: T[]): T[] {
  return [...sizes].sort((a, b) => {
    const left = sizeNumber(a.size);
    const right = sizeNumber(b.size);
    if (Number.isNaN(left) && Number.isNaN(right)) return a.size.localeCompare(b.size);
    if (Number.isNaN(left)) return 1;
    if (Number.isNaN(right)) return -1;
    return left - right;
  });
}

/**
 * The sizes of one group, short enough for a printed bill's Size column.
 *
 * "36-40 ×1 each" when every size from 36 to 40 is there once (or twice…);
 * otherwise each size with its pairs — "36×2, 38×1, 41×1". A single size is
 * just the size, as it always was.
 */
export function sizeSummary(sizes: SizeCount[]): string {
  const known = sortSizes(sizes.filter((row) => row.size.trim() && row.pairs > 0));
  if (known.length === 0) return "";
  if (known.length === 1) {
    return known[0].pairs > 1 ? `${known[0].size} ×${known[0].pairs}` : known[0].size;
  }

  const numbers = known.map((row) => sizeNumber(row.size));
  const evenPairs = known.every((row) => row.pairs === known[0].pairs);
  const unbroken = numbers.every(
    (value, index) => !Number.isNaN(value) && Number.isInteger(value) && (index === 0 || value === numbers[index - 1] + 1),
  );

  if (evenPairs && unbroken) {
    return `${known[0].size}-${known[known.length - 1].size} ×${known[0].pairs} each`;
  }

  return known.map((row) => `${row.size}×${row.pairs}`).join(", ");
}
