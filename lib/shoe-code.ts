/**
 * A shoe's code — its SKU — the way the owner chose on 2026-09-28: KR-205.
 *
 *   KR  the shop, on every code
 *   2   the group the shoe belongs to (below)
 *   05  its number inside that group
 *
 * The size is not part of the code: one design, one code, every size. At the
 * counter "205-38" is design KR-205 in size 38.
 *
 * Codes used to be the first eight characters of a random id ("9D72059B"),
 * which nobody could remember or say aloud across the counter.
 */

export const CODE_PREFIX = "KR";

/** The group digit for a category. Anything not listed files under 5, "other". */
const GROUP_BY_CATEGORY: Record<string, number> = {
  "mens-collection": 1,
  "mens-slippers": 1,
  "mens-shoes": 1,
  "ladies-sandals": 2,
  "party-heels": 2,
  "ladies-close-shoes": 2,
  "ladies-shoes": 2,
  "ladies-slippers": 3,
  "kids-collection": 4,
  "kids-shoes": 4,
  "kids-slippers": 4,
};
export const OTHER_GROUP = 5;

export const CODE_GROUPS: Array<{ group: number; en: string; ne: string }> = [
  { group: 1, en: "Gents", ne: "Gents जुत्ता" },
  { group: 2, en: "Ladies shoes / sandals", ne: "Ladies जुत्ता / sandal" },
  { group: 3, en: "Slippers / chappal", ne: "चप्पल / slipper" },
  { group: 4, en: "Kids", ne: "केटाकेटीका" },
  { group: 5, en: "Other", ne: "अरू" },
];

export function codeGroupFor(categorySlug: string) {
  return GROUP_BY_CATEGORY[categorySlug] ?? OTHER_GROUP;
}

/** A code as it is compared: no "#", no case, no dashes or spaces. */
export function codeKey(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/**
 * Whether what was typed names this code. "KR-205", "kr205", "#205" and "205"
 * all name KR-205, so nobody has to switch the phone keyboard to letters.
 */
export function sameCode(code: string, typed: string) {
  const own = codeKey(code);
  const wanted = codeKey(typed);
  if (!own || !wanted) return false;
  return own === wanted || own === codeKey(CODE_PREFIX) + wanted;
}

/** The number in a KR code — 205 for "KR-205" — or null for any other code. */
export function codeNumber(code: string) {
  const match = String(code ?? "").trim().match(/^kr[-\s]?(\d{3,4})$/i);
  return match ? Number(match[1]) : null;
}

export function formatCode(number: number) {
  return `${CODE_PREFIX}-${number}`;
}

/**
 * The next free code in a category's group: KR-201, KR-202, … KR-299, then
 * KR-2100 onwards should a group ever pass ninety-nine designs. Every code
 * already taken counts, KR or not, so "205" typed by hand is not handed out
 * again as KR-205.
 */
export function nextShoeCode(takenCodes: string[], categorySlug: string) {
  const group = codeGroupFor(categorySlug);
  const taken = new Set(takenCodes.map(codeKey).filter(Boolean));
  const free = (number: number) =>
    !taken.has(codeKey(formatCode(number))) && !taken.has(String(number));
  for (let number = group * 100 + 1; number <= group * 100 + 99; number += 1) {
    if (free(number)) return formatCode(number);
  }
  for (let number = group * 1000 + 100; number <= group * 1000 + 999; number += 1) {
    if (free(number)) return formatCode(number);
  }
  return formatCode(group * 10000 + taken.size);
}

/** A code as it should be stored: "kr205" and "KR 205" become "KR-205". */
export function tidyCode(value: string) {
  const trimmed = String(value ?? "").trim();
  const number = codeNumber(trimmed);
  return number === null ? trimmed : formatCode(number);
}

/**
 * What is wrong with a code, or "" if nothing is. One or two digits read as a
 * shoe size at the counter ("40" lists every shoe in size 40), so a code needs
 * three digits or a letter.
 */
export function codeProblem(value: string) {
  const code = String(value ?? "").trim();
  if (!code) return "empty";
  if (/^\d{1,2}$/.test(code)) return "looks-like-size";
  return "";
}

/**
 * A KR code for every shoe, for the codes page. A shoe that already has a KR
 * code keeps it — a code, once printed on a box, should not move. The rest
 * are numbered group by group, in name order, after the codes already in use.
 */
export function suggestCodes<T extends { id: string; sku: string; name: string; categorySlug: string }>(products: T[]) {
  const sorted = [...products].sort(
    (a, b) => codeGroupFor(a.categorySlug) - codeGroupFor(b.categorySlug) || a.name.localeCompare(b.name),
  );
  const suggested = new Map<string, string>();
  const taken: string[] = [];
  for (const product of sorted) {
    if (codeNumber(product.sku) === null) continue;
    const code = tidyCode(product.sku);
    if (taken.some((other) => codeKey(other) === codeKey(code))) continue;
    suggested.set(product.id, code);
    taken.push(code);
  }
  for (const product of sorted) {
    if (suggested.has(product.id)) continue;
    const code = nextShoeCode(taken, product.categorySlug);
    suggested.set(product.id, code);
    taken.push(code);
  }
  return suggested;
}

/**
 * Another shoe that already answers to this code, if one does. "205" and
 * "KR-205" clash too: typing 205 at the counter could not tell them apart.
 */
export function codeTakenBy<T extends { id: string; sku: string }>(products: T[], code: string, ownId = "") {
  if (!codeKey(code)) return undefined;
  return products.find(
    (product) => product.id !== ownId && (sameCode(product.sku, code) || sameCode(code, product.sku)),
  );
}
