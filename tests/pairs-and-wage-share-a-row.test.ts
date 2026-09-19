import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The pair count and the wage sit side by side.
 *
 * "60" was given the full width of the form — about 450px for two characters —
 * while the wage it decides sat underneath it in small text. The owner asked
 * for that space back.
 *
 * The wage is what goes there, not the colour or the size: both of those carry
 * a row of chips above a text box and do not fit half a line on a phone, and
 * the QC box is left blank most days, so promoting it would show an empty field
 * on every entry. The wage is one short line, and it is the same fact as the
 * pair count — sixty pairs at forty rupees IS two thousand four hundred. Put
 * together, changing the count shows the money change beside it.
 *
 * What must not be lost in the move: the count stays legible from arm's length
 * on a workshop phone, and the step buttons stay big enough to hit with a
 * thumb.
 */
const FORM = "app/admin/factory/add-work/WorkEntryForm.tsx";

/** The smallest a touch target may be, in Tailwind's 4px steps. 11 = 44px. */
const MIN_TOUCH_STEP = 11;

describe("the row they share", () => {
  it("puts the pair count and the wage in one grid", async () => {
    const form = await readFile(FORM, "utf8");
    const code = form.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // Asserted as the grid wrapping both, not as the words appearing: the file
    // already contains other two-column grids, so a loose check passes on the
    // stacked layout this replaces.
    const pairsAt = code.indexOf('🔢 {text("Number of pairs"');
    expect(pairsAt, "the pairs label moved").toBeGreaterThan(0);

    const before = code.slice(Math.max(0, pairsAt - 400), pairsAt);
    expect(before, "pairs must open a two-column grid").toMatch(/sm:grid-cols-2/);
  });

  it("keeps the wage where the eye already is", async () => {
    const form = await readFile(FORM, "utf8");
    const code = form.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // The wage still reads from the same number; only its place changed.
    expect(code).toMatch(/calculatedAmount\.toLocaleString\(\)/);
    expect(code, "the per-pair rate stays beside it").toMatch(/at Rs\. \$\{selectedRate\}\/pair/);
  });

  it("gives the wage its own label, in both languages", async () => {
    const form = await readFile(FORM, "utf8");

    // Sitting beside the pair count it is a field of its own, and an unlabelled
    // number next to a labelled one reads as part of it.
    expect(form).toMatch(/text\("Wage", "ज्याला"\)/);
  });
});

describe("what the smaller box must not cost", () => {
  it("keeps the number large enough to read across a workbench", async () => {
    const form = await readFile(FORM, "utf8");
    const code = form.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // The count is read at arm's length while counting shoes. Shrinking the box
    // is fine; shrinking the digits is not.
    const input = code.slice(code.indexOf("onChange={handlePairsChange}"));
    expect(input.length, "the pairs input moved").toBeGreaterThan(0);
    expect(input.slice(0, 600), "the digits stay large").toMatch(/text-2xl/);
  });

  it("keeps the step buttons thumb-sized", async () => {
    const form = await readFile(FORM, "utf8");
    const code = form.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // A narrower row is not a reason to make − and + harder to hit on a phone
    // held in a workshop.
    const minus = code.slice(code.indexOf("stepPairs(-PAIRS_STEP)"));
    const classes = minus.slice(0, 700);
    const size = classes.match(/min-h-(\d+)/);
    expect(size, "the minus button lost its minimum height").not.toBeNull();
    expect(Number(size?.[1]), "under 44px is too small for a thumb").toBeGreaterThanOrEqual(
      MIN_TOUCH_STEP,
    );
  });

  it("still stacks on a narrow phone", async () => {
    const form = await readFile(FORM, "utf8");
    const code = form.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    const pairsAt = code.indexOf('🔢 {text("Number of pairs"');
    const before = code.slice(Math.max(0, pairsAt - 400), pairsAt);

    // Two columns from the small breakpoint up, one below it. A grid that is
    // two columns at every width squeezes both fields on a 360px screen.
    //
    // The unprefixed class is what must be absent: `sm:grid-cols-2` contains
    // `grid-cols-2`, so the check has to require that nothing precedes it — a
    // colon before it means it is already behind a breakpoint.
    expect(before, "the second column starts at sm, not at 0").not.toMatch(
      /(?:^|\s)grid-cols-2\b/,
    );
    expect(before, "and it does open two columns at sm").toMatch(/\bsm:grid-cols-2\b/);
  });
});
