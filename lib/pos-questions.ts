/**
 * A bill that waits for one answer from the counter (owner, 2026-10-20,
 * audit 6 and 12), instead of saving in silence or failing as an error.
 *
 *   fromFactory   the shop's shelf has fewer pairs of a shoe than the bill —
 *                 they would come off the factory's count. "Give them from the
 *                 factory?" Yes sends the bill again with the answer.
 *   belowMinimum  a wholesale bill under the shoe's minimum. The Owner may say
 *                 yes; anyone else is told the minimum, as before.
 *
 * No database here: the bill form reads these names.
 */
export type PosQuestion = "fromFactory" | "belowMinimum";

/** The form field that carries the counter's yes for each question. */
export const POS_ANSWER_FIELD: Record<PosQuestion, string> = {
  fromFactory: "answerFromFactory",
  belowMinimum: "answerBelowMinimum",
};

/** Thrown by the bill when it needs an answer, or only to say no; never logged as a failure. */
export class PosNeedsAnswer extends Error {
  constructor(
    readonly said: { en: string; ne: string },
    readonly question: PosQuestion | null,
  ) {
    // Both halves, as the counter's other messages are.
    super(`${said.ne} ${said.en}`);
    this.name = "PosNeedsAnswer";
  }
}
