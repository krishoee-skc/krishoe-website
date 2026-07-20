import { describe, expect, it } from "vitest";
import { buildDraftProductForDesign } from "@/lib/product-store";

// A trading design bought for the first time should land in the shop as a Draft
// the owner can finish — a name and its stock, ready for a price and a photo,
// not yet Active. The parallel to a new raw material appearing in the material
// list.
describe("a draft product built for a new finished design", () => {
  it("carries the design name and its stock", () => {
    const product = buildDraftProductForDesign("Kids Sandal", 40);

    expect(product.name).toBe("Kids Sandal");
    expect(product.stock).toBe(40);
  });

  it("starts as a Draft with no price, for the owner to set", () => {
    const product = buildDraftProductForDesign("Kids Sandal", 40);

    expect(product.status).toBe("Draft");
    expect(product.priceValue).toBe(0);
    expect(product.wholesalePriceValue).toBe(0);
  });

  it("is not shown off until the owner activates it", () => {
    const product = buildDraftProductForDesign("Kids Sandal", 40);

    expect(product.featured).toBe(false);
    expect(product.bestSeller).toBe(false);
    expect(product.newArrival).toBe(false);
  });

  it("gives it a usable id and sku so it can be edited and sold", () => {
    const product = buildDraftProductForDesign("Kids Sandal", 40);

    expect(product.id).toBeTruthy();
    expect(product.sku).toBeTruthy();
  });

  it("trims the design name and never carries negative stock", () => {
    const product = buildDraftProductForDesign("  PU Chappal  ", -5);

    expect(product.name).toBe("PU Chappal");
    expect(product.stock).toBe(0);
  });
});
