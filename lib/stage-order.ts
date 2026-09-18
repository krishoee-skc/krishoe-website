/**
 * A bottom cannot be made for an upper that does not exist.
 *
 * The owner's rule, in his words: fibre and bottom work is only ever done on
 * uppers that are already made. You cannot fit a sole to nothing.
 *
 * The app never knew this. createFactoryWork checks the item, the stage, the
 * colour and the size, and would have accepted sixty bottoms of a shoe whose
 * upper had never been cut. It has not happened — every pair in the records was
 * entered upper-first — but nothing stopped it, and once stock posts itself
 * from these entries a bottom-only entry would put pairs in the godown that
 * were never made.
 *
 * Nothing here reads the database. It is the rule on its own, so it can be
 * tested for what it decides rather than through a factory's worth of setup.
 */

/**
 * The stages that are done on an upper, and so cannot run ahead of one.
 *
 * "Fibermen" is the word the workers and the eleven worker records use;
 * "Fiber Preparation" is what lib/factory-stage.ts maps it to for the
 * production ledger. Both spellings arrive here, so both are listed.
 */
const STAGES_ON_AN_UPPER = new Set([
  "Fibermen",
  "Fiber Preparation",
  "Fiber Silai",
  "Bottom Final",
]);

/**
 * Whether this stage may only be recorded against uppers already made.
 *
 * Upper itself is never held back — it is the first stage and has nothing
 * before it, so blocking it would stop the factory. Packing / QC counts pairs
 * that already exist rather than making them, and Staff work is not on a shoe
 * at all; neither is held back either.
 */
export function stageNeedingUpperFirst(stage: string | null | undefined) {
  return STAGES_ON_AN_UPPER.has((stage ?? "").trim());
}

/**
 * How many pairs of this bottom run have no upper behind them.
 *
 * The rule is about quantity, not merely order: sixty uppers and eighty bottoms
 * is twenty bottoms for shoes that do not exist, even though the upper came
 * first. Bottoms already recorded count against the same uppers, so a second
 * entry cannot quietly spend them twice.
 *
 * Returns 0 when the run fits — fewer bottoms than uppers is a part-finished
 * batch, which is normal, and the rest follow tomorrow.
 */
export function upperShortfall(counts: {
  /** Pairs recorded at the Upper stage for this item, colour and size run. */
  uppersMade: number;
  /** Bottom-stage pairs already recorded against those same uppers. */
  bottomsAlready: number;
  /** Pairs this new entry wants to record. */
  wanted: number;
}) {
  const room = counts.uppersMade - counts.bottomsAlready;
  const over = counts.wanted - room;
  return over > 0 ? over : 0;
}
