import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  getProducts: vi.fn(),
  getOrders: vi.fn<() => Promise<{ status: string; items: { productId: string; quantity: number }[] }[]>>(
    () => Promise.resolve([]),
  ),
}));

vi.mock("@/lib/product-store", () => ({ getProducts: store.getProducts }));
// Stubbed so these stay unit tests. Without it computeAuthoritativeOrderTotal
// reads data/orders.json, and the suite would quietly start depending on
// whatever orders happen to be sitting there.
vi.mock("@/lib/submissions", () => ({ getOrders: store.getOrders }));

import {
  computeAuthoritativeOrderTotal,
  describeStockShortfalls,
  findStockShortfalls,
} from "@/lib/order-pricing";
import type { Product } from "@/lib/products";

// findStockShortfalls only reads id, name, and stock, so the fixture carries
// just those; the cast keeps the test readable without a 25-field literal.
function product(id: string, name: string, stock: number) {
  return { id, name, stock } as Product;
}

const catalog = [
  product("kids-runner", "Kids Daily Runner", 95),
  product("cloud-slippers", "Cloud Step Slippers", 480),
  product("sold-out-sandals", "Signature Ladies Sandals", 0),
];

describe("findStockShortfalls", () => {
  it("allows an order within stock", () => {
    expect(findStockShortfalls(catalog, [{ productId: "kids-runner", quantity: 95 }])).toEqual([]);
  });

  it("reports an order beyond stock", () => {
    expect(findStockShortfalls(catalog, [{ productId: "kids-runner", quantity: 96 }])).toEqual([
      { productId: "kids-runner", productName: "Kids Daily Runner", requested: 96, available: 95 },
    ]);
  });

  it("reports an out of stock product", () => {
    expect(findStockShortfalls(catalog, [{ productId: "sold-out-sandals", quantity: 1 }])).toEqual([
      {
        productId: "sold-out-sandals",
        productName: "Signature Ladies Sandals",
        requested: 1,
        available: 0,
      },
    ]);
  });

  it("sums the same product across cart lines", () => {
    // Two sizes of the same shoe: 60 + 60 = 120 against 95 in stock. Checked
    // line by line, both would pass.
    expect(
      findStockShortfalls(catalog, [
        { productId: "kids-runner", quantity: 60 },
        { productId: "kids-runner", quantity: 60 },
      ]),
    ).toEqual([
      { productId: "kids-runner", productName: "Kids Daily Runner", requested: 120, available: 95 },
    ]);
  });

  it("allows split cart lines that together stay within stock", () => {
    expect(
      findStockShortfalls(catalog, [
        { productId: "kids-runner", quantity: 50 },
        { productId: "kids-runner", quantity: 45 },
      ]),
    ).toEqual([]);
  });

  it("reports every short product, not just the first", () => {
    const shortfalls = findStockShortfalls(catalog, [
      { productId: "kids-runner", quantity: 200 },
      { productId: "sold-out-sandals", quantity: 5 },
    ]);
    expect(shortfalls.map((row) => row.productId)).toEqual(["kids-runner", "sold-out-sandals"]);
  });

  it("leaves unknown products to the matched/unknown counters", () => {
    expect(findStockShortfalls(catalog, [{ productId: "ghost", quantity: 10 }])).toEqual([]);
  });

  it("treats negative catalog stock as zero rather than as credit", () => {
    const broken = [product("broken", "Broken Row", -20)];
    expect(findStockShortfalls(broken, [{ productId: "broken", quantity: 1 }])).toEqual([
      { productId: "broken", productName: "Broken Row", requested: 1, available: 0 },
    ]);
  });

  it("returns nothing for an empty cart", () => {
    expect(findStockShortfalls(catalog, [])).toEqual([]);
  });
});

describe("describeStockShortfalls", () => {
  it("says out of stock when nothing is left", () => {
    expect(
      describeStockShortfalls([
        { productId: "x", productName: "Signature Ladies Sandals", requested: 2, available: 0 },
      ]),
    ).toBe("Signature Ladies Sandals is out of stock");
  });

  it("says how many are left when some are", () => {
    expect(
      describeStockShortfalls([
        { productId: "x", productName: "Kids Daily Runner", requested: 96, available: 95 },
      ]),
    ).toBe("Kids Daily Runner has only 95 left (you asked for 96)");
  });

  it("joins several shortfalls", () => {
    expect(
      describeStockShortfalls([
        { productId: "a", productName: "A", requested: 2, available: 1 },
        { productId: "b", productName: "B", requested: 1, available: 0 },
      ]),
    ).toBe("A has only 1 left (you asked for 2). B is out of stock");
  });
});

describe("computeAuthoritativeOrderTotal stock reporting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.getProducts.mockResolvedValue([
      { id: "kids-runner", name: "Kids Daily Runner", priceValue: 199900, stock: 95 },
    ]);
  });

  it("reports no shortfall for an order within stock", async () => {
    const pricing = await computeAuthoritativeOrderTotal([{ productId: "kids-runner", quantity: 2 }]);
    expect(pricing.shortfalls).toEqual([]);
    expect(pricing.totalPaisa).toBe(399800);
  });

  it("reports a shortfall for an order beyond stock", async () => {
    const pricing = await computeAuthoritativeOrderTotal([
      { productId: "kids-runner", quantity: 500 },
    ]);
    expect(pricing.shortfalls).toEqual([
      { productId: "kids-runner", productName: "Kids Daily Runner", requested: 500, available: 95 },
    ]);
  });

  it("judges stock against the same catalog read the price came from", async () => {
    await computeAuthoritativeOrderTotal([{ productId: "kids-runner", quantity: 500 }]);
    expect(store.getProducts).toHaveBeenCalledTimes(1);
  });

  it("counts pairs that open orders are already holding", async () => {
    store.getOrders.mockResolvedValue([
      { status: "New", items: [{ productId: "kids-runner", quantity: 90 }] },
    ]);

    // 95 in the catalog, 90 held by an open order, so 6 must not pass.
    const pricing = await computeAuthoritativeOrderTotal([{ productId: "kids-runner", quantity: 6 }]);
    expect(pricing.shortfalls).toEqual([
      { productId: "kids-runner", productName: "Kids Daily Runner", requested: 6, available: 5 },
    ]);
  });

  it("frees the pairs again once that order is cancelled", async () => {
    store.getOrders.mockResolvedValue([
      { status: "Cancelled", items: [{ productId: "kids-runner", quantity: 90 }] },
    ]);

    const pricing = await computeAuthoritativeOrderTotal([{ productId: "kids-runner", quantity: 90 }]);
    expect(pricing.shortfalls).toEqual([]);
  });

  it("names what was bought from the catalog, not from the request", async () => {
    const pricing = await computeAuthoritativeOrderTotal([
      { productId: "kids-runner", quantity: 2, size: "40", color: "Black" },
    ]);

    expect(pricing.orderItems).toEqual([
      {
        productId: "kids-runner",
        productName: "Kids Daily Runner",
        size: "40",
        color: "Black",
        quantity: 2,
      },
    ]);
  });

  it("leaves unknown products out of the stored items", async () => {
    const pricing = await computeAuthoritativeOrderTotal([{ productId: "ghost", quantity: 2 }]);
    expect(pricing.orderItems).toEqual([]);
    expect(pricing.unknownItems).toBe(1);
  });
});
