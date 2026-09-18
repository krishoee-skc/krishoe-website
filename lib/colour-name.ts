/**
 * One colour, one name.
 *
 * A colour is identified by the word somebody typed, and those words arrive
 * spelled loosely: "black", "Black", "BLACK", "cherry  red". They are one
 * colour on one shoe, so they have to key as one — the factory's own records
 * hold "black" and "Black" today, written by two people on two days for the
 * same shoe.
 *
 * That matters beyond tidiness. The automatic stock posting matches an upper to
 * a bottom on item, colour and size run; with two spellings of one colour,
 * sixty uppers and sixty bottoms of the same shoe look like two unrelated
 * batches and the finished pairs never post.
 *
 * The comparison is deliberately not clever, and is the same one
 * lib/design-name.ts makes for shoe names: it ignores case and treats any run
 * of spaces as one space, and stops there. "cherry" and "cherry red" stay
 * different colours, and so do "crim" and "cream" — guessing that two
 * genuinely different words mean the same thing is how a system silently
 * merges two real products.
 */
export function colourKey(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Whether two colours are the same colour, however each was typed. */
export function sameColour(left: string | null | undefined, right: string | null | undefined) {
  const key = colourKey(left);
  return key.length > 0 && key === colourKey(right);
}

/**
 * The spelling a colour should be stored under.
 *
 * Given what was just typed and the colours already on record, this returns the
 * existing spelling when one matches — so an entry typed "Black" against a
 * shop that already writes "black" is filed as "black", and one spelling
 * appears everywhere instead of two that read the same. With nothing on record
 * to match, the typed name stands as given.
 */
export function canonicalColourName(typed: string, knownColours: Iterable<string>) {
  const key = colourKey(typed);
  if (!key) return (typed ?? "").trim();

  for (const known of knownColours) {
    if (colourKey(known) === key) return (known ?? "").trim();
  }

  return typed.trim();
}
