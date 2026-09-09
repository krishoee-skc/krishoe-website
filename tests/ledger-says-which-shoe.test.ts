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
