import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { weeklyCountShoes } from "@/app/admin/stock/CounterGoodsWatch";
import { movementKind, movementWords, readyParts, salesPace, sizesToCount } from "@/lib/stock-page-rules";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * The stock page, as the owner read it on 2026-09-30: 475 ready but only
 * "156 made · 59 bought" said; kitto 770's 200 pairs "adjusted"; sold-out
 * counter goods first in red; "Can't tell yet" on half the shoes.
 */
describe("1. every ready pair in one part", () => {
  it("adds up to the whole, the shelf and counter goods included", () => {
    const parts = readyParts({ manufacturedPairs: 156, purchasedPairs: 59, mixedPairs: 0, openingPairs: 260 });
    expect(parts.map((part) => part.key)).toEqual(["made", "bought", "shelf"]);
    expect(parts.reduce((sum, part) => sum + part.pairs, 0)).toBe(475);
    expect(parts[2].ne).toBe("पहिले नै थियो / बिलबाट थपिएको");
  });

  it("is drawn under the lead figure", async () => {
    const page = await read("app/admin/stock/page.tsx");
    expect(page).toContain("const parts = readyParts(summary);");
    expect(page).not.toContain("made here · ${summary.purchasedPairs} bought in");
  });
});

describe("2. what a movement was", () => {
  it("names goods added at the counter, and gives every adjustment its plus", () => {
    expect(movementKind({ type: "Adjustment", note: "Already on the shop shelf — added from the counter bill." })).toBe("Counter In");
    expect(movementKind({ type: "Adjustment", note: "Counted in the shop." })).toBe("Adjustment");
    expect(movementKind({ type: "Purchase In", note: "Arrived, supplier's bill to come. Added from the counter bill." })).toBe("Purchase In");
    expect(movementWords["Counter In"]).toEqual({ en: "added at the counter", ne: "बिलबाट थपियो", sign: 1 });
    expect(movementWords.Adjustment.sign).toBe(1);
  });
});

describe("3. selling said plainly, sold-out folded away", () => {
  it("says how many sold in how many days when the days left cannot be told", async () => {
    expect(salesPace(17, 3)).toEqual({ en: "17 sold in 3 days", ne: "3 दिनमा 17 जोडी बिक्यो" });
    expect(salesPace(1, 0)?.en).toBe("1 sold in 1 day");
    expect(salesPace(0, 5)).toBeNull();
    const page = await read("app/admin/stock/page.tsx");
    expect(page).toContain("...(salesPace(row.soldInWindow, row.historyDays) ?? { en: \"Can't tell yet\", ne: \"भन्न मिल्दैन\" })");
  });

  it("puts sold-out shoes last and folds them in the plain view", async () => {
    const list = await read("app/admin/stock/WherePairsAre.tsx");
    expect(list).toContain("if (group.total <= 0) return 4;");
    expect(list).toContain('const foldSoldOut = shoeFilter === "all" && !search.trim() && sort.key === "attention";');
    expect(list).toContain("{listed.map((group, index) => {");
  });
});

describe("4. the rest", () => {
  it("lists the Draft shoes with pairs, each a press from its form", async () => {
    const page = await read("app/admin/stock/page.tsx");
    expect(page).toContain("{summary.draftShoes.map((shoe) => (");
    expect(page).toContain("href={`/admin/products?edit=${encodeURIComponent(shoe.id)}`}");
  });

  it("marks a shoe never counted by size, and links each shoe to its form", async () => {
    const list = await read("app/admin/stock/WherePairsAre.tsx");
    expect(list).toContain("if (group.sizes || group.total <= 0) return null;");
    expect(list).toContain('text("no sizes", "साइज छैन")');
    expect(list).toContain("href={`/admin/products?edit=${encodeURIComponent(extra.productId)}`}");
  });

  it("shows the stock at cost only to those who may read costing", async () => {
    const page = await read("app/admin/stock/page.tsx");
    expect(page).toContain('const canCost = session ? canAdmin(getSessionAdminRole(session), "costing:read") : false;');
    expect(page).toContain("loadStock(canCost)");
    expect(page).toContain("value={money(loaded.stockValue.value)}");
  });

  it("counts a big shoe size by size", () => {
    expect(sizesToCount([{ sizeRun: "40", total: 20 }, { sizeRun: "41", total: 5 }], 25)).toEqual([]);
    expect(
      sizesToCount(
        [
          { sizeRun: "Mixed", total: 100 },
          { sizeRun: "41", total: 20 },
          { sizeRun: "40", total: 20 },
          { sizeRun: "44", total: 0 },
        ],
        140,
      ),
    ).toEqual([
      { size: "40", pairs: 20 },
      { size: "41", pairs: 20 },
      { size: "Mixed", pairs: 100 },
    ]);
    const week = weeklyCountShoes(
      [
        { design: "kitto 770", sizeRun: "40", factory: 0, shop: 20, total: 20, unplaced: 0 },
        { design: "kitto 770", sizeRun: "41", factory: 0, shop: 20, total: 20, unplaced: 0 },
      ],
      "2026-09-30",
    );
    expect(week[0].sizes.map((entry) => entry.size)).toEqual(["40", "41"]);
  });
});
