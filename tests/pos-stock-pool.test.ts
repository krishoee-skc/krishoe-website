import { describe, expect, it } from "vitest";
import { preflightSaleStock, resolveStockRow } from "@/lib/pos";
import type { FinishedStock, OperationsData } from "@/lib/operations";
import type { PosInvoiceItem } from "@/lib/pos";

function stockRow(overrides: Partial<FinishedStock> = {}): FinishedStock {
  return {
    id: "FS-1",
    design: "Ladies Flat",
    channel: "Wholesale",
    sizeRun: "Mixed",
    stockPairs: 3,
    soldPairs: 0,
    returnedPairs: 0,
    ...overrides,
  };
}

function item(overrides: Partial<PosInvoiceItem> = {}): PosInvoiceItem {
  return { id: "IT-1", sku: "", design: "Ladies Flat", sizeRun: "Mixed", quantity: 1, rate: 899, discount: 0, lineTotal: 899, ...overrides };
}

function operations(finishedStock: FinishedStock[]): OperationsData {
  // Only finishedStock is read by the preflight; the rest is filler.
  return { finishedStock } as unknown as OperationsData;
}

// The shop holds a design's pairs once, not a separate pile per channel. Stock
// bought on wholesale must sell on retail or online just the same — the bug the
// owner hit was "Ladies Flat Retail stock row was not found" while 3 pairs sat
// in the wholesale row.
describe("stock is one pool, found whatever channel it sits in", () => {
  it("finds a design's stock even when it lives on another channel", () => {
    const found = resolveStockRow([stockRow({ channel: "Wholesale" })], "Ladies Flat", "Mixed");

    expect(found?.id).toBe("FS-1");
    expect(found?.stockPairs).toBe(3);
  });

  it("prefers the exact size, then Mixed, then a range, then the fullest row", () => {
    const rows = [
      stockRow({ id: "mixed", sizeRun: "Mixed", stockPairs: 2 }),
      stockRow({ id: "exact", sizeRun: "40", stockPairs: 1 }),
      stockRow({ id: "range", sizeRun: "36-41", stockPairs: 5 }),
    ];

    expect(resolveStockRow(rows, "Ladies Flat", "40")?.id).toBe("exact");
    expect(resolveStockRow(rows, "Ladies Flat", "39")?.id).toBe("mixed");
    expect(
      resolveStockRow(rows.filter((row) => row.id !== "mixed"), "Ladies Flat", "39")?.id,
    ).toBe("range");
  });

  it("returns nothing for a design that has never been stocked", () => {
    expect(resolveStockRow([stockRow()], "PU Chappal", "Mixed")).toBeUndefined();
  });
});

describe("the sale stock check reads the pool, not a channel bucket", () => {
  it("passes a retail sale drawn from wholesale-held stock", () => {
    // The exact case: stock in Wholesale, sold on Retail — no longer refused.
    expect(() => preflightSaleStock(operations([stockRow({ channel: "Wholesale" })]), [item({ quantity: 3 })])).not.toThrow();
  });

  it("still refuses more than the pool holds", () => {
    expect(() => preflightSaleStock(operations([stockRow({ stockPairs: 3 })]), [item({ quantity: 4 })])).toThrow(
      /has only 3 pairs/,
    );
  });

  it("refuses a design that is not in stock at all", () => {
    expect(() => preflightSaleStock(operations([]), [item()])).toThrow(/is not in stock yet/);
  });

  it("sums pairs of the same design across lines against the one pool", () => {
    expect(() =>
      preflightSaleStock(operations([stockRow({ stockPairs: 3 })]), [item({ quantity: 2 }), item({ quantity: 2 })]),
    ).toThrow(/has only 3 pairs/);
  });
});
