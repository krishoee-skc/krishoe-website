import { describe, expect, it } from "vitest";
import {
  applyStockMovementToStock,
  isStockOutMovement,
  reverseStockMovementFromStock,
  type FinishedStock,
  type StockMovementType,
} from "@/lib/operations";
import { withStockMovementApplied, withStockMovementReversed } from "@/lib/stock-rules";

function stock(overrides: Partial<FinishedStock> = {}): FinishedStock {
  return {
    id: "STOCK-1",
    design: "Cloud Step Slippers",
    channel: "Wholesale",
    sizeRun: "36-41",
    stockPairs: 100,
    soldPairs: 0,
    returnedPairs: 0,
    ...overrides,
  };
}

const inbound: StockMovementType[] = ["Production In", "Purchase In", "Adjustment"];

describe("inbound movements", () => {
  it.each(inbound)("%s adds pairs to stock", (type) => {
    const row = stock({ stockPairs: 100 });
    applyStockMovementToStock(row, { type, pairs: 40 });
    expect(row.stockPairs).toBe(140);
  });

  it.each(inbound)("%s does not touch sold or returned counters", (type) => {
    const row = stock({ soldPairs: 7, returnedPairs: 3 });
    applyStockMovementToStock(row, { type, pairs: 40 });
    expect(row.soldPairs).toBe(7);
    expect(row.returnedPairs).toBe(3);
  });

  it("Purchase In can stock a design that has never been produced", () => {
    const row = stock({ stockPairs: 0 });
    applyStockMovementToStock(row, { type: "Purchase In", pairs: 500 });
    expect(row.stockPairs).toBe(500);
  });
});

describe("Return In", () => {
  it("adds pairs back to stock and records the return", () => {
    const row = stock({ stockPairs: 100, returnedPairs: 2 });
    applyStockMovementToStock(row, { type: "Return In", pairs: 5 });
    expect(row.stockPairs).toBe(105);
    expect(row.returnedPairs).toBe(7);
  });
});

describe("outbound movements", () => {
  it("Sale Out removes pairs from stock and records the sale", () => {
    const row = stock({ stockPairs: 100, soldPairs: 20 });
    applyStockMovementToStock(row, { type: "Sale Out", pairs: 30 });
    expect(row.stockPairs).toBe(70);
    expect(row.soldPairs).toBe(50);
  });

  it("Dispatch Out removes pairs without counting them as sold", () => {
    const row = stock({ stockPairs: 100, soldPairs: 20 });
    applyStockMovementToStock(row, { type: "Dispatch Out", pairs: 30 });
    expect(row.stockPairs).toBe(70);
    expect(row.soldPairs).toBe(20);
  });

  it("Market Sale counts as sold without removing stock, since dispatch already did", () => {
    const row = stock({ stockPairs: 100, soldPairs: 20 });
    applyStockMovementToStock(row, { type: "Market Sale", pairs: 30 });
    expect(row.stockPairs).toBe(100);
    expect(row.soldPairs).toBe(50);
  });
});

describe("overselling guards", () => {
  it("refuses to sell more pairs than are in stock", () => {
    const row = stock({ stockPairs: 10 });
    expect(() => applyStockMovementToStock(row, { type: "Sale Out", pairs: 11 })).toThrow(
      /has only 10 pairs/,
    );
  });

  it("refuses to dispatch more pairs than are in stock", () => {
    const row = stock({ stockPairs: 10 });
    expect(() => applyStockMovementToStock(row, { type: "Dispatch Out", pairs: 11 })).toThrow(
      /has only 10 pairs/,
    );
  });

  it("leaves stock untouched when a movement is rejected", () => {
    const row = stock({ stockPairs: 10, soldPairs: 4 });
    expect(() => applyStockMovementToStock(row, { type: "Sale Out", pairs: 11 })).toThrow();
    expect(row.stockPairs).toBe(10);
    expect(row.soldPairs).toBe(4);
  });

  it("allows selling the exact remaining stock", () => {
    const row = stock({ stockPairs: 10 });
    applyStockMovementToStock(row, { type: "Sale Out", pairs: 10 });
    expect(row.stockPairs).toBe(0);
  });

  it("names the outbound types that are stock checked", () => {
    expect(isStockOutMovement("Sale Out")).toBe(true);
    expect(isStockOutMovement("Dispatch Out")).toBe(true);
    // Market Sale does not reduce stock, so it has nothing to check against.
    expect(isStockOutMovement("Market Sale")).toBe(false);
    expect(isStockOutMovement("Purchase In")).toBe(false);
    expect(isStockOutMovement("Production In")).toBe(false);
  });
});

describe("zero and negative pairs", () => {
  it.each(["Production In", "Purchase In", "Sale Out", "Adjustment"] as StockMovementType[])(
    "%s rejects zero pairs",
    (type) => {
      expect(() => applyStockMovementToStock(stock(), { type, pairs: 0 })).toThrow(
        /must be greater than zero/,
      );
    },
  );

  it("rejects negative pairs, which would otherwise invert the movement", () => {
    expect(() => applyStockMovementToStock(stock(), { type: "Sale Out", pairs: -5 })).toThrow(
      /must be greater than zero/,
    );
  });
});

