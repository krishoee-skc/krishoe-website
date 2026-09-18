import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The warning the app already works out has to reach the person standing there.
 *
 * createFactoryWork counts the uppers behind a bottom entry and puts the
 * shortfall on the response as upper_warning. The API returns the whole result
 * object, so it travels. The screen never looked at it — which makes the check
 * worse than not having one: it counts quietly, saves anyway, and tells nobody.
 *
 * It is a warning, not a refusal — the owner's decision, made after a refusal
 * would have blocked two of the factory's own entries. So it appears beside the
 * success, never instead of it: the work is saved and the wage is earned, and
 * the note says what looked wrong so somebody can check the colour, the size or
 * the count before the day's work is over.
 */
const FORM = "app/admin/factory/add-work/WorkEntryForm.tsx";

describe("the shortfall is shown, not swallowed", () => {
  it("reads the warning off the response", async () => {
    const form = await readFile(FORM, "utf8");

    // The field has travelled from lib/factory-mutations.ts since it was
    // written; nothing on this side ever read it.
    expect(form).toMatch(/upper_warning/);
  });

  it("puts it on screen", async () => {
    const form = await readFile(FORM, "utf8");
    const code = form.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // Held in state and rendered, not merely destructured off the response and
    // dropped — which is the shape this test exists to prevent.
    expect(code).toMatch(/upperWarning/);
    expect(code).toMatch(/setUpperWarning/);
  });

  it("shows it alongside the success, not instead of it", async () => {
    const form = await readFile(FORM, "utf8");
    const code = form.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // The entry saved and the wage is earned. Replacing the success with a
    // warning would read as a failure and send somebody looking for work that
    // is already recorded.
    expect(code, "the success message stays").toMatch(/setSuccess|setMessage/);
    expect(code, "the warning is its own state").toMatch(/setUpperWarning\(/);
  });

  it("clears between entries", async () => {
    const form = await readFile(FORM, "utf8");
    const code = form.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // A warning left over from the last entry would be read as belonging to
    // this one, and the next entry is usually the one that was corrected.
    expect(code).toMatch(/setUpperWarning\(\s*""\s*\)/);
  });
});

describe("what the note looks like", () => {
  it("reads as a caution, not an error", async () => {
    const form = await readFile(FORM, "utf8");

    // Amber, like the other "check this" notes on this screen — red would say
    // the work failed, and it did not.
    const block = form.slice(form.indexOf("upperWarning ?"), form.indexOf("upperWarning ?") + 700);
    expect(block.length, "the warning block moved").toBeGreaterThan(0);
    expect(block).toMatch(/amber/);
  });

  it("wraps rather than truncating on a phone", async () => {
    const form = await readFile(FORM, "utf8");
    const block = form.slice(form.indexOf("upperWarning ?"), form.indexOf("upperWarning ?") + 700);

    // The message names counts and two field names; cut short on a factory
    // phone it would say a number and nothing about what to check.
    expect(block).not.toMatch(/truncate|whitespace-nowrap/);
    expect(block).toMatch(/leading-|text-/);
  });
});
