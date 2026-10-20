/**
 * A shoe's colour, said again in its descriptions (owner, 2026-10-20).
 *
 * Lose Hill Panja's colour was changed from Black to Cherry, and its short
 * description still sold it as "Black regular-fit ladies sandals". When the
 * colour box changes, the old colour's name is changed in the descriptions
 * too — English and Nepali — on the form, before Save, where the owner sees
 * it. A description that names a colour the shoe is not listed in is pointed
 * out, with one press to put it right.
 *
 * No database here: the product form reads these.
 */

/** Colour names the shop uses, English and Nepali. Matched without case. */
export const COLOUR_WORDS: readonly { en: string; ne: string }[] = [
  { en: "Black", ne: "कालो" },
  { en: "White", ne: "सेतो" },
  { en: "Cream", ne: "क्रिम" },
  { en: "Cherry", ne: "चेरी" },
  { en: "Maroon", ne: "मरुन" },
  { en: "Red", ne: "रातो" },
  { en: "Gray", ne: "खरानी" },
  { en: "Grey", ne: "खरानी" },
  { en: "Brown", ne: "खैरो" },
  { en: "Tan", ne: "ट्यान" },
  { en: "Beige", ne: "बेज" },
  { en: "Blue", ne: "निलो" },
  { en: "Green", ne: "हरियो" },
  { en: "Pink", ne: "गुलाबी" },
  { en: "Purple", ne: "बैजनी" },
  { en: "Yellow", ne: "पहेँलो" },
  { en: "Golden", ne: "सुनौलो" },
  { en: "Gold", ne: "सुनौलो" },
  { en: "Silver", ne: "चाँदी" },
];

/** "Cherry, cream" → ["Cherry", "cream"]: the colour box as the save reads it. */
export function colourList(typed: string) {
  return typed
    .split(",")
    .map((colour) => colour.trim())
    .filter(Boolean);
}

function known(colour: string) {
  const wanted = colour.trim().toLowerCase();
  return COLOUR_WORDS.find((word) => word.en.toLowerCase() === wanted || word.ne === colour.trim());
}

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The English word on its own: "Black" in "Black sandals", never in "Blackberry". */
function englishWord(word: string) {
  return new RegExp(`(?<![A-Za-z])${escape(word)}(?![A-Za-z])`, "gi");
}

/** A Nepali word has no capitals; it stands between spaces and punctuation. */
function nepaliWord(word: string) {
  return new RegExp(`(?<![\\u0900-\\u097F])${escape(word)}(?![\\u0900-\\u097F])`, "g");
}

/** The new word written the way the old one was: "Black" → "Cherry", "black" → "cherry". */
function sameCase(found: string, next: string) {
  if (found === found.toUpperCase() && found.length > 1) return next.toUpperCase();
  if (found[0] === found[0]?.toUpperCase()) return next[0].toUpperCase() + next.slice(1);
  return next.toLowerCase();
}

/**
 * The one colour taken out and the one put in, when the box changed by one
 * colour; null when nothing clear changed (added a second colour, cleared it).
 */
export function colourSwap(before: string[], after: string[]) {
  const lower = (list: string[]) => list.map((colour) => colour.toLowerCase());
  const gone = before.filter((colour) => !lower(after).includes(colour.toLowerCase()));
  const came = after.filter((colour) => !lower(before).includes(colour.toLowerCase()));
  return gone.length === 1 && came.length === 1 ? { from: gone[0], to: came[0] } : null;
}

/** The text with one colour's name changed to another's, in English and in Nepali. */
export function swapColourWords(text: string, from: string, to: string) {
  if (!text || !from.trim() || !to.trim()) return text;
  let next = text.replace(englishWord(from.trim()), (found) => sameCase(found, to.trim()));
  const fromNe = known(from)?.ne;
  const toNe = known(to)?.ne;
  if (fromNe && toNe && fromNe !== toNe) next = next.replace(nepaliWord(fromNe), toNe);
  return next;
}

/**
 * Colours the descriptions name that the shoe is not listed in — "Black" in
 * the text of a shoe whose colour is Cherry. Each once, as the English name.
 */
export function coloursNotOnShoe(texts: string[], colours: string[]) {
  const listed = new Set(colours.map((colour) => known(colour)?.en.toLowerCase() ?? colour.trim().toLowerCase()));
  const listedNe = new Set(colours.map((colour) => known(colour)?.ne).filter(Boolean));
  const joined = texts.join("\n");
  const found: string[] = [];
  for (const word of COLOUR_WORDS) {
    if (listed.has(word.en.toLowerCase()) || listedNe.has(word.ne)) continue;
    // "Gold" inside a shoe listed as Golden, or Grey for Gray: one colour.
    if (found.some((seen) => known(seen)?.ne === word.ne)) continue;
    if (englishWord(word.en).test(joined) || nepaliWord(word.ne).test(joined)) found.push(word.en);
  }
  return found;
}
