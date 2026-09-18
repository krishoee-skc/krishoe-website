import { describe, expect, it } from "vitest";
import { sizeRunKey, sameSizeRun, expandSizeRun } from "@/lib/shoe-sizes";

/**
 * One set of sizes, however it was typed.
 *
 * The same run reaches this app in three shapes, and all three are in the
 * factory's own records right now:
 *
 *   36/41                      — typed on the Upper entry
 *   36, 37, 38, 39, 40, 41     — tapped from the size chips on the Fibermen one
 *   36-41                      — the dash a phone keyboard offers first
 *
 * A person reads those as one thing. The app reads them as three, which is why
 * bagopen's Upper and Fibermen entries cannot be matched to each other: sixty
 * uppers in "36/41" and sixty bottoms in "36, 37, 38, 39, 40, 41" look like two
 * unrelated batches, and the pairs they finish cannot be posted to stock
 * automatically.
 *
 * This is the first of the two keys that make that matching possible — the
 * other is colour. Neither invents a number: 36/42 and 36/41 stay different,
 * because they are.
 */

describe("the same run written three ways", () => {
  it("reads 36/41, 36-41 and the full list as one run", () => {
    const slash = sizeRunKey("36/41");
    const dash = sizeRunKey("36-41");
    const list = sizeRunKey("36, 37, 38, 39, 40, 41");

    expect(slash).toBe(dash);
    expect(slash).toBe(list);
    expect(sameSizeRun("36/41", "36, 37, 38, 39, 40, 41")).toBe(true);
  });

  it("ignores spacing and stray punctuation", () => {
    expect(sameSizeRun(" 36 / 41 ", "36/41")).toBe(true);
    expect(sameSizeRun("36,37,38,39,40,41", "36, 37, 38, 39, 40, 41")).toBe(true);
    expect(sameSizeRun("36 , 37,38 , 39,40,41", "36-41")).toBe(true);
  });

  it("does not sort text: 10 comes after 9, never before", () => {
    // Plain string sorting puts "10" before "9", which would make a youth run
    // read as starting at ten.
    expect(sizeRunKey("9, 10, 11")).toBe(sizeRunKey("9-11"));
  });
});

describe("runs that are genuinely different stay different", () => {
  it("keeps 36/42 apart from 36/41", () => {
    // fom close shoes really was made 36–42 on the upper and 36–41 on the
    // bottom. Treating those as one would post a pair that does not exist.
    expect(sameSizeRun("36/42", "36/41")).toBe(false);
  });

  it("keeps a gap apart from a full range", () => {
    // 36, 38, 40 is not 36–40: two sizes were never made.
    expect(sameSizeRun("36, 38, 40", "36-40")).toBe(false);
  });

  it("treats blank as its own thing, not as everything", () => {
    expect(sameSizeRun("", "36/41")).toBe(false);
    expect(sizeRunKey("")).toBe("");
    // "Mixed" is what the app writes when no size was given. It must not
    // silently match a real run.
    expect(sameSizeRun("Mixed", "36/41")).toBe(false);
  });
});

describe("expanding a run into its sizes", () => {
  it("turns 36/41 into every size in it", () => {
    expect(expandSizeRun("36/41")).toEqual(["36", "37", "38", "39", "40", "41"]);
  });

  it("leaves a list as the sizes it names", () => {
    expect(expandSizeRun("36, 38, 40")).toEqual(["36", "38", "40"]);
  });

  it("keeps a non-numeric size rather than dropping it", () => {
    // "Free" is a real size on some sandals; losing it would lose the pairs.
    expect(expandSizeRun("Free")).toEqual(["Free"]);
  });

  it("gives nothing back for nothing", () => {
    expect(expandSizeRun("")).toEqual([]);
    expect(expandSizeRun("Mixed")).toEqual(["Mixed"]);
  });
});
