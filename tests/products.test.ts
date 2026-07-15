import { describe, expect, it } from "vitest";
import {
  formatPrice,
  getProductByIdFromList,
  getRelatedProductsFromList,
  products,
  searchProductList,
  wholesalePriceLabel,
  type Product,
} from "@/lib/products";

describe("formatPrice", () => {
  it("converts paisa to rupees with grouping", () => {
    expect(formatPrice(199900)).toBe("Rs. 1,999");
    expect(formatPrice(0)).toBe("Rs. 0");
    expect(formatPrice(100)).toBe("Rs. 1");
  });
});

describe("wholesalePriceLabel", () => {
  const base = products[0];

  it("returns a formatted label when a wholesale rate is set", () => {
    expect(wholesalePriceLabel({ ...base, wholesalePriceValue: 149900 })).toBe("Rs. 1,499");
  });

  it("returns null when no wholesale rate is set", () => {
    expect(wholesalePriceLabel({ ...base, wholesalePriceValue: 0 })).toBeNull();
  });
});

describe("getProductByIdFromList", () => {
  it("finds an existing product", () => {
    expect(getProductByIdFromList(products, "party-heels")?.name).toBe("Midnight Party Heels");
  });

  it("returns undefined for an unknown id", () => {
    expect(getProductByIdFromList(products, "does-not-exist")).toBeUndefined();
  });
});

describe("searchProductList", () => {
  it("returns all products for an empty query", () => {
    expect(searchProductList(products, "   ")).toHaveLength(products.length);
  });

  it("matches on name case-insensitively", () => {
    const results = searchProductList(products, "HEELS");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((p) => `${p.name} ${p.category} ${p.description}`.toLowerCase().includes("heels"))).toBe(true);
  });

  it("matches on category", () => {
    const results = searchProductList(products, "Kids");
    expect(results.some((p) => p.category.toLowerCase().includes("kids"))).toBe(true);
  });

  it("returns nothing for a non-matching query", () => {
    expect(searchProductList(products, "zzzzznomatch")).toHaveLength(0);
  });
});

describe("seed catalog sizing", () => {
  it("gives kids products a kids size run, not adult sizes", () => {
    const kids = products.find((p) => p.categorySlug === "kids-collection") as Product;
    expect(kids).toBeDefined();
    // Kids footwear must not offer adult EU sizes like 38–41.
    expect(kids.sizes.every((size) => Number(size) <= 30)).toBe(true);
    expect(kids.sizes).not.toContain("40");
  });

  it("gives adult products an adult size run", () => {
    const adult = products.find((p) => p.categorySlug === "party-heels") as Product;
    expect(adult.sizes).toContain("38");
  });

  it("does not use one identical rating for every product", () => {
    const uniqueRatings = new Set(products.map((p) => p.rating));
    expect(uniqueRatings.size).toBeGreaterThan(1);
  });
});

describe("getRelatedProductsFromList", () => {
  const target = products.find((p) => p.categorySlug === "ladies-sandals") as Product;

  it("never includes the product itself", () => {
    const related = getRelatedProductsFromList(products, target);
    expect(related.some((p) => p.id === target.id)).toBe(false);
  });

  it("returns at most four items", () => {
    expect(getRelatedProductsFromList(products, target).length).toBeLessThanOrEqual(4);
  });

  it("prioritises same-category products first", () => {
    const related = getRelatedProductsFromList(products, target);
    const sameCategory = products.filter(
      (p) => p.id !== target.id && p.categorySlug === target.categorySlug,
    );
    // Every same-category sibling should appear before any cross-category filler.
    related.slice(0, sameCategory.length).forEach((p) => {
      expect(p.categorySlug).toBe(target.categorySlug);
    });
  });
});
