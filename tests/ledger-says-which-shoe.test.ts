import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * A wage row that says which shoe it was for.
 *
 * The piece ledger listed every entry as "work · 60 · +2400.00" and nothing
 * else. The owner could read that santosh had earned Rs. 20,820 and not what he
 * had made for it — and three of one day's five rows were the same item at the
 * same rate, so they were three identical lines with no way to tell whether one
 * was a duplicate.
 *
 * Nothing was missing from the database. The item, colour and size sit on
 * factory_daily_work, and every work row of the ledger already carries
 * source_work_id pointing at it. The ledger just never read them.
 */
const API = "app/api/factory/ledger/route.ts";
const SCREEN = "app/admin/factory/ledger/PieceLedger.tsx";

describe("the ledger reads the work row beside each wage", () => {
  it("joins through the link the save already wrote", async () => {
    const api = await readFile(API, "utf8");

    // source_work_id is written when the work is saved. Matching on worker and
    // date instead would attach the wrong shoe to a day with two entries.
    expect(api).toContain("LEFT JOIN factory_daily_work work ON work.id = balanced.source_work_id");
    expect(api).toContain("LEFT JOIN factory_items items ON items.id = work.item_id");
  });

  it("carries the item, colour, size and rate to the screen", async () => {
    const api = await readFile(API, "utf8");

    expect(api).toContain("items.name AS item_name");
    expect(api).toContain("work.color");
    expect(api).toContain("work.size");
    expect(api).toContain("work.rate_applied");
  });

  it("keeps the running balance in the order it was built", async () => {
    const api = await readFile(API, "utf8");

    // The join must not disturb the ordering the balance was summed in, or
    // every balance below the first row is wrong.
    expect(api).toContain("ORDER BY balanced.created_at ASC, balanced.id ASC");
  });
});

describe("what the owner sees", () => {
  it("gives the shoe its own column", async () => {
    const screen = await readFile(SCREEN, "utf8");

    expect(screen).toContain('text("Item", "के बनायो")');
    expect(screen).toContain("entry.item_name");
  });

  it("shows colour and size under it", async () => {
    const screen = await readFile(SCREEN, "utf8");

    expect(screen).toContain("entry.color");
    expect(screen).toContain("entry.size");
  });

  it("says so when colour and size were left blank", async () => {
    const screen = await readFile(SCREEN, "utf8");

    // Two entries were saved without either. An empty cell reads as a display
    // fault; saying it was not entered points at the entry that needs fixing.
    expect(screen).toContain("colour and size not entered");
  });

  it("shows the rate beside the pairs, because that is the arithmetic", async () => {
    const screen = await readFile(SCREEN, "utf8");

    expect(screen).toContain("entry.rate_applied");
  });

  it("widens the empty row to match the new column count", async () => {
    const screen = await readFile(SCREEN, "utf8");

    // A colSpan left at 7 leaves the "no entries" message short of the table.
    expect(screen).toContain("colSpan={8}");
  });
});

/**
 * The same rows, on a phone.
 *
 * Below 768px a reflow-table row becomes a card and each cell becomes a flex
 * row: the column name on the left, the value pushed right. A cell holding one
 * value reads fine. The item cell holds the shoe over its colour and size, and
 * the pairs cell the count over the rate — as direct flex children those laid
 * out beside the label instead of under one another, squashing three things
 * onto one line on the screen this shop actually uses.
 */
describe("the ledger on a phone", () => {
  it("wraps each stacked cell in one block, so the card lays out against it", async () => {
    const screen = await readFile(SCREEN, "utf8");

    const item = screen.slice(
      screen.indexOf('data-label={text("Item"'),
      screen.indexOf('data-label={text("Pairs"'),
    );
    const pairs = screen.slice(
      screen.indexOf('data-label={text("Pairs"'),
      screen.indexOf('data-label={text("Earned"'),
    );

    // One child for the flex row to place; the lines stack inside it.
    expect(item).toContain('<span className="block min-w-0');
    expect(pairs).toContain('<span className="block min-w-0');
  });

  it("lets a long item name wrap instead of widening the table", async () => {
    const screen = await readFile(SCREEN, "utf8");

    expect(screen).toContain("break-words");
  });

  it("does not hold the note column open at 192px", async () => {
    const screen = await readFile(SCREEN, "utf8");

    // The note is empty on every work row; its minimum pushed the table wider
    // than a tablet for the sake of one reversal message.
    const note = screen.slice(screen.indexOf('data-label={text("Note"'));
    expect(note.slice(0, 200)).not.toContain("min-w-48");
  });
});

/**
 * Money that did not move is not printed.
 *
 * Every work row read "-0.00" under Paid and every payment "+0.00" under
 * Earned — eleven rows of figures that say nothing. The dash was meant to be
 * there already, but Postgres returns numeric as a string and Boolean("0.00")
 * is true, so the check never fired once.
 */
