import { describe, expect, it } from "vitest";
import type { FinishedStock, OperationsData } from "@/lib/operations";
import { preflightSaleStock, type PosInvoiceItem } from "@/lib/pos";
import { stockRowForSize } from "@/lib/stock-by-size";

/**
 * The counter asks the customer's size; the stock may not be kept by size.
 *
 * A real size sent to the database opens that exact row (findOrCreateFinished
 * Stock), and a sale from an empty new row is a refused bill. So a size-41 sale
 * of a shoe entered as one "Mixed" pile has to move the pile — while the
 * receipt still says 41. These pin which row each line moves.
 */

function row(overrides: Partial<FinishedStock>): FinishedStock {
  return {
    id: "FS-1",
    design: "Runner",
    channel: "Wholesale",
    sizeRun: "Mixed",
    stockPairs: 0,
    soldPairs: 0,
    returnedPairs: 0,
    ...overrides,
  };
}

const onlyPile = [row({ id: "FS-MIX", sizeRun: "Mixed", stockPairs: 12 })];
const bySizeOnly = [
  row({ id: "FS-40", sizeRun: "40", stockPairs: 3 }),
  row({ id: "FS-41", sizeRun: "41", stockPairs: 1 }),
];
const both = [...bySizeOnly, row({ id: "FS-MIX", sizeRun: "Mixed", stockPairs: 6 })];

describe("a sale", () => {
  it("moves the size's own row when it covers the pairs", () => {
    expect(stockRowForSize(bySizeOnly, "Runner", "40", 2, "Sale")).toBe("40");
    expect(stockRowForSize(both, "runner", "41", 1, "Sale")).toBe("41");
  });

  it("moves the mixed pile when the shoe was never counted by size", () => {
    expect(stockRowForSize(onlyPile, "Runner", "41", 1, "Sale")).toBe("Mixed");
  });

  it("moves the pile when the size's own row is short", () => {
    expect(stockRowForSize(both, "Runner", "41", 2, "Sale")).toBe("Mixed");
  });

  it("keeps the size when there is nowhere else, so the stock check names it", () => {
    expect(stockRowForSize(bySizeOnly, "Runner", "43", 1, "Sale")).toBe("43");
  });

  it("passes an old size run through untouched", () => {
    expect(stockRowForSize(onlyPile, "Runner", "39, 40, 41", 1, "Sale")).toBe("39, 40, 41");
    expect(stockRowForSize(onlyPile, "Runner", "", 1, "Sale")).toBe("Mixed");
  });
});

describe("a return", () => {
  it("goes back to its own size once the shoe is kept size-wise", () => {
    expect(stockRowForSize(bySizeOnly, "Runner", "43", 1, "Return")).toBe("43");
  });

  it("goes back to the pile it was sold from otherwise", () => {
    expect(stockRowForSize(onlyPile, "Runner", "41", 1, "Return")).toBe("Mixed");
  });
});

describe("the stock check on the routed line", () => {
  const operations = (rows: FinishedStock[]) => ({ finishedStock: rows }) as unknown as OperationsData;
  const line = (sizeRun: string, quantity: number): PosInvoiceItem => ({
    id: "IT-1",
    sku: "",
    design: "Runner",
    sizeRun,
    quantity,
    rate: 2800,
    discount: 0,
    lineTotal: 2800 * quantity,
    size: "41",
  });

  it("lets a size-41 sale of a mixed pile through", () => {
    const routed = stockRowForSize(onlyPile, "Runner", "41", 2, "Sale");
    expect(() => preflightSaleStock(operations(onlyPile), [line(routed, 2)])).not.toThrow();
  });

  it("still refuses more pairs than the size has, by name", () => {
    const routed = stockRowForSize(bySizeOnly, "Runner", "41", 2, "Sale");
    expect(() => preflightSaleStock(operations(bySizeOnly), [line(routed, 2)])).toThrow(/size 41/);
  });
});