describe("reversing a movement", () => {
  it.each(inbound)("%s reversal removes the pairs it added", (type) => {
    const row = stock({ stockPairs: 100 });
    applyStockMovementToStock(row, { type, pairs: 40 });
    reverseStockMovementFromStock(row, { type, pairs: 40 });
    expect(row.stockPairs).toBe(100);
  });

  it("Sale Out reversal restores stock and unwinds the sale", () => {
    const row = stock({ stockPairs: 100, soldPairs: 20 });
    applyStockMovementToStock(row, { type: "Sale Out", pairs: 30 });
    reverseStockMovementFromStock(row, { type: "Sale Out", pairs: 30 });
    expect(row.stockPairs).toBe(100);
    expect(row.soldPairs).toBe(20);
  });

  it("Return In reversal unwinds both stock and the return counter", () => {
    const row = stock({ stockPairs: 100, returnedPairs: 2 });
    applyStockMovementToStock(row, { type: "Return In", pairs: 5 });
    reverseStockMovementFromStock(row, { type: "Return In", pairs: 5 });
    expect(row.stockPairs).toBe(100);
    expect(row.returnedPairs).toBe(2);
  });

  it("Dispatch Out reversal puts the pairs back", () => {
    const row = stock({ stockPairs: 100 });
    applyStockMovementToStock(row, { type: "Dispatch Out", pairs: 30 });
    reverseStockMovementFromStock(row, { type: "Dispatch Out", pairs: 30 });
    expect(row.stockPairs).toBe(100);
  });

  it.each(inbound)("refuses to reverse %s when the stock it added is already gone", (type) => {
    // Bought 40 pairs, sold 30, then tried to delete the purchase: the 40 are
    // no longer there to remove, and stock would silently go negative.
    const row = stock({ stockPairs: 0 });
    applyStockMovementToStock(row, { type, pairs: 40 });
    applyStockMovementToStock(row, { type: "Sale Out", pairs: 30 });

    expect(() => reverseStockMovementFromStock(row, { type, pairs: 40 })).toThrow(
      /stock depends on this movement/,
    );
    expect(row.stockPairs).toBe(10);
  });

  it("never drives sold or returned counters below zero", () => {
    const row = stock({ stockPairs: 100, soldPairs: 5, returnedPairs: 1 });
    reverseStockMovementFromStock(row, { type: "Sale Out", pairs: 50 });
    expect(row.soldPairs).toBe(0);

    const other = stock({ stockPairs: 100, returnedPairs: 1 });
    reverseStockMovementFromStock(other, { type: "Return In", pairs: 50 });
    expect(other.returnedPairs).toBe(0);
  });
});

describe("a full purchase-to-sale cycle", () => {
  it("keeps stock, sold, and returned consistent across a trading goods run", () => {
    const row = stock({ stockPairs: 0, soldPairs: 0, returnedPairs: 0 });

    // Buy 500 ready-made pairs from a supplier.
    applyStockMovementToStock(row, { type: "Purchase In", pairs: 500 });
    // Send 200 out on a vehicle.
    applyStockMovementToStock(row, { type: "Dispatch Out", pairs: 200 });
    // Sell 150 of those in the market.
    applyStockMovementToStock(row, { type: "Market Sale", pairs: 150 });
    // The unsold 50 come back.
    applyStockMovementToStock(row, { type: "Return In", pairs: 50 });
    // Sell 80 over the counter.
    applyStockMovementToStock(row, { type: "Sale Out", pairs: 80 });

    expect(row.stockPairs).toBe(270); // 500 - 200 + 50 - 80
    expect(row.soldPairs).toBe(230); // 150 market + 80 counter
    expect(row.returnedPairs).toBe(50);
  });
});

// The Postgres backend cannot mutate a row in place — it reads the row, works
// out the new totals, and writes them back. So it calls these copy-returning
// wrappers instead. They are what production runs, and until the rules moved to
// lib/stock-rules.ts they were a separate, untested reimplementation.
describe("the copy-returning wrappers the Postgres backend uses", () => {
  it("applies a movement without touching the row it was given", () => {
    const row = stock({ stockPairs: 100 });
    const next = withStockMovementApplied(row, { type: "Purchase In", pairs: 40 });

    expect(next.stockPairs).toBe(140);
    // Mutating here would corrupt the caller's row before the write succeeds.
    expect(row.stockPairs).toBe(100);
    expect(next).not.toBe(row);
  });

  it("reverses a movement without touching the row it was given", () => {
    const row = stock({ stockPairs: 100 });
    const next = withStockMovementReversed(row, { type: "Purchase In", pairs: 40 });

    expect(next.stockPairs).toBe(60);
    expect(row.stockPairs).toBe(100);
  });

  it("keeps the fields the rules do not touch", () => {
    const row = stock({ stockPairs: 100 });
    const next = withStockMovementApplied(row, { type: "Purchase In", pairs: 40 });

    expect(next.id).toBe(row.id);
    expect(next.sizeRun).toBe(row.sizeRun);
    expect(next.design).toBe(row.design);
  });

  it("enforces the same guards as the in-place rules", () => {
    // Same arithmetic, same refusals — that is the whole point of sharing them.
    expect(() => withStockMovementApplied(stock({ stockPairs: 10 }), { type: "Sale Out", pairs: 40 })).toThrow(
      /has only 10 pairs/,
    );
    expect(() => withStockMovementApplied(stock(), { type: "Purchase In", pairs: 0 })).toThrow(
      /must be greater than zero/,
    );
  });

  it("agrees with the in-place rules, movement for movement", () => {
    const types: StockMovementType[] = [
      "Production In",
      "Purchase In",
      "Adjustment",
      "Dispatch Out",
      "Sale Out",
      "Market Sale",
      "Return In",
    ];

    for (const type of types) {
      const inPlace = stock({ stockPairs: 100, soldPairs: 20, returnedPairs: 5 });
      applyStockMovementToStock(inPlace, { type, pairs: 10 });
      const copied = withStockMovementApplied(
        stock({ stockPairs: 100, soldPairs: 20, returnedPairs: 5 }),
        { type, pairs: 10 },
      );

      expect(copied).toEqual(inPlace);
    }
  });
});
