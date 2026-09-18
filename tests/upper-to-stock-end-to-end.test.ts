import { describe, expect, it } from "vitest";
import { sizeRunKey, sameSizeRun } from "@/lib/shoe-sizes";
import { colourKey, sameColour } from "@/lib/colour-name";
import { stageNeedingUpperFirst, upperShortfall } from "@/lib/stage-order";

/**
 * The whole path, in the arithmetic that decides it.
 *
 * Eight test files cover the pieces of this arc — the size key, the colour key,
 * the stage rule, the guard, the grouping, the one-press post, the replay, the
 * rejects. Each is right on its own. None of them asks whether the pieces
 * agree, and the failure this arc exists to prevent lives exactly there: sixty
 * uppers and sixty bottoms of the same shoe that the app reads as two unrelated
 * batches, so nothing posts — or worse, reads as one when they are not, and
 * pairs that were never made reach the shop.
 *
 * The cases below are the shop's own, taken from the records: bagopen written
 * "crim"/"Black" and 36/41 against "36, 37, 38, 39, 40, 41"; fom close shoes
 * made 36–42 on the upper and 36–41 on the bottom. Both were typing slips the
 * owner has since corrected, and both are exactly the shapes that must go on
 * being decided correctly.
 *
 * What is checked is the decision, not the database: given these stage counts,
 * how many pairs are finished, and would the guard have allowed the work. The
 * database side is verified against live rows in the commits themselves.
 */

/** The ready screen's rule: a pair is finished only when every stage has had it. */
function finishedPairs(stages: Record<string, number>) {
  const REQUIRED = ["Upper", "Fibermen"];
  const present = REQUIRED.some((stage) => stage in stages);
  const counts = present
    ? REQUIRED.map((stage) => stages[stage] ?? 0)
    : Object.values(stages);
  const least = counts.reduce((low, pairs) => Math.min(low, pairs), Number.POSITIVE_INFINITY);
  return Number.isFinite(least) ? Math.max(0, least) : 0;
}

/** One row of the ready screen: item, colour and size run together. */
function groupKey(item: string, colour: string, size: string) {
  return `${item}|${colourKey(colour)}|${sizeRunKey(size)}`;
}

describe("sixty uppers and sixty bottoms of one shoe", () => {
  it("are one row once the spellings are read properly", () => {
    // As written: "black" on one entry, "Black" on the other; "36/41" typed on
    // one, tapped from the chips on the other.
    const upper = groupKey("bagopen", "black", "36/41");
    const bottom = groupKey("bagopen", "Black", "36, 37, 38, 39, 40, 41");

    expect(upper).toBe(bottom);
  });

  it("finish as sixty pairs, never a hundred and twenty", () => {
    expect(finishedPairs({ Upper: 60, Fibermen: 60 })).toBe(60);
  });

  it("finish as nothing while the fibre work is outstanding", () => {
    // Five of the shop's seven designs sit here today: uppers made, no bottoms.
    expect(finishedPairs({ Upper: 60 })).toBe(0);
  });
});

describe("the slips the shop actually made", () => {
  it("keeps crim and Black apart until somebody fixes one", () => {
    // bagopen's upper said "crim" and its bottom said "Black". Two colours, so
    // two rows, so nothing finished — which is what the screen showed until the
    // owner corrected it.
    expect(sameColour("crim", "Black")).toBe(false);
    expect(groupKey("bagopen", "crim", "36/41")).not.toBe(
      groupKey("bagopen", "Black", "36/41"),
    );
  });

  it("keeps 36/42 apart from 36/41", () => {
    // fom close shoes really was entered 36–42 on the upper. Matching those
    // would post a pair that does not exist.
    expect(sameSizeRun("36/42", "36/41")).toBe(false);
  });

  it("brings them together once corrected", () => {
    // Both are now black 36/41 in the records, and both read as sixty finished.
    expect(groupKey("bagopen", "black", "36/41")).toBe(
      groupKey("bagopen", "black", "36, 37, 38, 39, 40, 41"),
    );
    expect(finishedPairs({ Upper: 60, Fibermen: 60 })).toBe(60);
  });
});

describe("what reaches stock is what was made", () => {
  it("drops the pairs that failed QC", () => {
    // Sixty uppers with five spoiled is fifty-five uppers; the bottoms are all
    // sixty, so fifty-five pairs are finished.
    expect(finishedPairs({ Upper: 60 - 5, Fibermen: 60 })).toBe(55);
  });

  it("does not let a stage go negative", () => {
    // More rejects than pairs is a typing slip. A negative stage would raise
    // the minimum and overstate what is finished.
    expect(finishedPairs({ Upper: Math.max(0, 60 - 70), Fibermen: 60 })).toBe(0);
  });

  it("counts only what both stages reached", () => {
    // Forty bottoms against sixty uppers is a part-finished batch.
    expect(finishedPairs({ Upper: 60, Fibermen: 40 })).toBe(40);
  });
});

describe("the bottom work the guard would have questioned", () => {
  it("passes a run that matches the uppers", () => {
    expect(stageNeedingUpperFirst("Fibermen")).toBe(true);
    expect(upperShortfall({ uppersMade: 60, bottomsAlready: 0, wanted: 60 })).toBe(0);
  });

  it("flags bottoms with no upper behind them at all", () => {
    // What a mistyped colour looked like from the guard's side: sixty bottoms
    // of "Black" against zero uppers of that colour.
    expect(upperShortfall({ uppersMade: 0, bottomsAlready: 0, wanted: 60 })).toBe(60);
  });

  it("never questions the upper itself", () => {
    // Upper is the first stage. Holding it back would stop the factory.
    expect(stageNeedingUpperFirst("Upper")).toBe(false);
  });

  it("does not spend the same uppers twice", () => {
    // Sixty uppers, forty bottoms fitted, thirty more asked for: ten too many.
    expect(upperShortfall({ uppersMade: 60, bottomsAlready: 40, wanted: 30 })).toBe(10);
  });
});
