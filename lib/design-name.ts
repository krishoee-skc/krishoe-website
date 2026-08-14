/**
 * One design, one name.
 *
 * A design is identified by the words the owner types, and those words arrive
 * spelled loosely: "bag open", "Bag Open", "BAG OPEN", "bag  open". They are
 * one product in the shop, so they have to be one row in stock. Two rows that
 * read the same are indistinguishable in a list, and the pairs then split
 * across both — the same failure that split wages between "aarif" and "aarif ".
 *
 * The comparison is deliberately not clever. It ignores case and treats any run
 * of spaces as one space, and stops there: "bagopen" written as one word is a
 * different string and stays a different design, because guessing that two
 * genuinely different spellings mean the same thing is how a system silently
 * merges two real products.
 */
export function designKey(value: string) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function sameDesign(left: string, right: string) {
  const key = designKey(left);
  return key.length > 0 && key === designKey(right);
}

/**
 * The spelling a design should be stored under.
 *
 * Given what was just typed and the names already on record, this returns the
 * existing spelling when one matches — so a movement typed as "Bag Open"
 * against a shop product called "bag open" is filed under "bag open", and one
 * name appears everywhere instead of two that have to be read carefully to be
 * told apart. With nothing on record to match, the typed name stands as given.
 */
export function canonicalDesignName(typed: string, knownNames: Iterable<string>) {
  const key = designKey(typed);
  if (!key) return typed.trim();

  for (const known of knownNames) {
    if (designKey(known) === key) return known.trim();
  }

  return typed.trim();
}
