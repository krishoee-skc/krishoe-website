import { describe, expect, it } from "vitest";
import {
  availableBySize,
  hasSizeWiseStock,
  sizeInStock,
  totalAvailable,
} from "@/lib/stock-by-size";
import type { FinishedStock } from "@/lib/operations";

function row(partial: Partial<FinishedStock>): FinishedStock {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    design: partial.design ?? "bagopen",
    channel: partial.channel ?? "Online",
    sizeRun: partial.sizeRun ?? "Mixed",
    stockPairs: partial.stockPairs ?? 0,
    soldPairs: partial.soldPairs ?? 0,
    returnedPairs: partial.returnedPairs ?? 0,
  };
}

describe("size-wise stock", () => {
  const stock: FinishedStock[] = [
    row({ design: "bag open", sizeRun: "30", stockPairs: 5, soldPairs: 2 }),
    row({ design: "bag open", sizeRun: "31", stockPairs: 8 }),
    row({ design: "bag open", sizeRun: "30", stockPairs: 3, returnedPairs: 1 }), // same size, second lot
    row({ design: "Bag Open", sizeRun: "32", stockPairs: 4 }), // case variant of the same name
    row({ design: "hill sandel", sizeRun: "Mixed", stockPairs: 20 }), // not entered size-wise
  ];

  it("adds pairs per size, netting sold and returned, across lots and case variants", () => {
    const bySize = availableBySize(stock, "bag open");
    expect(bySize.get("30")).toBe(7); // (5-2) + (3+1)
    expect(bySize.get("31")).toBe(8);
    expect(bySize.get("32")).toBe(4); // matched despite "Bag Open" casing
  });

  it("totals across sizes", () => {
    expect(totalAvailable(stock, "bag open")).toBe(19); // 7 + 8 + 4
  });

  it("sells a size only when that exact size has pairs", () => {
    expect(sizeInStock(stock, "bag open", "30")).toBe(true);
    expect(sizeInStock(stock, "bag open", "40")).toBe(false); // size not stocked
  });

  it("treats a design that sold out one size as out for that size only", () => {
    const soldOut30: FinishedStock[] = [row({ design: "x", sizeRun: "30", stockPairs: 2, soldPairs: 2 })];
    expect(sizeInStock(soldOut30, "x", "30")).toBe(false);
    expect(availableBySize(soldOut30, "x").get("30")).toBe(0);
  });

  it("does not pretend a Mixed pile covers a specific size", () => {
    expect(hasSizeWiseStock(stock, "hill sandel")).toBe(false); // only "Mixed"
    expect(sizeInStock(stock, "hill sandel", "37")).toBe(false); // caller must fall back
    expect(hasSizeWiseStock(stock, "bag open")).toBe(true);
  });

  it("can scope to one sales channel", () => {
    const mixedChannels: FinishedStock[] = [
      row({ design: "y", sizeRun: "30", channel: "Online", stockPairs: 5 }),
      row({ design: "y", sizeRun: "30", channel: "Wholesale", stockPairs: 40 }),
    ];
    expect(availableBySize(mixedChannels, "y", { channel: "Online" }).get("30")).toBe(5);
    expect(availableBySize(mixedChannels, "y").get("30")).toBe(45); // all channels
  });
});
