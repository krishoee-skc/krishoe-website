import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { drawFromPlaces, placeChangesFor, placeOrderFor } from "@/lib/stock-rules";

/**
 * A sale takes pairs off a place, not only off the total.
 *
 * finished_stock says how many pairs there are; stock_locations says where.
 * Production, purchases and challans kept the second in step, but a sale
 * changed only the first. On the live shop that left 222 pairs placed at the
 * factory and the shop against 182 in stock — the 40 pairs sold — and the
 * Stock screen called the gap "pairs without a place", the opposite of true.
 */

describe("which place gives up the pairs", () => {
  it("sells the counter and the website from the shop, wholesale from the factory", () => {
    expect(placeOrderFor("Retail")).toEqual(["Shop", "Factory"]);
    expect(placeOrderFor("Online")).toEqual(["Shop", "Factory"]);
    expect(placeOrderFor("Wholesale")).toEqual(["Factory", "Shop"]);
    expect(placeOrderFor("Factory")).toEqual(["Factory", "Shop"]);
  });

  it("takes the rest from the other place when the first runs short", () => {
    expect(drawFromPlaces("Retail", 5, { Shop: 3, Factory: 10 })).toEqual([
      { place: "Shop", pairs: 3 },
      { place: "Factory", pairs: 2 },
    ]);
  });

  it("never takes a place below zero — unplaced pairs stay unplaced", () => {
    expect(drawFromPlaces("Wholesale", 12, { Factory: 4 })).toEqual([{ place: "Factory", pairs: 4 }]);
    expect(drawFromPlaces("Retail", 2, {})).toEqual([]);
  });
});

describe("what each movement does to the places", () => {
  const held = { Factory: 60, Shop: 30 };

  it("takes a sale, a dispatch and a write-off off the shelf", () => {
    expect(placeChangesFor({ type: "Sale Out", pairs: 2, channel: "Retail" }, held)).toEqual([
      { place: "Shop", pairs: -2 },
    ]);
    expect(placeChangesFor({ type: "Dispatch Out", pairs: 12, channel: "Wholesale" }, held)).toEqual([
      { place: "Factory", pairs: -12 },
    ]);
    expect(placeChangesFor({ type: "Damage Out", pairs: 1, channel: "Factory" }, held)).toEqual([
      { place: "Factory", pairs: -1 },
    ]);
  });

  it("puts a return back where that channel sells from", () => {
    expect(placeChangesFor({ type: "Return In", pairs: 1, channel: "Retail" }, held)).toEqual([
      { place: "Shop", pairs: 1 },
    ]);
    expect(placeChangesFor({ type: "Return In", pairs: 3, channel: "Wholesale" }, held)).toEqual([
      { place: "Factory", pairs: 3 },
    ]);
  });

  it("leaves production, purchases and counts to the code that already places them", () => {
    expect(placeChangesFor({ type: "Production In", pairs: 60, channel: "Factory" }, held)).toEqual([]);
    expect(placeChangesFor({ type: "Purchase In", pairs: 36, channel: "Wholesale" }, held)).toEqual([]);
    expect(placeChangesFor({ type: "Adjustment", pairs: 5, channel: "Retail" }, held)).toEqual([]);
    expect(placeChangesFor({ type: "Market Sale", pairs: 5, channel: "Wholesale" }, held)).toEqual([]);
  });

  it("undoes a deleted movement the other way round", () => {
    expect(placeChangesFor({ type: "Sale Out", pairs: 2, channel: "Retail" }, held, "reverse")).toEqual([
      { place: "Shop", pairs: 2 },
    ]);
    expect(placeChangesFor({ type: "Return In", pairs: 1, channel: "Retail" }, held, "reverse")).toEqual([
      { place: "Shop", pairs: -1 },
    ]);
  });
});

describe("the posting and the screen", () => {
  it("moves the place in the same transaction as the stock", async () => {
    const source = await readFile("lib/operations-postgres.ts", "utf8");
    expect(source).toContain('await movePlacedPairs(db, stock, record, "apply");');
    expect(source).toContain('await movePlacedPairs(db, stock, movement, "reverse");');
  });

  it("tells pairs placed too many apart from pairs with no place", async () => {
    const screen = await readFile("app/admin/stock/WherePairsAre.tsx", "utf8");
    expect(screen).not.toContain("Math.abs(totals.unplaced)");
    expect(screen).toContain("totals.overPlaced > 0");
    expect(screen).toContain("बढी गनिएको");
  });

  it("fits a phone: cards there, the table from sm up", async () => {
    const screen = await readFile("app/admin/stock/WherePairsAre.tsx", "utf8");
    expect(screen).toContain('<ul className="mt-4 grid list-none gap-2 pl-0 sm:hidden">');
    expect(screen).toContain('<div className="mt-4 hidden overflow-x-auto sm:block">');
    expect(screen).toContain("grid-cols-[minmax(0,1fr)]");
  });
});
