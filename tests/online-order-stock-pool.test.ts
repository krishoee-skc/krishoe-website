import { describe, expect, it } from "vitest";
import { buildOnlineOrderConversionReport } from "@/lib/order-pos";
import type { FinishedStock } from "@/lib/operations";
import type { Product } from "@/lib/products";
import type { OrderSubmission } from "@/lib/submissions";

const product = {
  id: "ladies-flat",
  sku: "LADIES-FLAT",
  name: "Ladies Flat",
  priceValue: 150000,
} as Product;

const order = {
  id: "KRS-ORD-1",
  createdAt: "2026-08-12T00:00:00.000Z",
  name: "Customer",
  phone: "9800000000",
  address: "Chitwan",
  delivery: "Home delivery",
  payment: "Cash on delivery",
  paymentStatus: "Unpaid",
  paymentProvider: "cod",
  status: "New",
  total: "Rs. 1,500",
  order: "1. Ladies Flat (ladies-flat)\n   Size: 38 / Color: Black / Qty: 2\n   Line total: Rs. 1,500",
  items: [],
} as OrderSubmission;

function stock(channel: FinishedStock["channel"]): FinishedStock {
  return {
    id: `stock-${channel}`,
    design: "Ladies Flat",
    channel,
    sizeRun: "38",
    stockPairs: 2,
    soldPairs: 0,
    returnedPairs: 0,
  };
}

describe("online order readiness uses the shared ready-stock pool", () => {
  it.each(["Factory", "Wholesale", "Retail"] as const)(
    "accepts online fulfillment from %s-held stock",
    (channel) => {
      const report = buildOnlineOrderConversionReport({
        orders: [order],
        products: [product],
        finishedStock: [stock(channel)],
        posInvoices: [],
      });

      expect(report.rows[0]?.missingStockItems).toEqual([]);
      // It remains unpaid, so the only next action is a ledger/payment choice,
      // never a false request to add duplicate Online-channel stock.
      expect(report.rows[0]?.signal).toBe("Needs ledger");
    },
  );
});

// The KRS-ORD-…VWCM case: factory finished_stock lagged behind the website, the
// owner read a bare "stock 0", and turned a fulfillable order away. On a factory
// shortfall the detail must now name BOTH pools so that never repeats.
describe("factory shortfall names both the factory and website pools", () => {
  const shortOrder = {
    ...order,
    order: "1. Ladies Flat (ladies-flat)\n   Size: 38 / Color: Black / Qty: 1\n   Line total: Rs. 1,500",
  } as OrderSubmission;

  it("says the pairs are sellable when the website pool still covers them", () => {
    const report = buildOnlineOrderConversionReport({
      orders: [shortOrder],
      products: [{ ...product, stock: 60 } as Product],
      finishedStock: [{ ...stock("Factory"), stockPairs: 0 }],
      posInvoices: [],
    });

    const detail = report.rows[0]?.missingStockItems[0] ?? "";
    expect(detail).toContain("factory 0");
    expect(detail).toContain("website 60");
    expect(detail).toContain("sellable");
    expect(report.rows[0]?.signal).toBe("Needs stock");
  });

  it("flags a real gap when both pools are short", () => {
    const report = buildOnlineOrderConversionReport({
      orders: [shortOrder],
      products: [{ ...product, stock: 0 } as Product],
      finishedStock: [{ ...stock("Factory"), stockPairs: 0 }],
      posInvoices: [],
    });

    const detail = report.rows[0]?.missingStockItems[0] ?? "";
    expect(detail).toContain("factory 0");
    expect(detail).toContain("website 0");
    expect(detail).toContain("make or source stock");
  });
});
