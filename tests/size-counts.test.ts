import { describe, expect, it } from "vitest";
import {
  compactSizeRun,
  countsFromSizeRun,
  sizeCountsLabel,
  sizeCountsTotal,
  sizeRunKey,
  normaliseSizeCounts,
} from "@/lib/shoe-sizes";

/**
 * Two problems the owner found on the same screen, and they are one problem.
 *
 * The first is visible: putting the size on a dropdown option takes the label
 * from 32 characters to 57 — "bachha sandil — 60 Black · 25, 26, 27, 28, 29, 30
 * waiting" — and a phone dropdown holds about 32 to 38. The option wraps to two
 * lines and the list stops being scannable.
 *
 * The second is not visible at all, and is the larger of the two. The owner
 * asked how to record a run of 36–41 where 38 was made twice and every other
 * size once. There is nowhere to put it: `factory_daily_work.size` is one piece
 * of text and `pairs_count` is one total, so the live rows read
 * `{"36/41": 60}` — six sizes and a number, with no way to say which size the
 * extra pair belongs to. Seven pairs across six sizes and six pairs across six
 * sizes are stored identically.
 *
 * Both answers live here. Compacting is what buys the room on the option;
 * per-size counts are what the room is spent on.
 */

describe("compactSizeRun", () => {
  it("shortens a full consecutive run to its two ends", () => {
    // 22 characters become 5. This is the whole reason the size fits on the
    // option at all: without it the label is 57 characters and wraps.
    expect(compactSizeRun("25, 26, 27, 28, 29, 30")).toBe("25-30");
    expect(compactSizeRun("36, 37, 38, 39, 40, 41")).toBe("36-41");
  });

  it("writes the runs typed as a range the same way", () => {
    // "36/41" and "36, 37, ... 41" are one run written two ways, and both are
    // in the factory's records today. They must compact to one string or the
    // dropdown shows the same shoe as two different things.
    expect(compactSizeRun("36/41")).toBe("36-41");
    expect(compactSizeRun("36-41")).toBe("36-41");
    expect(compactSizeRun("36 to 41")).toBe("36-41");
  });

  it("leaves a run with gaps exactly as it was written", () => {
    // The dangerous case. 37 and 39 were never made, so "36-40" would claim
    // five sizes where three exist — a shorter label that lies. Better to run
    // long than to invent a pair the factory has to find later.
    expect(compactSizeRun("36, 38, 40")).toBe("36, 38, 40");
  });

  it("keeps a single size as itself", () => {
    expect(compactSizeRun("38")).toBe("38");
  });

  it("stays blank when there is no size", () => {
    // Blank must not become a wildcard; "Mixed" is what the app writes when no
    // size was given and it is not a run.
    expect(compactSizeRun("")).toBe("");
    expect(compactSizeRun(null)).toBe("");
    expect(compactSizeRun("Mixed")).toBe("Mixed");
  });

  it("compacts only the sizes, so a two-size run is not written as a range", () => {
    // "36-37" is no shorter than "36, 37" and reads as a longer run than it is.
    expect(compactSizeRun("36, 37")).toBe("36, 37");
  });
});

describe("countsFromSizeRun", () => {
  it("spreads a total evenly when it divides", () => {
    // Sixty pairs over six sizes is ten of each — the shop's ordinary case,
    // and what every one of today's rows means by `{"36/41": 60}`.
    expect(countsFromSizeRun("36, 37, 38, 39, 40, 41", 60)).toEqual({
      "36": 10, "37": 10, "38": 10, "39": 10, "40": 10, "41": 10,
    });
  });

  it("gives the remainder to the smallest sizes, never losing a pair", () => {
    // Sixty-two over six cannot be even. What matters is that the parts add
    // back to the whole: a wage is paid on the total, and a breakdown that
    // sums to 60 when 62 were made is a missing pair in the ledger.
    const counts = countsFromSizeRun("36, 37, 38, 39, 40, 41", 62);
    expect(sizeCountsTotal(counts)).toBe(62);
    expect(counts["36"]).toBe(11);
    expect(counts["41"]).toBe(10);
  });

  it("puts everything on the one size when only one was made", () => {
    expect(countsFromSizeRun("38", 7)).toEqual({ "38": 7 });
  });

  it("returns nothing for a blank run rather than inventing a size", () => {
    expect(countsFromSizeRun("", 60)).toEqual({});
    expect(countsFromSizeRun("Mixed", 60)).toEqual({});
  });
});

