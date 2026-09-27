import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The pair count and the wage it decides are read together.
 *
 * "60" once had the full width of the form while the wage sat underneath in
 * small text; then the two shared a row. With the 2026-09-27 layout every box
 * on the form is one size on one grid — the owner's "boxes do not line up" —
 * so the wage is the line directly under the pair count, and on the Save
 * button itself: sixty pairs at ten rupees IS six hundred, and changing the
 * count moves the money in both places.
 *
 * What must not be lost: the count stays legible from arm's length on a
 * workshop phone, the step buttons stay big enough to hit with a thumb, and a
 * phone still gets one box per line.
 */
const FORM = "app/admin/factory/add-work/WorkEntryForm.tsx";

function code(form: string) {
  return form.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("the wage beside the count", () => {
  it("writes the wage directly under the pair count", async () => {
    const source = code(await readFile(FORM, "utf8"));
    const pairsAt = source.indexOf('🔢 {text("Number of pairs"');
    expect(pairsAt, "the pairs label moved").toBeGreaterThan(0);

    const below = source.slice(pairsAt, pairsAt + 3000);
    expect(below).toMatch(/text\("Wage", "ज्याला"\)/);
    expect(below).toContain("money(calculatedAmount)");
    expect(below, "the per-pair rate stays beside it").toMatch(/Rs\. \$\{selectedRate\}\/pair/);
  });

  it("puts the wage on the Save button too", async () => {
    const source = code(await readFile(FORM, "utf8"));
    const save = source.slice(source.indexOf('type="submit"'));
    expect(save.slice(0, 1500)).toContain("money(calculatedAmount)");
  });
});

describe("what the smaller box must not cost", () => {
  it("keeps the number large enough to read across a workbench", async () => {
    const source = code(await readFile(FORM, "utf8"));
    const input = source.slice(source.indexOf("onChange={handlePairsChange}"));
    expect(input.length, "the pairs input moved").toBeGreaterThan(0);
    expect(input.slice(0, 600), "the digits stay large").toMatch(/text-2xl/);
  });

  it("keeps the step buttons thumb-sized", async () => {
    const source = code(await readFile(FORM, "utf8"));
    const minus = source.slice(source.indexOf("stepPairs(-PAIRS_STEP)"));
    const size = minus.slice(0, 700).match(/\bh-(\d+)\b/);
    expect(size, "the minus button lost its height").not.toBeNull();
    // 11 = 44px, the smallest a thumb target may be.
    expect(Number(size?.[1])).toBeGreaterThanOrEqual(11);
  });

  it("two boxes a row on a phone, four on a computer", async () => {
    const source = code(await readFile(FORM, "utf8"));
    // Two narrow boxes side by side on a phone (the owner's sample), four
    // across on a computer; colour, size and Save take a whole row.
    expect(source).toContain('className="grid grid-cols-2 gap-x-3 gap-y-3 sm:gap-x-4 xl:grid-cols-4"');
    expect((source.match(/className="col-span-2 min-w-0"/g) ?? []).length).toBe(3);
  });
});
