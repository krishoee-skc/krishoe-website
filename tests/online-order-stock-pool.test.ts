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