describe("normaliseSizeCounts", () => {
  it("drops the sizes with nothing made in them", () => {
    // An empty box is not a zero-pair size; it is a size this entry did not
    // touch. Storing it would put "38: 0" in the ledger for ever.
    expect(normaliseSizeCounts({ "36": 1, "37": 0, "38": 2 })).toEqual({ "36": 1, "38": 2 });
  });

  it("refuses a negative count", () => {
    expect(normaliseSizeCounts({ "36": -3, "38": 2 })).toEqual({ "38": 2 });
  });

  it("reads a typed count that arrived as text", () => {
    // The boxes are inputs; their values are strings.
    expect(normaliseSizeCounts({ "36": "1", "38": "2" })).toEqual({ "36": 1, "38": 2 });
  });

  it("ignores a count that is not a number at all", () => {
    expect(normaliseSizeCounts({ "36": "abc", "38": 2 })).toEqual({ "38": 2 });
  });
});

describe("sizeCountsTotal", () => {
  it("adds the boxes up, which is what the pair count becomes", () => {
    // The owner's own example: 36–41 with 38 made twice is seven pairs, not
    // six and not sixty. This sum is what the wage is paid on.
    expect(sizeCountsTotal({ "36": 1, "37": 1, "38": 2, "39": 1, "40": 1, "41": 1 })).toBe(7);
  });

  it("is zero when nothing has been entered", () => {
    expect(sizeCountsTotal({})).toBe(0);
  });
});

describe("sizeCountsLabel", () => {
  it("names only the sizes made more than once", () => {
    // The point of the label. Six sizes at one pair each needs no explaining;
    // the one size with two is the entire thing a person needs to see, and
    // spelling out all six would take the label back over the phone's width.
    expect(sizeCountsLabel({ "36": 1, "37": 1, "38": 2, "39": 1, "40": 1, "41": 1 }))
      .toBe("38×2");
  });

  it("is blank when every size was made the same number of times", () => {
    // Ten of each is the ordinary run. A label there would be noise on every
    // single entry the factory makes.
    expect(sizeCountsLabel({ "36": 10, "37": 10, "38": 10 })).toBe("");
    expect(sizeCountsLabel({ "36": 1, "37": 1 })).toBe("");
  });

  it("names more than one uneven size", () => {
    expect(sizeCountsLabel({ "36": 1, "37": 3, "38": 2 })).toBe("37×3, 38×2");
  });

  it("is blank for an empty breakdown", () => {
    expect(sizeCountsLabel({})).toBe("");
  });
});

/**
 * The counts and the size text must never drift apart.
 *
 * `size` is what every existing screen, the ready list and the save guard all
 * match on, and `sizeRunKey` is how they compare it. If the boxes say 36, 38
 * and 40 while the text still says "36-41", the guard matches a run the entry
 * did not make.
 */
describe("the counts and the size text agree", () => {
  it("the sizes with pairs in them are the sizes the text names", () => {
    const counts = normaliseSizeCounts({ "36": 1, "37": 1, "38": 2, "39": 1, "40": 1, "41": 1 });
    const sizes = Object.keys(counts).sort((a, b) => Number(a) - Number(b));

    expect(sizeRunKey(sizes.join(", "))).toBe(sizeRunKey("36-41"));
  });

  it("a run with a size left empty no longer keys as the whole range", () => {
    // Leaving 38 blank means 38 was not made. The key must change, or the
    // guard goes on treating this as a full 36–41 run.
    const counts = normaliseSizeCounts({ "36": 1, "37": 1, "38": 0, "39": 1, "40": 1, "41": 1 });
    const sizes = Object.keys(counts).sort((a, b) => Number(a) - Number(b));

    expect(sizeRunKey(sizes.join(", "))).not.toBe(sizeRunKey("36-41"));
  });
});
