import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { BIG_COUNT_DROP, planShelfCount } from "@/lib/shelf-count-rules";
import { canAdmin } from "@/lib/admin-role-permissions";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * Owner, 2026-10-11: count any shoe's shelf at the shop or the factory. That
 * place becomes the count, the other is not touched, and the stock follows.
 * The Owner and the staff who may change stock may count; ten or more pairs
 * fewer asks "I counted again".
 */
describe("a count of one place", () => {
  it("at the shop leaves the factory alone: 100 + 20, 18 counted at the shop, 118 in stock", () => {
    const plan = planShelfCount({ books: { "40": 120 }, here: { "40": 20 }, there: { "40": 100 }, counted: { "40": 18 } });
    expect(plan.stockMoves).toEqual([{ size: "40", change: -2 }]);
    expect(plan.placeChanges).toEqual([{ size: "40", now: 20, to: 18, change: -2 }]);
  });

  it("puts kitto 770 right: 300 placed at the shop against 200 in stock, 200 counted", () => {
    const plan = planShelfCount({
      books: { "40": 120, "41": 20, "42": 20, "43": 20, "44": 20 },
      here: { "40": 120, "41": 20, "42": 20, "43": 20, "44": 20, Mixed: 100 },
      there: {},
      counted: { "40": 120, "41": 20, "42": 20, "43": 20, "44": 20 },
    });
    // The stock does not move; the 100 Mixed placed at the shop go to 0.
    expect(plan.stockMoves).toEqual([]);
    expect(plan.placeChanges.find((change) => change.size === "Mixed")).toEqual({ size: "Mixed", now: 100, to: 0, change: -100 });
    expect(plan.fewer).toBe(100);
  });

  it("puts in what was found and was not on the books", () => {
    const plan = planShelfCount({ books: {}, here: {}, there: {}, counted: { "37": 3 } });
    expect(plan.stockMoves).toEqual([{ size: "37", change: 3 }]);
  });

  it("takes a size not typed to 0 at that place only", () => {
    const plan = planShelfCount({ books: { "38": 6 }, here: { "38": 4 }, there: { "38": 2 }, counted: {} });
    expect(plan.stockMoves).toEqual([{ size: "38", change: -4 }]);
    expect(plan.placeChanges).toEqual([{ size: "38", now: 4, to: 0, change: -4 }]);
  });

  it("counts the pairs fewer that ask again, from ten", () => {
    expect(BIG_COUNT_DROP).toBe(10);
    expect(planShelfCount({ books: { "36": 12 }, here: { "36": 12 }, there: {}, counted: { "36": 2 } }).fewer).toBe(10);
    expect(planShelfCount({ books: { "36": 12 }, here: { "36": 12 }, there: {}, counted: { "36": 3 } }).fewer).toBe(9);
  });
});

describe("who counts, and how it is kept", () => {
  it("is the Owner and the staff who may change stock", async () => {
    expect(canAdmin("Owner", "operations:write")).toBe(true);
    expect(canAdmin("Manager", "operations:write")).toBe(true);
    expect(canAdmin("Inventory", "operations:write")).toBe(true);
    expect(canAdmin("Viewer", "operations:write")).toBe(false);
    const actions = await read("app/admin/stock/actions.ts");
    const count = actions.slice(actions.indexOf("export async function countShelfAction"));
    expect(count).toContain('const { session } = await requireAdminPermission("operations:write");');
    expect(count).toContain('"stock_shelf_counted"');
    const page = await read("app/admin/stock/page.tsx");
    expect(page).toContain('const canCount = session ? canAdmin(getSessionAdminRole(session), "operations:write") : false;');
  });

  it("refuses ten or more fewer without the tick, on the server too", async () => {
    const shelf = await read("lib/shelf-count.ts");
    expect(shelf).toContain("if (fewer >= BIG_COUNT_DROP && !input.confirmBigDrop) {");
    const form = await read("app/admin/stock/FillByCount.tsx");
    expect(form).toContain("const askAgain = typedAny && fewer >= BIG_COUNT_DROP;");
  });

  it("locks the stock and the places, and writes both places as they should read", async () => {
    const shelf = await read("lib/shelf-count.ts");
    expect(shelf.match(/FOR UPDATE/g)?.length).toBe(2);
    expect(shelf).toContain("DO UPDATE SET pairs = EXCLUDED.pairs, updated_at = now()");
    expect(shelf).toContain("for (const [size, pairs] of Object.entries(there)) await setPlace(other, size, pairs);");
  });

  it("sits on every shoe's line on the stock page", async () => {
    const screen = await read("app/admin/stock/WherePairsAre.tsx");
    expect(screen).toContain('🔢 {text("Count", "गन्ने")}');
    expect(screen).toContain("<FillByCount\n            design={group.design}");
  });

  it("shows a place row with no stock behind it", async () => {
    const lib = await read("lib/stock-transfers.ts");
    expect(lib).toContain("SELECT design, size_run FROM stock_locations WHERE pairs > 0");
  });
});

describe("an empty form is not a count (owner, 2026-10-11)", () => {
  it("says what to do instead of \"300 pairs fewer\", until a size is typed", async () => {
    const form = await read("app/admin/stock/FillByCount.tsx");
    expect(form).toContain("const showResult = typedAny || noneOnShelf;");
    expect(form).toContain("Type what you find on the");
    expect(form).toContain("disabled={pending || !showResult || (askAgain && !countedAgain)}");
  });

  it("sets a place to 0 only with its own tick, on the server too", async () => {
    const form = await read("app/admin/stock/FillByCount.tsx");
    expect(form).toContain("Nothing of this shoe on the");
    const shelf = await read("lib/shelf-count.ts");
    expect(shelf).toContain("if (Object.keys(counted).length === 0 && !input.noneOnShelf) {");
  });

  it("shows the stock beside the place, so 300 at the shop and 200 in stock are both said", async () => {
    const form = await read("app/admin/stock/FillByCount.tsx");
    expect(form).toContain("in stock ${stockTotal}");
    const screen = await read("app/admin/stock/WherePairsAre.tsx");
    expect(screen).toContain("{ shop: row.shop, factory: row.factory, total: row.total }");
  });
});
