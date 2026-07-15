import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ getProducts: vi.fn() }));

vi.mock("@/lib/product-store", () => ({ getProducts: store.getProducts }));

import { computeAuthoritativeOrderTotal, parseCheckoutItems } from "@/lib/order-pricing";

beforeEach(() => {
  vi.clearAllMocks();
  store.getProducts.mockResolvedValue([
    { id: "ladies-sandals", priceValue: 199900 },
    { id: "party-heels", priceValue: 249900 },
  ]);
});

describe("parseCheckoutItems", () => {
  it("keeps valid items", () => {
    expect(parseCheckoutItems(JSON.stringify([{ productId: "x", quantity: 2 }]))).toEqual([
      { productId: "x", quantity: 2 },
    ]);
  });

  it("drops malformed and non-positive entries", () => {
    const raw = JSON.stringify([
      { productId: "x", quantity: 0 },
      { productId: "", quantity: 2 },
      { quantity: 3 },
      { productId: "y", quantity: 1 },
    ]);
    expect(parseCheckoutItems(raw)).toEqual([{ productId: "y", quantity: 1 }]);
  });

  it("returns [] for junk input", () => {
    expect(parseCheckoutItems("not json")).toEqual([]);
    expect(parseCheckoutItems("")).toEqual([]);
    expect(parseCheckoutItems(JSON.stringify({ productId: "x" }))).toEqual([]);
  });
});

describe("computeAuthoritativeOrderTotal", () => {
  it("computes the total from catalog prices (ignoring any client-sent total)", async () => {
    const priced = await computeAuthoritativeOrderTotal([
      { productId: "ladies-sandals", quantity: 2 }, // 199900 * 2 = 399800
      { productId: "party-heels", quantity: 1 }, // 249900
    ]);
    expect(priced.totalPaisa).toBe(649700);
    expect(priced.totalLabel).toBe("Rs. 6,497");
    expect(priced.matchedItems).toBe(2);
  });

  it("ignores unknown product ids so a fake price cannot be injected", async () => {
    const priced = await computeAuthoritativeOrderTotal([
      { productId: "ladies-sandals", quantity: 1 }, // 199900
      { productId: "hacker-item", quantity: 100 }, // unknown -> ignored
    ]);
    expect(priced.totalPaisa).toBe(199900);
    expect(priced.matchedItems).toBe(1);
    expect(priced.unknownItems).toBe(1);
  });

  it("reports zero matches when every item is unknown", async () => {
    const priced = await computeAuthoritativeOrderTotal([{ productId: "nope", quantity: 5 }]);
    expect(priced.matchedItems).toBe(0);
    expect(priced.totalPaisa).toBe(0);
  });
});
