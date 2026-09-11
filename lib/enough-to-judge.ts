/**
 * Whether there is enough data to say anything.
 *
 * Six times now a screen has told the owner something confident that the
 * numbers did not support, and each time it was the same mistake wearing
 * different clothes:
 *
 *   "Home page 40.7s 🔴 Slow"      one phone on a bad connection, in ten
 *   "/review 6.0s 🔴 Slow"          two readings, one of them a cold rebuild
 *   "Rs. 0.00" coloured as money    a dash is not an amount
 *   "Database may be unavailable"   the owner had typed a short reason
 *   a month's wage from the wrong table
 *   payroll coloured unlike the ledger beside it
 *
 * Every one was found by the owner, not by a test, and every one was fixed
 * afterwards with a test that locks that single case. That is six locks and no
 * door. The shared fault is not any of those screens: it is that a percentage
 * from two rows is drawn exactly like a percentage from two hundred, so a
 * figure with nothing behind it arrives looking like a finding.
 *
 * A rate is a claim about a pattern. Under a handful of observations there is
 * no pattern to claim — one entry still in progress is "0% success", which the
 * factory board painted red. So this returns the verdict only when the count
 * earns it, and otherwise says plainly that it is too early.
 *
 * The threshold is deliberately low. It is not a statistical test; it is a
 * guard against the specific, repeated failure of announcing a crisis from a
 * single row.
 */

/** Below this, a rate is noise rather than a finding. */
export const ENOUGH = 5;

export type Verdict<T> =
  | { enough: true; verdict: T }
  | { enough: false; verdict: null };

/**
 * `judge(count, () => tone)` — the tone only when `count` supports it.
 *
 * The verdict is a callback so the caller's own thresholds stay in the caller,
 * where they are readable, rather than being pushed in here as parameters.
 */
export function judge<T>(count: number, verdict: () => T): Verdict<T> {
  if (!Number.isFinite(count) || count < ENOUGH) {
    return { enough: false, verdict: null };
  }
  return { enough: true, verdict: verdict() };
}

/** What a screen shows in place of a verdict it has not earned. */
export const TOO_EARLY = {
  en: "Too few yet",
  ne: "अझै थोरै",
} as const;
