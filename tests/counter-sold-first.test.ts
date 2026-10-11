import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { STOCK_TO_FILL_DAYS, countChanges, counterItemProblem, soldFirstExtras, withOneBlankRow } from "@/lib/counter-item-rules";
import { counterItemsMigrations } from "@/lib/counter-items-database";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");
const blank = () => ({ size: "", pairs: "" });

/**
 * Owner, 2026-10-09: at the counter, write only the pairs being sold and cut
 * the bill; the shoe's stock is filled later from its purchase bill or a count
 * of the shelf — seven days before the dashboard asks. Every size list keeps
 * one empty row at the foot.
 */
describe("one empty size row, always", () => {
  it("adds one when the last row is typed in, by any means", () => {
    expect(withOneBlankRow([{ size: "36", pairs: "" }], blank)).toEqual([{ size: "36", pairs: "" }, blank()]);
    expect(withOneBlankRow([{ size: "21", pairs: "2" }, { size: "22", pairs: "1" }], blank)).toHaveLength(3);
  });

  it("keeps exactly one at the foot, and the gaps a person left between", () => {
    const rows = [{ size: "36", pairs: "1" }, blank(), { size: "38", pairs: "2" }, blank(), blank()];
    expect(withOneBlankRow(rows, blank)).toEqual([{ size: "36", pairs: "1" }, blank(), { size: "38", pairs: "2" }, blank()]);
    expect(withOneBlankRow([blank()], blank)).toEqual([blank()]);
  });
});

describe("what the purchase bill adds to a shoe sold first", () => {
  it("adds every pair on the bill less those sold, size by size", () => {
    const answer = soldFirstExtras({
      billQuantity: 20,
      billSizes: { "36": 5, "37": 5, "38": 5, "39": 5 },
      soldPairs: 3,
      soldSizes: { "37": 1, "38": 2 },
    });
    expect(answer).toEqual({ ok: true, extras: { "36": 5, "37": 4, "38": 3, "39": 5 }, pairs: 17 });
  });

  it("adds the rest as uncounted when the bill gives no sizes", () => {
    expect(soldFirstExtras({ billQuantity: 20, billSizes: {}, soldPairs: 3, soldSizes: { "37": 3 } })).toEqual({
      ok: true,
      extras: { Mixed: 17 },
      pairs: 17,
    });
  });

  it("refuses a bill with fewer pairs, or fewer of a size, than were sold", () => {
    const fewer = soldFirstExtras({ billQuantity: 2, billSizes: {}, soldPairs: 3, soldSizes: {} });
    expect(fewer.ok).toBe(false);
    const size = soldFirstExtras({ billQuantity: 10, billSizes: { "37": 0, "38": 10 }, soldPairs: 1, soldSizes: { "37": 1 } });
    expect(size).toMatchObject({ ok: false });
    if (!size.ok) expect(size.ne).toContain("साइज 37");
  });
});

describe("the counter's form", () => {
  it("asks for the pairs being sold, not the shelf's count", () => {
    const draft = { name: "fancy chhapal ladies", how: "pending_bill" as const, sizes: {}, pilePairs: 0, retailPrice: 650, costPerPair: 0, lossConfirmed: false };
    expect(counterItemProblem({ ...draft, soldFirst: true })?.en).toBe("Type the size and how many pairs you are selling.");
    expect(counterItemProblem({ ...draft, sizes: { "37": 1, "38": 2 }, soldFirst: true })).toBeNull();
  });

  it("drops the uncounted pile and how it came, and shows the bill's sum", async () => {
    const sheet = await read("app/admin/pos/_components/PosNewItemSheet.tsx");
    expect(sheet).not.toContain("pileBox");
    expect(sheet).not.toContain("HOWS");
    expect(sheet).toContain('text("Selling now — size and pairs", "अहिले बेच्ने — साइज र जोडी")');
    expect(sheet).toContain("→ the bill`");
    expect(sheet).toContain('text("Add to the bill", "बिलमा थप्ने")');
    expect(sheet).toContain("<EnterWalkForm");
  });
});

describe("the books", () => {
  it("adds one new table, and creates nothing else", () => {
    const migration = counterItemsMigrations.find((entry) => entry.name === "20261009_counter_sold_first.sql");
    expect(migration?.table).toBe("counter_sold_first");
    expect(migration?.sql).toContain("CREATE TABLE IF NOT EXISTS counter_sold_first");
  });

  it("puts the sold pairs in as stock and remembers the stock is to fill", async () => {
    const lib = await read("lib/counter-items.ts");
    expect(lib).toContain("INSERT INTO counter_sold_first (counter_item_id, sold_pairs, sold_sizes)");
    expect(lib).toContain("soldFirst: input.soldFirst,");
    // A sold-first shoe has its own list, not the "bill to come" one.
    expect(lib).toContain("AND NOT EXISTS (SELECT 1 FROM counter_sold_first s WHERE s.counter_item_id = c.id)");
  });

  it("lets the purchase bill fill it with the rest, once, in the bill's transaction", async () => {
    const purchasing = await read("lib/purchasing-postgres.ts");
    expect(purchasing).toContain("SELECT to_regclass('counter_sold_first')::text AS present");
    expect(purchasing).toContain("soldFirstExtrasByCounterItem.set(row.line.counterItemId, answer.extras);");
    expect(purchasing).toContain("SET filled_at = now(), filled_how = 'bill'");
    expect(purchasing).toContain("that shoe's stock was already filled by a count of the shelf");
  });

  it("lets a count of the shelf fill it, once", async () => {
    const lib = await read("lib/counter-items.ts");
    expect(lib).toContain("WHERE s.counter_item_id = $1 AND s.filled_at IS NULL");
    expect(lib).toContain("SET filled_at = now(), filled_how = 'count'");
    const actions = await read("app/admin/stock/actions.ts");
    expect(actions).toContain('const { session } = await requireAdminPermission("pos:write");');
  });
});

