/**
 * A bill that waits for one answer from the counter (owner, 2026-10-20,
 * audit 6 and 12), instead of saving in silence or failing as an error.
 *
 *   fromFactory   the shop's shelf has fewer pairs of a shoe than the bill —
 *                 they would come off the factory's count. "Give them from the
 *                 factory?" Yes sends the bill again with the answer.
 *   belowMinimum  a wholesale bill under the shoe's minimum. The Owner may say
 *                 yes; anyone else is told the minimum, as before.
 *   heldForOrder  the pairs are held for an online order a customer is waiting
 *                 on (KR-BUG-014, 2026-10-28). Yes sells them anyway.
 *   shortAtShop   once the factory and the shop are two businesses (owner,
 *                 2026-10-31): the shop's shelf is short. There is no yes —
 *                 the counter sends the pairs by challan first, or moves the
 *                 shoe onto the factory's bill. The shoes come with it.
 *
 * No database here: the bill form reads these names.
 */
export type PosQuestion = "fromFactory" | "belowMinimum" | "heldForOrder" | "shortAtShop";

/** The form field that carries the counter's yes for each question. */
export const POS_ANSWER_FIELD: Record<PosQuestion, string> = {
  fromFactory: "answerFromFactory",
  belowMinimum: "answerBelowMinimum",
  heldForOrder: "answerHeldForOrder",
  // Never sent: the counter answers it with a challan or the factory's bill.
  shortAtShop: "answerShortAtShop",
};

/** Thrown by the bill when it needs an answer, or only to say no; never logged as a failure. */
export class PosNeedsAnswer extends Error {
  constructor(
    readonly said: { en: string; ne: string },
    readonly question: PosQuestion | null,
    /** The shoes the question is about, for an answer that acts on them. */
    readonly designs: string[] = [],
  ) {
    // Both halves, as the counter's other messages are.
    super(`${said.ne} ${said.en}`);
    this.name = "PosNeedsAnswer";
  }
}

/**
 * The counter's own rules saying no — too few pairs for the bill, more coming
 * back than the customer owes, a shoe not in stock yet (KR-BUG-004,
 * 2026-10-27). The counter is told, as before; Monitoring is not, where these
 * were filed as errors and buried the real ones.
 */
const COUNTER_RULES = [
  // "Cannot bill" before saving; "Cannot Sale Out" from the locked stock row
  // when two counters sell the last pairs at once (lib/stock-rules.ts).
  / has only \d+ pairs\. Cannot [A-Za-z ]+ \d+ pairs\.$/,
  / has only Rs\. [\d.,-]+ due\. Cannot post Rs\. [\d.,]+\.$/,
  / is not in stock yet\.$/,
];

export function isCounterRule(error: unknown) {
  return error instanceof Error && COUNTER_RULES.some((rule) => rule.test(error.message));
}
