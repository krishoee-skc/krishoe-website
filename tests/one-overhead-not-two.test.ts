import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { overheadPerPair } from "@/lib/costing";
import type { CostingSettings } from "@/lib/costing-settings";

/**
 * The costing screen shows the overhead the costing engine uses.
 *
 * The page carried its own copy of overheadPerPair — the same five terms added
 * the same way — and the two had already drifted apart. `lib/costing.ts` rounds
 * the result to the paisa and returns 0 for a non-finite one; the page's copy
 * did neither.
 *
 * So the card read 61.10933333333334 where every figure beside it had been
 * computed from 61.11, and a settings form with one field still empty printed
 * NaN on the screen where the library would have shown 0. Nobody had entered a
 * wrong number: the screen was simply doing its own arithmetic.
 *
 * A duplicated calculation is not wrong on the day it is copied. It is wrong on
 * the day one of the two is fixed — and the fix, roundRate, had already landed
 * on one side only.
 *
 * Two of these run the real function, because a source-text check alone cannot
 * tell whether the number is right; the source check is what stops a second
 * copy appearing again.
 */

const PAGE = "app/admin/costing/page.tsx";

// Deliberately awkward numbers: they are what make the rounding visible.
function settings(overrides: Partial<CostingSettings> = {}): CostingSettings {
  return {
    factoryOverheadPerPair: 12.333,
    electricityPerPair: 4.777,
    rentPerPair: 8.555,
    miscellaneousPerPair: 2.111,
    monthlyFixedOverhead: 100000,
    monthlyCapacityPairs: 3000,
    ...overrides,
  } as CostingSettings;
}

describe("the overhead per pair", () => {
  it("is rounded to the paisa, not carried to fourteen places", () => {
    // 12.333 + 4.777 + 8.555 + 2.111 + (100000/3000) = 61.10933333333334.
    // The screen has to agree with the rows underneath it.
    expect(overheadPerPair(settings())).toBe(61.11);
  });

  it("is a number even when the settings form is half filled", () => {
    // An empty field parses to NaN. The library answers 0; the page's copy
    // printed "NaN" to the owner.
    expect(overheadPerPair(settings({ factoryOverheadPerPair: Number.NaN }))).toBe(0);
  });

  it("allocates the monthly overhead only when a capacity is set", () => {
    // Dividing by zero capacity is the other way this reaches the screen as a
    // non-number.
    expect(overheadPerPair(settings({ monthlyCapacityPairs: 0 }))).toBe(27.78);
  });
});

describe("the costing screen", () => {
  it("takes the overhead from the costing library", async () => {
    const source = await readFile(PAGE, "utf8");

    expect(source, "the screen must import the one calculation").toMatch(
      /import \{[\s\S]*?\boverheadPerPair\b[\s\S]*?\} from "@\/lib\/costing"/,
    );
  });

  it("does not define an overhead of its own", async () => {
    const source = await readFile(PAGE, "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // The copy is how the two drifted. A screen may read this number; it may
    // not work it out.
    expect(code, "a second copy is how the figures drift apart").not.toMatch(
      /function overheadPerPair\b/,
    );
  });
});
