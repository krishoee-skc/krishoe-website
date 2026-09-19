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
      /stage\s*===\s*"Upper"\)\s*running\.pairs\s*\+=\s*pairs/,
    );
    expect(code, "fitted bottoms are taken off").toMatch(
      /stageNeedingUpperFirst\(stage\)\)\s*running\.pairs\s*-=\s*pairs/,
    );
    // And a run with nothing left is dropped rather than shown as waiting.
    expect(code, "spent runs are dropped").toMatch(/run\.pairs\s*<=\s*0/);
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

/**
 * The count on the option and the count in the guard must agree.
 *
 * The option adds up every upper of a shoe regardless of colour or size; the
 * save guard counts only the uppers matching the colour and size run being
 * entered. While each shoe is made in one colour those are the same number, and
 * they are today — no item in the factory's records has two.
 *
 * They stop being the same the day one does. Sixty black uppers and forty
 * cherry would show "100 uppers waiting" on the option and warn at sixty on the
 * save: the screen saying one thing and the save saying another, about the same
 * pairs, on the same click.
 *
 * So the option carries the split rather than a total. With one colour it reads
 * exactly as before; with two it names them, which is also the answer to "which
 * colour are those sixty" — the question the total could never answer.
 */
describe("the option and the guard count the same pairs", () => {
  it("groups the count by colour and size, not by item alone", async () => {
    const page = await readFile(PAGE, "utf8");

    // The guard matches on item, colour and size run together. A total across
    // colours cannot agree with it.
    expect(page, "colour must be read").toMatch(/work\.color/);
    expect(page, "size must be read").toMatch(/work\.size/);
  });

  it("uses the same two keys the guard uses", async () => {
    const page = await readFile(PAGE, "utf8");

    // Asserted as the key the grouping is built from, not as the presence of
    // the words: reverting to `key = row.item_id` leaves both imports in place,
    // so a name check passes on exactly the bug it exists to catch.
    //
    // "Black" and "black" are one colour to the guard; they must be one here
    // too, or the option splits a single batch into two half-sized ones.
    expect(page, "the group key must carry all three").toMatch(
      /key\s*=\s*`\$\{row\.item_id\}[\s\S]{0,40}colourKey\([\s\S]{0,40}sizeRunKey\(/,
    );
  });

  it("names the colour, which a total never could", async () => {
    const form = await readFile(FORM, "utf8");

    // The owner's question: sixty uppers are waiting — which colour? A single
    // number cannot say, and the entry that follows has to name one.
    expect(form).toMatch(/waitingRuns|uppersWaitingBy/);
  });
});
