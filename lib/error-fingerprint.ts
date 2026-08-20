/**
 * The stable part of a failure message, so one fault is counted once.
 *
 * reportError is called with the work in hand — "post bill INV-1183", "sync
 * catalog stock after purchase PUR-12" — and the error underneath carries ids,
 * amounts and timestamps of its own. Grouped by that raw text, a single fault
 * that struck fifty orders reads as fifty separate faults seen once each: every
 * row in Top Errors says 1, nothing stands out, and the summary is a log with
 * extra steps.
 *
 * Removing the parts that differ per occurrence puts those fifty back together.
 * It is deliberately crude, because it only decides which rows share a line in
 * a summary — the full message is stored untouched beside it, and the recent
 * list shows it verbatim.
 */

const MASKS: Array<[RegExp, string]> = [
  // Order matters. The specific shapes go first so the closing sweep for bare
  // numbers cannot chew a uuid or a date into fragments that no longer match
  // each other — which would defeat the whole point of grouping.
  [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>"],
  [/\b\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?\b/g, "<time>"],
  [/\b[A-Z][A-Z0-9]{1,9}-\d+\b/g, "<ref>"],
  [/"[^"]*"|'[^']*'/g, "<value>"],
  [/\b\d[\d,._]*\b/g, "<n>"],
];

export const FINGERPRINT_MAX = 200;

export function fingerprintFailure(message: string) {
  let key = message.split("\n", 1)[0] ?? "";

  for (const [pattern, replacement] of MASKS) {
    key = key.replace(pattern, replacement);
  }

  return key.trim().slice(0, FINGERPRINT_MAX) || "unknown failure";
}
