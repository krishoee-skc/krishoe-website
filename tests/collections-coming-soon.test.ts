import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { categories, type Product } from "@/lib/products";
import { getProductsByCategory } from "@/lib/seo";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * Six of the seven collections on the home page opened on "No products found
 * — try a different filter" (owner, 2026-09-29). An empty collection now says
 * "coming soon", on its tile and on its page.
 */
describe("a collection with no shoes yet", () => {
  it("is counted the way its page counts, so the tile and the page agree", () => {
    const sandal = { categorySlug: "ladies-sandals", category: "Ladies Sandals" } as Product;
    const counts = Object.fromEntries(
      categories.map((category) => [category.slug, getProductsByCategory([sandal], category).length]),
    );
    expect(counts["ladies-sandals"]).toBe(1);
    expect(counts["party-heels"]).toBe(0);
  });

  it("shows 'coming soon' on its home tile, but never when the catalogue failed to load", async () => {
    const home = await read("app/page.tsx");
    expect(home).toContain("shoeCounts={products.length > 0 ? categoryShoeCounts(products) : undefined}");
    expect(home).toContain("getProductsByCategory(products, category).length");
    const tiles = await read("components/categories.tsx");
    expect(tiles).toContain("shoeCounts !== undefined && (shoeCounts[item.slug] ?? 0) === 0");
    expect(tiles).toContain('<T en="Coming soon" ne="छिट्टै आउँदैछ" />');
  });

  it("opens on 'coming soon' with a way on, and keeps 'no match' for a search that missed", async () => {
    const controls = await read("app/shop/ShopCatalogControls.tsx");
    expect(controls).toContain("{products.length === 0 && activeCategory ? (");
    expect(controls).toContain("अहिले तयार जुत्ता हेर्ने");
    expect(controls).toContain("WhatsApp मा सोध्ने");
    expect(controls).toContain('text("No products found.", "कुनै जुत्ता भेटिएन।")');
  });
});
