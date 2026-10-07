import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { shoeReadiness } from "@/lib/product-readiness";
import { stockSizesOf } from "@/lib/stock-by-size";
import type { FinishedStock } from "@/lib/operations";

/**
 * Owner, 2026-10-07: four shoes on the shop, twenty-one in Draft, and nothing
 * saying what each Draft still needed. These pin what keeps one off the shop.
 */
const shoe = {
  image: "https://example.public.blob.vercel-storage.com/products/lose-hill.jpg",
  gallery: [] as string[],
  priceValue: 95000,
  sizes: ["36", "37", "38", "39", "40"],
  stock: 60,
  description: "Soft hill sandal",
  nameNe: "लोज हिल पन्जा",
};

const keys = (needs: { key: string }[]) => needs.map((need) => need.key);

describe("what a Draft still needs", () => {
  it("is ready with a real photo, a price, sizes and pairs", () => {
    const readiness = shoeReadiness(shoe);
    expect(readiness.ready).toBe(true);
    expect(readiness.blocking).toEqual([]);
  });

  it("is kept off by a sample photo, no price, no sizes or no pairs", () => {
    const readiness = shoeReadiness({ ...shoe, image: "/images/products/ladies-sandals.jpg", priceValue: 0, sizes: [], stock: 0 });
    expect(readiness.ready).toBe(false);
    expect(keys(readiness.blocking)).toEqual(["photo", "price", "sizes", "stock"]);
  });

  it("is kept off when none of its sizes are sizes in stock (Fom flat: stock 25–30, shoe 36–40)", () => {
    const readiness = shoeReadiness(shoe, ["25", "26", "27", "28", "29", "30"]);
    expect(keys(readiness.blocking)).toEqual(["size-match"]);
    expect(readiness.blocking[0].en).toContain("stock is 25–30, the shoe says 36–40");
  });

  it("only advises when some stock sizes are missing from the shoe", () => {
    const readiness = shoeReadiness(shoe, ["40", "41"]);
    expect(readiness.ready).toBe(true);
    expect(keys(readiness.advice)).toContain("size-more");
  });

  it("advises more photos, a description and a Nepali name without blocking", () => {
    const readiness = shoeReadiness({ ...shoe, description: "", nameNe: "" });
    expect(readiness.ready).toBe(true);
    expect(keys(readiness.advice)).toEqual(["more-photos", "description", "name-ne"]);
  });
});

describe("the sizes the stock holds", () => {
  const row = (sizeRun: string, stockPairs: number): FinishedStock => ({
    id: sizeRun, design: "Fom flat", channel: "Factory", sizeRun, stockPairs, soldPairs: 0, returnedPairs: 0,
  });

  it("lists real sizes with pairs, in order, and leaves a pile out", () => {
    expect(stockSizesOf([row("30", 10), row("25", 10), row("26", 0), row("Mixed", 5)], "fom flat")).toEqual(["25", "30"]);
  });
});

describe("putting a Draft on the shop", () => {
  it("checks it again on the server and changes the status alone", async () => {
    const actions = await readFile("app/admin/products/actions.ts", "utf8");
    const publish = actions.slice(actions.indexOf("export async function publishDraftAction"));
    expect(publish).toContain('await requireAdminPermission("products:write");');
    expect(publish).toContain("if (!readiness.ready) {");
    expect(publish).toContain('await setProductStatus(product.id, "Active");');
    expect(publish).not.toContain("upsertProduct");
  });
});