describe("the reminder", () => {
  it("is seven days, on the dashboard and the stock page", async () => {
    expect(STOCK_TO_FILL_DAYS).toBe(7);
    const dashboard = await read("app/admin/page.tsx");
    expect(dashboard).toContain('href: "/admin/stock#stock-to-fill",');
    const watch = await read("app/admin/stock/CounterGoodsWatch.tsx");
    expect(watch).toContain('id="stock-to-fill"');
    expect(watch).toContain("const late = days >= STOCK_TO_FILL_DAYS;");
    expect(watch).toContain("<FillByCount\n                      id={item.id}\n                      design={item.design}");
  });

  it("offers the shoe on the purchase bill as sold first", async () => {
    const page = await read("app/admin/purchasing/page.tsx");
    expect(page).toContain("soldFirst: true,");
    const form = await read("app/admin/purchasing/_components/PurchaseInvoiceForm.tsx");
    expect(form).toContain("type every pair on the bill; the rest go into stock");
  });
});

describe("a save that is shut says why (owner, 2026-10-11)", () => {
  it("names the box to fill on the button, rings it, and Enter takes the cursor there", async () => {
    const sheet = await read("app/admin/pos/_components/PosNewItemSheet.tsx");
    expect(sheet).toContain("problem ? `${why} ↑` : text(\"Add to the bill\", \"बिलमा थप्ने\")");
    expect(sheet).toContain("Type the pairs for size");
    expect(sheet).toContain("ring-4 ring-brand-gold");
    expect(sheet).toContain("onBlocked={goToProblem}");
    // The faint line below the form is gone; the button carries the reason.
    expect(sheet).not.toContain("<p className=\"text-sm font-bold text-brand-muted\">{text(problem.en, problem.ne)}</p>");
    const walk = await read("components/admin/EnterWalkForm.tsx");
    expect(walk).toContain("onBlocked?.();");
  });

  it("keeps an empty pairs box empty: nothing is sold in that size", () => {
    const draft = { name: "x", how: "pending_bill" as const, pilePairs: 0, retailPrice: 625, costPerPair: 0, lossConfirmed: false, soldFirst: true };
    expect(counterItemProblem({ ...draft, sizes: {} })).not.toBeNull();
  });

  it("has no paragraph tag in the sheet, whose 1rem foot from the stylesheet doubled the gaps", async () => {
    const sheet = await read("app/admin/pos/_components/PosNewItemSheet.tsx");
    expect(sheet).not.toMatch(/<p[ >]/);
  });
});

describe("a count of the shelf is the stock, not added to it (owner, 2026-10-11)", () => {
  it("bill never cut: 3 pairs left on the books, 20 counted, the stock is 20 — not 23", () => {
    const changes = countChanges({ "37": 3 }, { "36": 5, "37": 5, "38": 5, "39": 5 });
    expect(changes.reduce((sum, change) => sum + change.to, 0)).toBe(20);
    expect(changes.find((change) => change.size === "37")).toEqual({ size: "37", now: 3, to: 5, change: 2 });
  });

  it("bill cut: nothing on the books, 17 counted, 17 go in", () => {
    const changes = countChanges({}, { "36": 5, "37": 4, "38": 3, "39": 5 });
    expect(changes.reduce((sum, change) => sum + change.change, 0)).toBe(17);
  });

  it("a size on the books but not typed goes to 0; fewer found comes off", () => {
    expect(countChanges({ "38": 4, Mixed: 2 }, { "38": 1 })).toEqual([
      { size: "38", now: 4, to: 1, change: -3 },
      { size: "Mixed", now: 2, to: 0, change: -2 },
    ]);
  });

  it("takes fewer found off as pairs not found, and more found in at the shop", async () => {
    // Since 2026-10-11 the shop count of a shoe sold first is the same rule
    // as a count of any shoe: lib/shelf-count.ts.
    const lib = await read("lib/counter-items.ts");
    expect(lib).toContain("await setPlaceToCount(db, {");
    expect(lib).toContain("place: \"Shop\",");
    expect(lib).toContain("stockNow: cleanSizes(row.stock_now),");
    const shelf = await read("lib/shelf-count.ts");
    expect(shelf).toContain("the database cannot take pairs off yet");
    expect(shelf).toContain("type: \"Damage Out\",");
    expect(shelf).toContain("not found.");
    const form = await read("app/admin/stock/FillByCount.tsx");
    expect(form).toContain("to this count:");
    expect(form).toContain("Sizes you do not type become 0 at the");
  });
});

describe("a shoe added at the counter is made with its pairs, or not at all (owner, 2026-10-11)", () => {
  it("writes the product inside the same transaction as its stock", async () => {
    const lib = await read("lib/counter-items.ts");
    const create = lib.slice(lib.indexOf("export async function createCounterItem"), lib.indexOf("export function counterItemLookAlikes"));
    expect(create).not.toContain("await upsertProduct(product);");
    expect(create).toContain("await transactionPostgres(STORE, async (db) => {\n    await upsertProductIn(db, product);");
    const store = await read("lib/product-store.ts");
    expect(store).toContain("export async function upsertProductIn(db: PostgresExecutor, product: Product) {");
  });
});
