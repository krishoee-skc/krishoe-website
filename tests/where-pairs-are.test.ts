import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

const SCREEN = "app/admin/stock/WherePairsAre.tsx";
const PAGE = "app/admin/stock/page.tsx";
const ACTIONS = "app/admin/stock/actions.ts";
const LIB = "lib/stock-transfers.ts";

/**
 * The shop is two places and the app knew only how many pairs existed.
 *
 * These hold the three decisions that make this safe to have: selling still
 * reads one pool, a disagreement between the location figures and the stock
 * figure is shown rather than reconciled away, and moving pairs writes a
 * challan rather than a bill.
 */

describe("selling is not touched", () => {
  it("leaves finished_stock as the one pool it was", async () => {
    const lib = await readFile(LIB, "utf8");

    // Locations are recorded beside finished_stock. If this file ever writes to
    // it, the pool selling reads has become two, and a customer can be told a
    // shoe they can see is unavailable because it is in the other room.
    expect(lib).not.toMatch(/UPDATE\s+finished_stock/i);
    expect(lib).not.toMatch(/INSERT\s+INTO\s+finished_stock/i);
    expect(lib).toContain("stock_locations");
  });

  it("says so on the screen, where the owner can check it", async () => {
    const screen = await readFile(SCREEN, "utf8");
    expect(screen).toContain("Selling is unchanged");
    expect(screen).toContain("बिक्री उस्तै छ");
  });
});

describe("what nobody has placed is shown, not hidden", () => {
  it("is worked out rather than assumed away", async () => {
    const lib = await readFile(LIB, "utf8");

    // total − (factory + shop). Pairs on the road, or made before this screen
    // existed. A location figure that quietly disagrees with the stock figure
    // is worse than no location figure.
    expect(lib).toContain("unplaced: total - factory - shop");
  });

  it("counts each place with its own join", async () => {
    const lib = await readFile(LIB, "utf8");

    // One join and a FILTER multiplied the total by how many places a design
    // sat in — a 54-pair design read as 108. stock_locations is unique on
    // (design, size_run, location), so a join per place matches one row each.
    expect(lib).toContain("l.location = 'Factory'".replace("l.", "f."));
    expect(lib).toContain("p.location = 'Shop'");
    expect(lib).not.toMatch(/sum\(l\.pairs\)\s*FILTER/);
  });

  it("is put in front of the owner when it is not zero", async () => {
    const screen = await readFile(SCREEN, "utf8");
    expect(screen).toContain("totals.unplaced !== 0");
    expect(screen).toContain("ठाउँ भनिएको छैन");
  });
});

describe("a challan, not a bill", () => {
  it("is named that way on the screen, with the reason", async () => {
    const screen = await readFile(SCREEN, "utf8");

    // A bill counts as a sale: it lands in the VAT record and moves the profit
    // figure. Nothing is sold when the shop's own pairs walk to its own shelf.
    expect(screen).toContain("It is not a bill");
    expect(screen).toContain("यो बिल होइन");
    expect(screen).toContain("VAT");
  });

  it("never reaches the invoice tables", async () => {
    const lib = await readFile(LIB, "utf8");
    const actions = await readFile(ACTIONS, "utf8");

    for (const source of [lib, actions]) {
      expect(source).not.toContain("pos_invoices");
      expect(source).not.toContain("purchase_invoices");
    }
  });
});

describe("the road between the two places", () => {
  it("takes pairs off the sending side before anyone confirms", async () => {
    const lib = await readFile(LIB, "utf8");

    // Twenty pairs that leave and eighteen that arrive is a silence unless the
    // ten that are neither here nor there are visible while they travel.
    expect(lib).toContain("SET pairs = pairs - $2");
    expect(lib).toContain("FOR UPDATE");
  });

  it("lets what arrived differ from what was sent", async () => {
    const lib = await readFile(LIB, "utf8");

    // The difference is the finding, not an error to argue with. Same three
    // words the factory floor already uses for a stage handover.
    expect(lib).toContain('"Matched"');
    expect(lib).toContain('"Short"');
    expect(lib).toContain('"Excess"');
  });

  it("treats a blank count as all of it arriving", async () => {
    const lib = await readFile(LIB, "utf8");

    // The common case is that everything came. Making the owner retype numbers
    // that did not change is how a screen stops being used.
    expect(lib).toContain("const counted = raw === undefined ? sent : whole(raw);");
  });

  it("closes in one press when the owner carried the pairs himself", async () => {
    const screen = await readFile(SCREEN, "utf8");
    const lib = await readFile(LIB, "utf8");

    expect(screen).toContain('name="receiveNow"');
    expect(screen).toContain("अहिल्यै बुझ्ने");
    expect(lib).toContain("input.receiveNow");
  });

  it("cannot send the same goods twice on a slow connection", async () => {
    const lib = await readFile(LIB, "utf8");
    const screen = await readFile(SCREEN, "utf8");

    expect(lib).toContain("WHERE submission_key = $1");
    expect(screen).toContain('name="submissionKey"');
  });
});

describe("the screen sits on the stock page", () => {
  it("is rendered there with the day this shop counts", async () => {
    const page = await readFile(PAGE, "utf8");

    expect(page).toContain("<WherePairsAre");
    // Dated where the shop is, not where the browser thinks it is.
    expect(page).toContain("NEPAL_TIME_ZONE");
    expect(page).toContain("toBikramSambatNumeric");
  });

  it("still shows its stock figures if the location read fails", async () => {
    const page = await readFile(PAGE, "utf8");

    // A new question must not cost the screen the answers it already gave.
    expect(page).toContain("getStockByPlace().catch(() => [])");
    expect(page).toContain("getStockTransfers(40).catch(() => [])");
  });
});
