import { describe, expect, it } from "vitest";
import { searchProducts } from "@/lib/product-search";
import type { Product } from "@/lib/products";

/**
 * Finding a pair by typing part of its name.
 *
 * The header had a search box that searched nothing: it took what was typed,
 * navigated to /shop?query=…, and let a second box do the filtering. Neither
 * showed a result until Enter was pressed, and the owner reported it as broken
 * — a fair reading of a search that never shows anything.
 */

const pair = (overrides: Partial<Product>): Product =>
  ({
    id: overrides.name?.toLowerCase().replace(/\s+/g, "-") ?? "p",
    name: "Pair",
    sku: "",
    category: "Ladies Sandals",
    badge: "",
    description: "",
    colors: [],
    sizes: [],
    stock: 10,
    price: "Rs. 999",
    ...overrides,
  }) as Product;

const catalogue = [
  pair({ name: "Doctor Chappal moto", sku: "skc-55", colors: ["black"], stock: 57 }),
  pair({ name: "bag open", sku: "006-bag-open", colors: ["brown"], stock: 60 }),
  pair({ name: "halka fom", sku: "9658B2B2", colors: ["black"], stock: 0 }),
  pair({ name: "jeans shoes", sku: "044", colors: ["blue"], stock: 55 }),
  pair({ name: "Sandal for a doctor", description: "recommended by a doctor", stock: 5 }),
];

describe("what a shopper finds", () => {
  it("finds a pair by part of its name", () => {
    const found = searchProducts(catalogue, "doct");
    expect(found[0].product.name).toBe("Doctor Chappal moto");
  });

  it("puts the pair named for the word above one that merely mentions it", () => {
    const names = searchProducts(catalogue, "doctor").map((match) => match.product.name);

    // Someone typing "doctor" wants Doctor Chappal, not a pair whose
    // description happens to say the word.
    expect(names[0]).toBe("Doctor Chappal moto");
    expect(names).toContain("Sandal for a doctor");
  });

  it("finds a pair by its SKU, which is what the shop calls it", () => {
    expect(searchProducts(catalogue, "skc-55")[0].product.name).toBe("Doctor Chappal moto");
  });

  it("finds a pair by colour", () => {
    const names = searchProducts(catalogue, "blue").map((match) => match.product.name);
    expect(names).toEqual(["jeans shoes"]);
  });

  it("ignores case and stray spacing", () => {
    expect(searchProducts(catalogue, "  BAG   ")[0].product.name).toBe("bag open");
  });
});

describe("how it narrows", () => {
  it("requires every word, so more typing shows less", () => {
    // A search that returns more for a longer phrase feels broken even when it
    // is technically correct — people add words to narrow down.
    expect(searchProducts(catalogue, "doctor chappal")).toHaveLength(1);
    expect(searchProducts(catalogue, "doctor nonsense")).toHaveLength(0);
  });

  it("shows nothing for an empty box", () => {
    expect(searchProducts(catalogue, "")).toEqual([]);
    expect(searchProducts(catalogue, "   ")).toEqual([]);
  });

  it("offers what can be bought before what cannot", () => {
    const sameRank = [
      pair({ name: "black one", colors: ["black"], stock: 0 }),
      pair({ name: "black two", colors: ["black"], stock: 12 }),
    ];

    // Leading with a sold-out pair is the search working against the shop.
    expect(searchProducts(sameRank, "black")[0].product.name).toBe("black two");
  });

  it("stops at the limit, so the panel never needs scrolling", () => {
    const many = Array.from({ length: 20 }, (_, index) => pair({ name: `sandal ${index}` }));
    expect(searchProducts(many, "sandal")).toHaveLength(6);
    expect(searchProducts(many, "sandal", 3)).toHaveLength(3);
  });
});

describe("the two boxes", () => {
  it("no longer call themselves the same thing", async () => {
    const { readFile } = await import("node:fs/promises");
    const controls = await readFile("app/shop/ShopCatalogControls.tsx", "utf8");

    // The palette finds a pair anywhere in the shop; this narrows what is
    // already on screen. A shopper could not tell which to use.
    expect(controls).not.toContain("Search name, color, SKU");
    expect(controls).toContain("यीमध्ये छान्नुहोस्");
  });

  it("shows results in the palette instead of only forwarding", async () => {
    const { readFile } = await import("node:fs/promises");
    const palette = await readFile("components/CommandSearch.tsx", "utf8");

    expect(palette).toContain("searchProducts");
    expect(palette).toContain("useCommerce()");
    // Categories only when nothing is typed.
    expect(palette).toContain("{query.trim() ? (");
  });
});
