import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildStockOverview } from "@/lib/stock-overview";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * The stock page asked "why a different number?" under two equal figures, and
 * then — counting Draft shoes as on sale — said "the website shows the same
 * 215 pairs" while the shop sold 96 of them (owner, 2026-09-29). It now
 * compares what is ready with what a shopper can actually buy.
 */
describe("the website's pair count on the stock page", () => {
  it("counts only Active shoes as on sale, and names the Draft ones holding pairs", () => {
    const empty = { rawMaterials: [], finishedStock: [], stockMovements: [] };
    const product = (name: string, status: "Active" | "Draft", stock: number) =>
      ({ id: name, name, status, stock }) as unknown as Parameters<typeof buildStockOverview>[1][number];
    const { summary } = buildStockOverview(empty as unknown as Parameters<typeof buildStockOverview>[0], [
      product("lose hill panja", "Active", 53),
      product("bantu hill", "Active", 43),
      product("Fom flat", "Draft", 60),
      product("eva slipers", "Draft", 30),
      product("Old sample", "Draft", 0),
    ]);
    expect(summary.onSaleCatalogPairs).toBe(96);
    expect(summary.draftCatalogPairs).toBe(90);
    expect(summary.draftShoesWithPairs).toEqual(["Fom flat", "eva slipers"]);
    expect(summary.sellableCatalogPairs).toBe(186);
  });

  it("asks why only when on-sale and ready differ, and names the gap", async () => {
    const page = await read("app/admin/stock/page.tsx");
    expect(page).toContain("summary.onSaleCatalogPairs === summary.readyPairs ?");
    expect(page).toContain("Math.abs(summary.readyPairs - summary.onSaleCatalogPairs)");
    expect(page).not.toContain("वेबसाइटमा पनि उही");
    expect(page).not.toContain("why a different number?");
  });

  it("explains the gap in Nepali too, not English alone", async () => {
    const page = await read("app/admin/stock/page.tsx");
    expect(page).not.toContain("<strong>Do not add catalog stock twice:</strong>");
    expect(page).toContain("त्यसैले दुई अंक जोड्नु हुँदैन");
    expect(page).toContain("जोडी Draft मा रहेका जुत्ताका हुन्");
  });
});
