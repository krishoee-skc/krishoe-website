import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { categories } from "@/lib/products";
import { categoryNepali } from "@/lib/nepali-pages";
import { guessKind } from "@/lib/counter-item-rules";

/** Owner, 2026-10-02: a shelf for women's closed shoes, and one for women's shoes. */
describe("Ladies Close Shoes and Ladies Shoes", () => {
  it("are categories, with a Nepali name, on the home tiles and in the footer", async () => {
    for (const slug of ["ladies-close-shoes", "ladies-shoes", "mens-slippers", "mens-shoes", "kids-shoes", "kids-slippers"]) {
      expect(categories.some((category) => category.slug === slug), slug).toBe(true);
      expect(categoryNepali[slug], slug).toBeTruthy();
      expect(await readFile("components/categories.tsx", "utf8")).toContain(`slug: "${slug}"`);
      expect(await readFile("components/Footer.tsx", "utf8")).toContain(`/shop/${slug}`);
    }
  });

  it("are what a lady's closed shoe or shoe reads as at the counter, and a sandal stays a sandal", () => {
    expect(guessKind("ladies close shoe")).toBe("ladies-close-shoes");
    expect(guessKind("ladies canvas shoes")).toBe("ladies-shoes");
    expect(guessKind("ladies sandal")).toBe("ladies-sandals");
    expect(guessKind("lose hill panja")).toBe("ladies-sandals");
  });
});
