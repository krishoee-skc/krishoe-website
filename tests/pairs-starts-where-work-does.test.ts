import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The pair count starts at sixty.
 *
 * Every entry this shop has ever made is sixty pairs — nine of nine, no other
 * value has been used. The field started empty, so the number was typed out
 * every time, and the wage below it stayed blank until it was. Starting at
 * sixty means the common case is already correct and the rare one is typed
 * over, which is one action instead of two.
 *
 * The two buttons step by a dozen. A size run is six sizes, so a dozen is two
 * of each and sixty is half a case — the amounts the shop counts in. The
 * browser's own number spinners step by one and are a few pixels tall, which is
 * not a control for a phone held in a workshop.
 */
const FORM = "app/admin/factory/add-work/WorkEntryForm.tsx";

describe("the pair count", () => {
  it("starts at sixty, which is what this shop enters", async () => {
    const form = await readFile(FORM, "utf8");

    expect(form).toContain("const DEFAULT_PAIRS = 60");
    expect(form).not.toContain(`pairs_count: "",`);
  });

  it("goes back to sixty after a save, ready for the next entry", async () => {
    const form = await readFile(FORM, "utf8");

    // Two places hold it: the form's initial state and the reset after a save.
    const matches = form.match(/pairs_count: String\(DEFAULT_PAIRS\)/g) ?? [];
    expect(matches.length).toBe(2);
  });

  it("steps by a dozen, not by one", async () => {
    const form = await readFile(FORM, "utf8");

    expect(form).toContain("const PAIRS_STEP = 12");
    expect(form).toContain("stepPairs(-PAIRS_STEP)");
    expect(form).toContain("stepPairs(PAIRS_STEP)");
  });

  it("never steps below a dozen", async () => {
    const form = await readFile(FORM, "utf8");
    const stepper = form.slice(form.indexOf("const stepPairs"), form.indexOf("const pairsAtFloor"));

    // Zero would only be refused on save, so the button has no reason to reach
    // it.
    expect(stepper).toContain("Math.max(PAIRS_STEP,");
  });

  it("steps from sixty when the box has been cleared", async () => {
    const form = await readFile(FORM, "utf8");
    const stepper = form.slice(form.indexOf("const stepPairs"), form.indexOf("const pairsAtFloor"));

    // An empty field parses to zero, so + landed on 12 instead of near the
    // usual count — and minus sat disabled, because 0 is under the floor.
    expect(stepper).toContain("Number.isFinite(typed) && typed > 0 ? typed : DEFAULT_PAIRS");
  });

  it("lands on a quantity the shop actually makes", async () => {
    const form = await readFile(FORM, "utf8");
    const stepper = form.slice(form.indexOf("const stepPairs"), form.indexOf("const pairsAtFloor"));

    // A hand-typed 5 pressing + gave 17, which fits no size run.
    expect(stepper).toContain("Math.round((from + by) / PAIRS_STEP) * PAIRS_STEP");
  });

  it("only disables minus at the floor itself, not on an empty box", async () => {
    const form = await readFile(FORM, "utf8");

    // `(parseInt(...) || 0) <= 12` was true for an empty field, so clearing the
    // box turned the button off with nowhere to go.
    expect(form).toContain("const pairsAtFloor = parseInt(formData.pairs_count) === PAIRS_STEP");
    expect(form).toContain("disabled={pairsAtFloor}");
  });

  it("recalculates the wage as it steps", async () => {
    const form = await readFile(FORM, "utf8");
    const stepper = form.slice(form.indexOf("const stepPairs"), form.indexOf("const pairsAtFloor"));

    // The figure under the box is the whole point of the box.
    expect(stepper).toContain("setCalculatedAmount");
    expect(stepper).toContain("pieceWage(next, selectedRate)");
  });

  it("names both buttons for a screen reader", async () => {
    const form = await readFile(FORM, "utf8");

    // "−" and "+" alone say nothing aloud.
    expect(form).toContain(`text("Twelve fewer pairs", "बाह्र जोडी घटाउने")`);
    expect(form).toContain(`text("Twelve more pairs", "बाह्र जोडी थप्ने")`);
  });

  it("leaves the field typeable, for a short lot", async () => {
    const form = await readFile(FORM, "utf8");

    // The buttons are a shortcut, not a replacement: a lot of 45 still has to
    // be enterable.
    expect(form).toContain("onChange={handlePairsChange}");
    expect(form).toContain(`inputMode="numeric"`);
  });
});
