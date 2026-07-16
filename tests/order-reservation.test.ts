import { describe, expect, it } from "vitest";
import {
  findStockShortfalls,
  orderHoldsStock,
  reservedByProduct,
  type OrderItem,
  type ReservingOrder,
} from "@/lib/order-stock";
import type { Product } from "@/lib/products";

function product(id: string, name: string, stock: number) {
  return { id, name, stock } as Product;
}

function item(productId: string, quantity: number, size = "40"): OrderItem {
  return { productId, productName: productId, size, color: "Black", quantity };
}

function order(status: ReservingOrder["status"], items: OrderItem[]): ReservingOrder {
  return { status, items };
}

const catalog = [product("kids-runner", "Kids Daily Runner", 95)];

describe("orderHoldsStock", () => {
  it("holds stock while the order is open", () => {
    expect(orderHoldsStock("New")).toBe(true);
    expect(orderHoldsStock("Contacted")).toBe(true);
  });

  it("releases stock once the order is resolved", () => {
    // Closed means the goods went out; Cancelled means they never will. The
    // hold ends either way.
    expect(orderHoldsStock("Closed")).toBe(false);
    expect(orderHoldsStock("Cancelled")).toBe(false);
  });
});

describe("reservedByProduct", () => {
  it("counts open orders", () => {
    const reserved = reservedByProduct([order("New", [item("kids-runner", 10)])]);
    expect(reserved.get("kids-runner")).toBe(10);
  });

  it("adds up several open orders for the same product", () => {
    const reserved = reservedByProduct([
      order("New", [item("kids-runner", 10)]),
      order("Contacted", [item("kids-runner", 25)]),
    ]);
    expect(reserved.get("kids-runner")).toBe(35);
  });

  it("adds up several lines of one order", () => {
    const reserved = reservedByProduct([
      order("New", [item("kids-runner", 10, "38"), item("kids-runner", 5, "40")]),
    ]);
    expect(reserved.get("kids-runner")).toBe(15);
  });

  it("ignores cancelled orders", () => {
    const reserved = reservedByProduct([order("Cancelled", [item("kids-runner", 50)])]);
    expect(reserved.get("kids-runner")).toBeUndefined();
  });

  it("ignores closed orders", () => {
    const reserved = reservedByProduct([order("Closed", [item("kids-runner", 50)])]);
    expect(reserved.get("kids-runner")).toBeUndefined();
  });

  it("counts only the open orders in a mixed set", () => {
    const reserved = reservedByProduct([
      order("New", [item("kids-runner", 10)]),
      order("Cancelled", [item("kids-runner", 500)]),
      order("Closed", [item("kids-runner", 500)]),
      order("Contacted", [item("kids-runner", 5)]),
    ]);
    expect(reserved.get("kids-runner")).toBe(15);
  });

  it("returns nothing when there are no orders", () => {
    expect(reservedByProduct([]).size).toBe(0);
  });
});

describe("findStockShortfalls with reservations", () => {
  it("blocks the second customer from the pairs the first is holding", () => {
    // 95 in stock, an open order holds 90, so only 5 are really free.
    const reserved = reservedByProduct([order("New", [item("kids-runner", 90)])]);

    expect(findStockShortfalls(catalog, [{ productId: "kids-runner", quantity: 6 }], reserved)).toEqual(
      [{ productId: "kids-runner", productName: "Kids Daily Runner", requested: 6, available: 5 }],
    );
    expect(findStockShortfalls(catalog, [{ productId: "kids-runner", quantity: 5 }], reserved)).toEqual(
      [],
    );
  });

  it("frees the pairs again when that order is cancelled", () => {
    const held = reservedByProduct([order("New", [item("kids-runner", 90)])]);
    expect(findStockShortfalls(catalog, [{ productId: "kids-runner", quantity: 90 }], held)).toHaveLength(1);

    const released = reservedByProduct([order("Cancelled", [item("kids-runner", 90)])]);
    expect(findStockShortfalls(catalog, [{ productId: "kids-runner", quantity: 90 }], released)).toEqual(
      [],
    );
  });

  it("reports nothing available when open orders hold everything", () => {
    const reserved = reservedByProduct([order("New", [item("kids-runner", 95)])]);
    expect(findStockShortfalls(catalog, [{ productId: "kids-runner", quantity: 1 }], reserved)).toEqual(
      [{ productId: "kids-runner", productName: "Kids Daily Runner", requested: 1, available: 0 }],
    );
  });

  it("never reports negative availability when orders overhold", () => {
    // Stock can drop below what open orders already hold, e.g. after a POS sale.
    const reserved = reservedByProduct([order("New", [item("kids-runner", 200)])]);
    const shortfalls = findStockShortfalls(
      catalog,
      [{ productId: "kids-runner", quantity: 1 }],
      reserved,
    );
    expect(shortfalls[0]?.available).toBe(0);
  });

  it("behaves as before when no reservations are passed", () => {
    expect(findStockShortfalls(catalog, [{ productId: "kids-runner", quantity: 95 }])).toEqual([]);
    expect(findStockShortfalls(catalog, [{ productId: "kids-runner", quantity: 96 }])).toHaveLength(1);
  });
});
