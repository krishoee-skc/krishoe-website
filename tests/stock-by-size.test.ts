import { describe, expect, it } from "vitest";
import {
  availableBySize,
  hasSizeWiseStock,
  isSizeTracked,
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
  // stockPairs is the live on-shelf count: Sale Out has already taken sold pairs
  // out of it, Return In has already put returns back in. soldPairs/returnedPairs
  // are histories beside it, so availability is stockPairs and these extra
  // tallies must NOT move the answer.
  const stock: FinishedStock[] = [
    row({ design: "bag open", sizeRun: "30", stockPairs: 5, soldPairs: 2 }),
    row({ design: "bag open", sizeRun: "31", stockPairs: 8 }),
    row({ design: "bag open", sizeRun: "30", stockPairs: 3, returnedPairs: 1 }), // same size, second lot
    row({ design: "Bag Open", sizeRun: "32", stockPairs: 4 }), // case variant of the same name
    row({ design: "hill sandel", sizeRun: "Mixed", stockPairs: 20 }), // not entered size-wise
  ];

  it("adds shelf pairs per size across lots and case variants, ignoring the sold/returned history", () => {
    const bySize = availableBySize(stock, "bag open");
    expect(bySize.get("30")).toBe(8); // 5 + 3 shelf pairs; the soldPairs 2 and returnedPairs 1 are already applied
    expect(bySize.get("31")).toBe(8);
    expect(bySize.get("32")).toBe(4); // matched despite "Bag Open" casing
  });

  it("totals across sizes", () => {
    expect(totalAvailable(stock, "bag open")).toBe(20); // 8 + 8 + 4
  });

  it("sells a size only when that exact size has pairs", () => {
    expect(sizeInStock(stock, "bag open", "30")).toBe(true);
    expect(sizeInStock(stock, "bag open", "40")).toBe(false); // size not stocked
  });

  it("treats a design whose shelf pairs hit zero as out for that size only", () => {
    // stockPairs 0 is the real sold-out state — the Sale Out already drove the
    // shelf to 0, and soldPairs 2 is the history of how it got there.
    const soldOut30: FinishedStock[] = [row({ design: "x", sizeRun: "30", stockPairs: 0, soldPairs: 2 })];
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

describe("isSizeTracked — the safe gate for disabling sizes", () => {
  const row2 = (design: string, sizeRun: string, stockPairs: number, soldPairs = 0): FinishedStock => ({
    id: Math.random().toString(36).slice(2), design, channel: "Online", sizeRun, stockPairs, soldPairs, returnedPairs: 0,
  });
  it("true only when every available pair is under a real size (no Mixed left)", () => {
    const pure = [row2("a", "30", 5), row2("a", "31", 8)];
    expect(isSizeTracked(pure, "a")).toBe(true);
  });
  it("false when a Mixed pile still has pairs — those sizes are unknown", () => {
    const mixedToo = [row2("b", "30", 5), row2("b", "Mixed", 50)];
    expect(isSizeTracked(mixedToo, "b")).toBe(false); // safe: fall back, don't disable
  });
  it("false when only Mixed (nothing size-wise)", () => {
    expect(isSizeTracked([row2("c", "Mixed", 20)], "c")).toBe(false);
  });
  it("ignores a sold-out real size, still tracked", () => {
    // Size 30's shelf is at 0 (soldPairs 2 is how it got there); size 31 has 3.
    const soldOut = [row2("d", "30", 0, 2), row2("d", "31", 3)];
    expect(isSizeTracked(soldOut, "d")).toBe(true); // 30 is 0 but tracked; 31 has 3
  });
});
