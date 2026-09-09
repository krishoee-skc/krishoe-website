import { describe, expect, it } from "vitest";
import {
  SIZE_RUNS,
  addRun,
  productSizes,
  runForSizes,
  sizeRunLabel,
  sizesInRun,
  toggleSize,
} from "@/lib/shoe-sizes";

/**
 * The sizes offered when a day's work is entered.
 *
 * The screen used to offer 6–10 while every shoe in the shop ran 36–41, so the
 * clerk typed the size by hand every time — which is how "36/42" and "36/41"
 * both ended up in the same column.
 */
describe("the runs this shop makes shoes in", () => {
  it("covers children, youth and adults without a gap", () => {
    expect(SIZE_RUNS.map((run) => [run.from, run.to])).toEqual([
      [25, 30],
      [31, 35],
      [36, 41],
    ]);

    // A gap between runs would be a size nobody could tap.
    for (let index = 1; index < SIZE_RUNS.length; index += 1) {
      expect(SIZE_RUNS[index].from).toBe(SIZE_RUNS[index - 1].to + 1);
    }
  });

  it("fills a whole run in one tap", () => {
    expect(sizesInRun({ from: 25, to: 30 })).toEqual(["25", "26", "27", "28", "29", "30"]);
    expect(sizesInRun({ from: 36, to: 41 })).toHaveLength(6);
  });

  it("names a run in both languages", () => {
    const adult = SIZE_RUNS[2];
    expect(sizeRunLabel(adult, false)).toBe("Adult 36–41");
    expect(sizeRunLabel(adult, true)).toBe("ठूलो 36–41");
  });
});

describe("the sizes a product carries", () => {
  it("puts them in number order, not text order", () => {
    // Sorted as text, "10" comes before "9" — which is how a size list ends up
    // looking shuffled on screen.
    expect(productSizes(["9", "10", "8"])).toEqual(["8", "9", "10"]);
    expect(productSizes(["41", "36", "38"])).toEqual(["36", "38", "41"]);
  });

  it("drops blanks and repeats", () => {
    expect(productSizes(["36", " ", "36", "37", ""])).toEqual(["36", "37"]);
  });

  it("keeps a size that is not a number, after the ones that are", () => {
    expect(productSizes(["Free", "37", "36"])).toEqual(["36", "37", "Free"]);
  });

  it("reads nothing as nothing", () => {
    expect(productSizes(null)).toEqual([]);
    expect(productSizes(undefined)).toEqual([]);
    expect(productSizes([])).toEqual([]);
  });

  it("recognises which run a product belongs to", () => {
    expect(runForSizes(["36", "37", "38", "39", "40"])?.en).toBe("Adult");
    expect(runForSizes(["25", "26", "27"])?.en).toBe("Kids");
  });

  it("says nothing for sizes that straddle two runs", () => {
    // 30 and 31 are in different runs, so no single run describes them —
    // better to say nothing than to name the wrong one.
    expect(runForSizes(["30", "31"])).toBeNull();
    expect(runForSizes([])).toBeNull();
  });
});

describe("choosing sizes on the form", () => {
  it("adds a size in its place, not on the end", () => {
    // Tapping 36 after 38 should read "36, 38" — a list in the order it was
    // tapped reads as a mistake.
    expect(toggleSize("38, 40", "36")).toBe("36, 38, 40");
  });

  it("takes a size back off when it is tapped again", () => {
    expect(toggleSize("36, 37, 38", "37")).toBe("36, 38");
  });

  it("starts from nothing", () => {
    expect(toggleSize("", "36")).toBe("36");
  });

  it("fills a whole run without disturbing what is already chosen", () => {
    expect(addRun("41", { from: 36, to: 38 })).toBe("36, 37, 38, 41");
  });

  it("does not repeat a size already chosen when filling a run", () => {
    expect(addRun("36, 37", { from: 36, to: 38 })).toBe("36, 37, 38");
  });
});
