/**
 * A "saved ✅" message that speaks the reader's language.
 *
 * These messages are written by a server action and handed to the next page
 * through the URL (`?saved=...`). The server has no idea which language the
 * reader chose — that lives in the browser — so the action used to pick one,
 * and it picked Nepali. An owner working in English saved a raw material and
 * was told "कच्चा पदार्थ थपियो ✅".
 *
 * So both halves travel in the URL and the page shows the one its reader
 * wants. A message written before this change still works: with no separator
 * in it, the whole string is used for both languages, which is what it already
 * did.
 */

/**
 * Splits the two halves. Three vertical bars appear in no sentence either
 * language would write, and survive URL encoding unchanged.
 */
const SEPARATOR = "|||";

/** Pack a message for the URL. */
export function savedMessage(en: string, ne: string) {
  return `${en}${SEPARATOR}${ne}`;
}

/** Unpack one, for a screen that will choose by language. */
export function readSavedMessage(raw: string): { en: string; ne: string } {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return { en: "", ne: "" };
  }

  const index = trimmed.indexOf(SEPARATOR);
  if (index === -1) {
    // Written before this change, or genuinely one language: show it to both.
    return { en: trimmed, ne: trimmed };
  }

  const en = trimmed.slice(0, index).trim();
  const ne = trimmed.slice(index + SEPARATOR.length).trim();

  return { en: en || ne, ne: ne || en };
}
