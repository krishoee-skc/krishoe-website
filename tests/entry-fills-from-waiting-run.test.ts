import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { fillFromWaitingRun } from "@/app/admin/factory/add-work/WorkEntryForm";

/**
 * Choosing the shoe fills in the colour and size it is waiting in.
 *
 * The option now says "bachha sandil — 60 Black · 25-30", and then the colour
 * and size boxes below it open empty, to be typed by hand. That gap is where
 * the owner's lost sixty pairs came from: the uppers were made 25-30, the
 * bottom entry was typed 31-35, and the two never matched, so the pairs could
 * not be posted to stock until the size was corrected in the database by hand.
 *
 * The screen already knows the answer — it just printed it on the option. So
 * the fields are filled from the run that is waiting, and stay editable: a
 * person making something genuinely new types over them, and the ordinary case
 * is typed nothing at all.
 *
 * Only for the stages done on an upper. Upper work is where a shoe starts, so
 * there is nothing waiting to copy from, and filling in the previous run's
 * colour would put an answer in a box the person has to think about.
 */
const FORM = "app/admin/factory/add-work/WorkEntryForm.tsx";

const BOTTOM = "Bottom Final";
const UPPER = "Upper";

describe("what the boxes are filled with", () => {
  it("takes the colour and size from the one run that is waiting", () => {
    const filled = fillFromWaitingRun(
      [{ colour: "Black", sizeRun: "25, 26, 27, 28, 29, 30", pairs: 60 }],
      BOTTOM,
    );

    expect(filled).toEqual({ color: "Black", size: "25, 26, 27, 28, 29, 30" });
  });

  it("keeps the size exactly as the uppers were recorded", () => {
    // Not the compacted form. The compacted run is for reading on a one-line
    // option; what goes in the box has to be what the save guard matches on,
    // and "36/41" is how those uppers are actually written down.
    const filled = fillFromWaitingRun([{ colour: "cherry", sizeRun: "36/41", pairs: 60 }], BOTTOM);

    expect(filled.size).toBe("36/41");
  });

  it("fills nothing when two runs are waiting", () => {
    // Two colours waiting is a real choice, and guessing one of them is worse
    // than leaving both boxes empty: the person would have to notice the wrong
    // answer rather than give the right one.
    const filled = fillFromWaitingRun(
      [
        { colour: "Black", sizeRun: "36/41", pairs: 60 },
        { colour: "cherry", sizeRun: "36/41", pairs: 40 },
      ],
      BOTTOM,
    );

    expect(filled).toEqual({ color: "", size: "" });
  });

  it("fills nothing for upper work", () => {
    // An upper is the start of a shoe. There is nothing waiting behind it, and
    // last run's colour is not this run's answer.
    const filled = fillFromWaitingRun(
      [{ colour: "Black", sizeRun: "25-30", pairs: 60 }],
      UPPER,
    );

    expect(filled).toEqual({ color: "", size: "" });
  });

  it("fills nothing when no uppers are waiting", () => {
    expect(fillFromWaitingRun([], BOTTOM)).toEqual({ color: "", size: "" });
  });

  it("ignores a run with no colour on it", () => {
    // Older entries went in before colour was required. An empty colour is not
    // an answer, and putting "" in the box would look like a filled field.
    const filled = fillFromWaitingRun([{ colour: "", sizeRun: "36/41", pairs: 60 }], BOTTOM);

    expect(filled).toEqual({ color: "", size: "" });
  });
});

describe("the form uses it", () => {
  it("fills the boxes when the item is chosen", async () => {
    const form = await readFile(FORM, "utf8");
    const code = form.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // Asserted as the values reaching the form state, not as the call. The bug
    // this replaces is `color: "", size: ""` written there unconditionally —
    // and calling the helper while still writing the blanks passes any check
    // that only looks for the call, leaving the boxes exactly as empty as
    // before.
    const handler = code.slice(code.indexOf("const handleItemChange"));
    expect(handler.length, "the item handler moved").toBeGreaterThan(0);

    const body = handler.slice(0, 900);
    expect(body, "the waiting run must be read").toMatch(/fillFromWaitingRun\(/);
    expect(body, "the colour must come from it").toMatch(/color:\s*filled\.color/);
    expect(body, "the size must come from it").toMatch(/size:\s*filled\.size/);
  });

  it("leaves the boxes editable", async () => {
    const form = await readFile(FORM, "utf8");
    const code = form.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // A filled box that cannot be corrected is worse than an empty one. Only
    // the work-order case locks them, and that was already true.
    expect(code).toMatch(/readOnly=\{Boolean\(selectedWorkOrder\)\}/);
  });
});
