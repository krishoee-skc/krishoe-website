import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  describeSizeShortfalls,
  findInvalidItemOption,
  findSizeShortfalls,
  reservedBySize,
  sizeHoldKey,
} from "@/lib/checkout-item-check";
import type { FinishedStock } from "@/lib/operations";
import type { OrderItem } from "@/lib/order-stock";
import type { Product } from "@/lib/products";

/**
 * Checkout counted stock by product only and took the size as free text. A
 * size the product page showed as sold out — or one the shoe never came in —
 * could still be ordered, and the customer found out on the phone.
 */

const sandal = {
  id: "gold-sandal",
  name: "Gold Sandal",
  sizes: ["37", "38", "39"],
  colors: ["Gold", "Black"],
  stock: 10,
} as Product;

function shelf(size: string, stockPairs: number): FinishedStock {
  return { design: "Gold Sandal", sizeRun: size, stockPairs } as FinishedStock;
}

function item(size: string, quantity: number): OrderItem {
  return { productId: "gold-sandal", productName: "Gold Sandal", size, color: "Gold", quantity };
}

describe("sizes and colours the shoe comes in", () => {
  it("accepts an offered size and colour", () => {
    expect(findInvalidItemOption([{ productId: "gold-sandal", quantity: 1, size: "38", color: "Gold" }], [sandal])).toBe("");
  });

  it("refuses a size the shoe does not come in", () => {
    expect(findInvalidItemOption([{ productId: "gold-sandal", quantity: 1, size: "99", color: "Gold" }], [sandal])).toContain(
      "does not come in size 99",
    );
  });

  it("refuses a colour the shoe does not come in", () => {
    expect(findInvalidItemOption([{ productId: "gold-sandal", quantity: 1, size: "38", color: "Pink" }], [sandal])).toContain(
      "does not come in Pink",
    );
  });
});

describe("stock size by size", () => {
  const sizeWise = [shelf("37", 0), shelf("38", 2), shelf("39", 5)];

  it("refuses a size that is sold out on the shelf", () => {
    const shortfalls = findSizeShortfalls([{ productId: "gold-sandal", quantity: 1, size: "37" }], [sandal], sizeWise);
    expect(shortfalls).toEqual([
      { productId: "gold-sandal", productName: "Gold Sandal", size: "37", requested: 1, available: 0 },
    ]);
    expect(describeSizeShortfalls(shortfalls)).toBe("Gold Sandal in size 37 is sold out");
  });

  it("counts the pairs open orders already hold in that size", () => {
    const held = new Map([[sizeHoldKey("gold-sandal", "38"), 1]]);
    expect(findSizeShortfalls([{ productId: "gold-sandal", quantity: 2, size: "38" }], [sandal], sizeWise, held)).toHaveLength(1);
    expect(findSizeShortfalls([{ productId: "gold-sandal", quantity: 1, size: "38" }], [sandal], sizeWise, held)).toEqual([]);
  });

  it("adds up two cart lines of the same size", () => {
    const twoLines = [
      { productId: "gold-sandal", quantity: 1, size: "38", color: "Gold" },
      { productId: "gold-sandal", quantity: 2, size: "38", color: "Black" },
    ];
    expect(findSizeShortfalls(twoLines, [sandal], sizeWise)[0]?.requested).toBe(3);
  });

  it("leaves a design with a Mixed pile to the product total, as the product page does", () => {
    const mixed = [shelf("37", 0), shelf("Mixed", 20)];
    expect(findSizeShortfalls([{ productId: "gold-sandal", quantity: 1, size: "37" }], [sandal], mixed)).toEqual([]);
  });

  it("holds sizes only for open orders", () => {
    const now = new Date("2026-09-23T12:00:00Z");
    const held = reservedBySize(
      [
        { status: "Contacted", items: [item("38", 2)] },
        { status: "Closed", items: [item("38", 9)] },
        { status: "New", createdAt: "2026-09-23T08:00:00Z", items: [item("39", 1)] },
        { status: "New", createdAt: "2026-09-20T08:00:00Z", items: [item("39", 7)] },
      ],
      now,
    );
    expect(held.get(sizeHoldKey("gold-sandal", "38"))).toBe(2);
    expect(held.get(sizeHoldKey("gold-sandal", "39"))).toBe(1);
  });
});

describe("the checkout uses it", () => {
  it("checks options and size stock on both checkout paths", async () => {
    const checkout = await readFile("lib/checkout-order.ts", "utf8");
    expect(checkout.match(/findInvalidItemOption\(input\.items, input\.catalog\)/g)).toHaveLength(2);
    expect(checkout.match(/findSizeShortfalls\(/g)).toHaveLength(2);
    expect(checkout).toContain("GROUP BY oi.product_id, oi.size");
  });
});
