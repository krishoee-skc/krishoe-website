import { afterEach, describe, expect, it, vi } from "vitest";
import { createProductMetadata, productSearchDescription } from "@/lib/seo";
import type { Product } from "@/lib/products";

/**
 * What a Google result for one pair of shoes says.
 *
 * Two lines of text decide whether anyone clicks. They used to be the product's
 * name and its marketing sentence, which told a searcher nothing they were
 * actually deciding on — what it costs, whether it is in stock, whether it
 * reaches them.
 */
const product = (overrides: Partial<Product> = {}) =>
  ({
    id: "p1",
    name: "Ladies Flat Sandal",
    category: "Ladies Sandals",
    description: "A marketing sentence.",
    priceValue: 199900,
    stock: 12,
    image: "/images/products/flat-sandals.jpg",
    ...overrides,
  }) as Product;

describe("what a search result shows", () => {
  it("leads with the price, which is what a shopper is scanning for", () => {
    const description = productSearchDescription(product());

    expect(description.startsWith("Ladies Flat Sandal — Rs. 1,999")).toBe(true);
    // Not the paisa the price is stored in.
    expect(description).not.toContain("199900");
  });

  it("tells the truth about stock", () => {
    expect(productSearchDescription(product())).toContain("अहिले उपलब्ध");
    expect(productSearchDescription(product({ stock: 0 }))).toContain("अहिले सकियो");
    expect(productSearchDescription(product({ stock: 0 }))).not.toContain("अहिले उपलब्ध");
  });

  it("answers in both languages, because the search is typed in both", () => {
    const description = productSearchDescription(product());

    expect(description).toContain("In stock");
    expect(description).toContain("नेपालभरि delivery");
    expect(description).toContain("COD");
  });

  it("stays close to what Google will actually display", () => {
    // Roughly 155 characters get shown; much beyond that is written for nobody.
    expect(productSearchDescription(product()).length).toBeLessThan(180);
  });
});

describe("the page title", () => {
  it("carries the category, where the searched-for words live", () => {
    // "Ladies Flat Sandal" does not contain "Sandals" as a shopper types it;
    // the category does.
    const title = String(createProductMetadata(product()).title);

    expect(title).toContain("Ladies Sandals");
    expect(title).toContain("KRISHOE");
    expect(title).toContain("Nepal");
  });

  it("offers Nepali keywords as well as English", () => {
    const keywords = createProductMetadata(product()).keywords as string[];

    expect(keywords).toContain("जुत्ता");
    expect(keywords).toContain("चप्पल");
    expect(keywords).toContain("KRISHOE");
  });
});

describe("the site address handed to Google", () => {
  const ORIGINAL = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL;
    vi.resetModules();
  });

  it("falls back to a host that exists", async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    vi.resetModules();
    const { getSiteUrl } = await import("@/lib/seo");

    // The old fallback was https://krishoe.com, which is not registered — it
    // does not answer. With the variable missing, every canonical link, sitemap
    // entry and QR code would have pointed Google at a dead host.
    expect(getSiteUrl()).not.toContain("krishoe.com");
    expect(getSiteUrl()).toBe("https://krishoe-website.vercel.app");
  });
});
