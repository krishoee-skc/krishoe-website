import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The product list says how many uppers are waiting.
 *
 * The dropdown offers all sixteen active items with nothing to tell them
 * apart, so choosing a shoe for bottom work is a guess: five of them have sixty
 * uppers waiting, two have had every upper fitted already, and nine have never
 * had an upper cut at all. Picking one of those nine saves the entry, pays the
 * wage, and shows a warning after the fact — which is late, and was invisible
 * until the commit before this one.
 *
 * So the count goes on the option itself, where the choice is made.
 *
 * Only for the stages that sit on an upper. Choosing a shoe for Upper work is
 * the opposite case: an item with no uppers is exactly the one being started,
 * and a "0 waiting" note beside it would read as a problem rather than a new
 * shoe. Hiding those items outright would be worse still — the factory could
 * never begin anything.
 */
const PAGE = "app/admin/factory/add-work/page.tsx";
const FORM = "app/admin/factory/add-work/WorkEntryForm.tsx";

describe("the count that reaches the screen", () => {
  it("is worked out on the server, with the rest of the screen's data", async () => {
    const page = await readFile(PAGE, "utf8");

    // This page already loads workers, items and rates together; a separate
    // fetch from the browser would be a second round trip for one number.
    expect(page).toMatch(/uppersWaiting|uppers_waiting/);
    expect(page).toMatch(/factory_daily_work/);
  });

  it("counts net of rejects, like everything else in this arc", async () => {
    const page = await readFile(PAGE, "utf8");

    // A pair that failed QC is not an upper waiting for a bottom. The ready
    // screen and the save guard both subtract; a third answer here would be a
    // third number for one question.
    expect(page).toMatch(/reject_pairs/);
  });

  it("takes off the bottoms already fitted", async () => {
    const page = await readFile(PAGE, "utf8");
    const code = page.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // Asserted as the subtraction itself. Deleting the bottom branch leaves
    // both words in the file, so a name check passes on the bug: bagopen would
    // read "60 uppers waiting" when every one of them already has a bottom.
    expect(code, "uppers are added").toMatch(
      /stage\s*===\s*"Upper"[\s\S]{0,120}running\s*\+\s*pairs/,
    );
    expect(code, "fitted bottoms are taken off").toMatch(
      /stageNeedingUpperFirst\(stage\)[\s\S]{0,120}running\s*-\s*pairs/,
    );
  });

  it("excludes reversed work", async () => {
    const page = await readFile(PAGE, "utf8");

    expect(page).toMatch(/Reversed/);
  });
});

describe("what the option shows", () => {
  it("carries the count into the item", async () => {
    const form = await readFile(FORM, "utf8");

    expect(form, "the Item type must hold it").toMatch(/uppersWaiting/);
  });

  it("shows it only for the stages done on an upper", async () => {
    const form = await readFile(FORM, "utf8");
    const code = form.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // Upper work is where a brand-new shoe starts, and "0 waiting" beside it
    // would read as a fault rather than a beginning.
    expect(code).toMatch(/stageNeedingUpperFirst/);
  });

  it("never removes an item from the list", async () => {
    const form = await readFile(FORM, "utf8");
    const code = form.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // Filtering the list would make it impossible to record the first upper of
    // anything — the factory could never start a new design.
    const options = code.slice(code.indexOf("Select a product"), code.indexOf("Select a product") + 900);
    expect(options.length, "the product list moved").toBeGreaterThan(0);
    expect(options, "no item is filtered out").not.toMatch(/items\s*\.filter\(/);
  });
});
