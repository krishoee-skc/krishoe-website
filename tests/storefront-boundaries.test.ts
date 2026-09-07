import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("storefront boundaries", () => {
  it("reuses the product query's review hydration", async () => {
    const page = await readFile("app/product/[id]/page.tsx", "utf8");
    const productStore = await readFile("lib/product-store.ts", "utf8");

    expect(page).toContain("const publishedReviews = product.reviews");
    expect(page).not.toContain('from "@/lib/customer-voice"');
    expect(productStore).toContain('import { cache } from "react"');
    expect(productStore).toContain("export const getProducts = cache");
  });

  it("does not mount storefront-only client services in private workspaces", async () => {
    const enhancements = await readFile("components/StorefrontEnhancements.tsx", "utf8");
    const layout = await readFile("app/layout.tsx", "utf8");

    expect(enhancements).toContain('"/admin"');
    expect(enhancements).toContain('"/worker"');
    expect(enhancements).toContain('"/account"');
    expect(enhancements).toContain('"/customer"');
    expect(layout).toContain("<StorefrontEnhancements />");
  });
});
