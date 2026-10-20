import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { findInvalidItemOption } from "@/lib/checkout-item-check";
import { shoeReadiness } from "@/lib/product-readiness";
import type { Product } from "@/lib/products";

/**
 * Owner, 2026-10-20 (deep audit 2, 3, 4).
 *
 * 2. A maroon Lose Hill Panja and a cream Bantu Hill were on the shop as
 *    "Black": a blank colour box saved as Black. Blank now stays blank, and a
 *    shoe cannot go on the shop until its colour is written.
 * 3. On a tablet (768–1023 px) the shoe stands in one column, but the bar that
 *    buys was phone-only — the Buy button sat far below the photo.
 * 4. The old design proposal was served to anyone at /krishoe-design.html.
 */

const ready = {
  image: "https://example.public.blob.vercel-storage.com/products/lose-hill.jpg",
  gallery: [] as string[],
  priceValue: 95000,
  sizes: ["36", "37", "38"],
  colors: ["Maroon"],
  stock: 60,
  description: "Soft sandal",
  nameNe: "लोज हिल पन्जा",
};

describe("a shoe says its own colour", () => {
  it("cannot go on the shop without one", () => {
    const readiness = shoeReadiness({ ...ready, colors: [] });
    expect(readiness.ready).toBe(false);
    expect(readiness.blocking.map((need) => need.key)).toEqual(["colour"]);
    expect(readiness.blocking[0].ne).toBe("रङ");
    expect(shoeReadiness({ ...ready, colors: ["  "] }).ready).toBe(false);
    expect(shoeReadiness(ready).ready).toBe(true);
  });

  it("is never guessed as Black when the box is blank", async () => {
    const store = await readFile("lib/product-store.ts", "utf8");
    const save = await readFile("app/admin/actions.ts", "utf8");
    expect(store).not.toContain('colors.length > 0 ? colors : ["Black"]');
    expect(store).not.toMatch(/colors: \["Black"\]/);
    expect(save).not.toContain(': ["Black"]');
    // Active without a colour is refused, in both languages; a Draft may wait.
    expect(save).toContain('if (status === "Active" && colors.length === 0)');
    expect(save).toContain("Active गर्नुअघि जुत्ताको रङ लेख्नुहोस्");
  });

  it("checkout takes a shoe with no colour written, and still refuses a wrong one", () => {
    const product = { id: "p1", name: "Lose Hill Panja", sizes: ["36"], colors: [] as string[] } as unknown as Product;
    const maroon = { ...product, colors: ["Maroon"] } as Product;
    const item = (color: string) => ({ productId: "p1", size: "36", color, quantity: 1 });
    expect(findInvalidItemOption([item("")], [product])).toBe("");
    expect(findInvalidItemOption([item("Black")], [product])).toContain("does not come in Black");
    expect(findInvalidItemOption([item("Maroon")], [maroon])).toBe("");
    expect(findInvalidItemOption([item("Black")], [maroon])).toContain("does not come in Black");
  });

  it("shows no colour picker when there is no colour to pick", async () => {
    const page = await readFile("components/ProductDetailActions.tsx", "utf8");
    expect(page).toContain("product.colors.length > 0 ? (");
    expect(page).toContain('useState(product.colors[0] ?? "")');
  });
});

describe("the tablet can buy", () => {
  it("keeps the buy bar until the page has two columns (lg)", async () => {
    const buy = await readFile("components/ProductDetailActions.tsx", "utf8");
    const page = await readFile("app/product/[id]/page.tsx", "utf8");
    const tabs = await readFile("components/BottomTabBar.tsx", "utf8");
    expect(buy).toContain("backdrop-blur-xl lg:hidden");
    expect(buy).not.toContain("backdrop-blur-xl md:hidden");
    expect(page).toContain("lg:grid-cols-2");
    expect(page).toContain('className="pb-32 lg:pb-0"');
    expect(tabs).toContain('isProduct ? "max-lg:hidden" : ""');
  });
});

describe("the design proposal is not public", () => {
  it("lives in docs, not in public", async () => {
    await expect(readFile("public/krishoe-design.html", "utf8")).rejects.toThrow();
    expect(await readFile("docs/krishoe-design.html", "utf8")).toContain("<title>");
  });
});