describe("zero columns", () => {
  it("compares the number, not the string Postgres sends", async () => {
    const screen = await readFile(SCREEN, "utf8");

    expect(screen).toContain("Number(entry.amount_earned) > 0");
    expect(screen).toContain("Number(entry.payment_given) > 0");
  });

  it("drops the whole cell on a phone rather than leaving a labelled blank", async () => {
    const screen = await readFile(SCREEN, "utf8");
    const css = await readFile("app/globals.css", "utf8");

    // On the phone card each cell is its own labelled line, so "PAID —" on
    // every wage row is most of the screen. A hidden span is not an empty cell
    // as far as td:empty is concerned, so the cell itself carries the mark.
    expect(screen).toContain("reflow-blank");
    expect(css).toContain(".reflow-table td.reflow-blank");
  });

  it("keeps a dash on a desktop, where a blank column reads as a fault", async () => {
    const css = await readFile("app/globals.css", "utf8");

    // The rule lives inside the phone-only media block.
    const phoneBlock = css.slice(
      css.indexOf("@media screen and (max-width: 767px)"),
      css.indexOf("@media print"),
    );
    expect(phoneBlock).toContain(".reflow-table td.reflow-blank");
  });

  it("does not print the currency twice", async () => {
    const screen = await readFile(SCREEN, "utf8");

    // Balance already says "Rs."; money() would make the row read "+Rs. 2,400".
    expect(screen).not.toContain("+${money(");
    expect(screen).not.toContain("-${money(");
  });
});

/**
 * A reversed row that looks reversed.
 *
 * The ledger showed two identical Rs. 9,720 payments on one day — one live, one
 * reversed as a duplicate — separated only by a sentence at the end of a note
 * column that runs off the side of a phone. Both read "-9,720" in the same red,
 * and both showed a balance, so the second looked like it also took money out.
 *
 * `status` was on every row from the API and had never been rendered. The
 * summary tiles were already right (Total paid reads Rs. 9,720, not 19,440) —
 * it was only the rows that lied.
 */
describe("a reversed entry", () => {
  it("says so beside the type", async () => {
    const screen = await readFile(SCREEN, "utf8");

    expect(screen).toContain('entry.status === "reversed"');
    expect(screen).toContain('text("reversed", "फिर्ता")');
  });

  it("strikes through the money it no longer moves", async () => {
    const screen = await readFile(SCREEN, "utf8");

    expect(screen).toContain("line-through");
  });

  it("says the balance did not change, rather than repeating it", async () => {
    const screen = await readFile(SCREEN, "utf8");

    // Showing Rs. 0 again beside the live row reads as a second movement.
    expect(screen).toContain('text("no change", "फेरबदल छैन")');
  });

  it("keeps that line on a phone, where it matters most", async () => {
    const screen = await readFile(SCREEN, "utf8");

    const balance = screen.slice(screen.indexOf('data-label={text("Balance"'));
    // The note column carrying the reversal reason runs off a phone; hiding
    // the balance line too would leave nothing saying the row is void.
    expect(balance.slice(0, 400)).not.toContain("reflow-blank");
  });
});

/**
 * A dash is not an amount.
 *
 * Earned and Paid carried their colour on the cell, so the em-dash standing in
 * for "nothing here" inherited it — four work rows showing a red mark in a
 * column headed Paid. Red in a money column reads as money going out, and the
 * eye kept stopping on rows where nothing had been paid at all.
 */
describe("the dash in a money column", () => {
  it("is grey, while only real amounts carry colour", async () => {
    const screen = await readFile(SCREEN, "utf8");

    const earned = screen.slice(
      screen.indexOf('data-label={text("Earned"'),
      screen.indexOf('data-label={text("Paid"'),
    );
    const paid = screen.slice(
      screen.indexOf('data-label={text("Paid"'),
      screen.indexOf('data-label={text("Balance"'),
    );

    // The colour sits on the figure, not on the cell around it.
    expect(earned).not.toMatch(/className=\{`py-3[^`]*text-green-600/);
    expect(paid).not.toMatch(/className=\{`py-3[^`]*text-red-600/);
    expect(earned).toContain("text-green-600");
    expect(paid).toContain("text-red-600");
    expect(paid).toContain("text-brand-muted-soft");
  });

  it("keeps the accounting order: earned, paid, then balance", async () => {
    const screen = await readFile(SCREEN, "utf8");

    // In, out, result — moving Paid away from that would break the row's
    // arithmetic as it is read left to right.
    const earned = screen.indexOf('text("Earned", "कमाएको")');
    const paid = screen.indexOf('text("Paid", "पाएको")');
    const balance = screen.indexOf('text("Balance", "बाँकी")');

    expect(earned).toBeLessThan(paid);
    expect(paid).toBeLessThan(balance);
  });
});
