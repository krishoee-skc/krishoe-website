import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { countsFromSizeRun, sizeCountsTotal } from "@/lib/shoe-sizes";

/**
 * A box per size, so the odd one out can be written down.
 *
 * The owner's question was how to record a 36-41 run where 38 was made twice.
 * One total and one piece of text cannot say it, so the screen asks the way the
 * question is asked: a small box under each size, and the total adds itself up.
 *
 * The boxes open pre-filled from the run rather than empty. Sixty over six
 * sizes is ten of each, which is what every row in the factory already means,
 * so the ordinary entry is still no typing at all — and the uneven one is a
 * single box to change.
 *
 * The total is not typed while they are open. Two numbers for one quantity is
 * how a breakdown ends up disagreeing with the wage it was paid on.
 */
const FORM = "app/admin/factory/add-work/WorkEntryForm.tsx";

describe("what the boxes start with", () => {
  it("shares the run out evenly, which is what today's entries mean", () => {
    // Every row in the factory reads "60 pairs, 36/41" and has always meant
    // ten of each. The boxes open saying exactly that, so nothing is retyped
    // to record what was already true.
    expect(countsFromSizeRun("36, 37, 38, 39, 40, 41", 60)).toEqual({
      "36": 10, "37": 10, "38": 10, "39": 10, "40": 10, "41": 10,
    });
  });

  it("never loses a pair when the run does not divide", () => {
    const counts = countsFromSizeRun("36, 37, 38, 39, 40, 41", 62);
    expect(sizeCountsTotal(counts)).toBe(62);
  });

  it("opens from the size run however it was written", () => {
    // "36/41" is how most of the factory's uppers are recorded, and the boxes
    // have to appear for it just as they do for the spelled-out run.
    expect(Object.keys(countsFromSizeRun("36/41", 60))).toHaveLength(6);
  });
});

describe("the screen", () => {
  it("shows a box for each size in the run", async () => {
    const form = await readFile(FORM, "utf8");
    const code = form.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    expect(code, "the boxes must be built from the chosen sizes").toMatch(
      /sizeCounts|countsFromSizeRun/,
    );
  });

  it("adds the boxes up rather than asking for the total twice", async () => {
    const form = await readFile(FORM, "utf8");
    const code = form.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // Asserted on the payload the save builds, not on the file: the helper is
    // called elsewhere on this screen too, so a looser check passes on a
    // version that shows the boxes and still sends the separately typed total
    // — the disagreement this whole change exists to remove.
    const payload = code.slice(code.indexOf("const entry = {"), code.indexOf("const keyScope"));
    expect(payload.length, "the payload moved").toBeGreaterThan(0);
    expect(payload, "the total must come from the boxes").toMatch(
      /pairs_count:\s*hasCounted\s*\?\s*String\(sizeCountsTotal\(counted\)\)/,
    );
  });

  it("sends the counts with the entry", async () => {
    const form = await readFile(FORM, "utf8");
    const code = form.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // The API reads body.size_counts. Boxes that are filled in and not sent
    // are boxes that do nothing — and the field name appears in the failure
    // path too, so this looks only at what is sent.
    const payload = code.slice(code.indexOf("const entry = {"), code.indexOf("const keyScope"));
    expect(payload, "the counts must be in the request body").toMatch(
      /size_counts:\s*counted/,
    );
  });

  it("gives every box a label a screen reader can read", async () => {
    const form = await readFile(FORM, "utf8");

    // Six unlabelled number boxes in a row are six identical boxes to anyone
    // not looking at the screen.
    expect(form).toMatch(/aria-label=\{[^}]*(size|साइज)/i);
  });
});
