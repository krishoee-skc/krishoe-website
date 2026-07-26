import { describe, expect, it } from "vitest";
import {
  assertWorkQuantity,
  calculateEarnedWage,
  saturdayToFridayPeriod,
  sizeBreakdownTotal,
  workerLedgerBalance,
} from "@/lib/production-accounting-rules";

describe("production accounting rules", () => {
  it("calculates item/stage wage from accepted completed pairs", () => {
    expect(calculateEarnedWage({ totalPairs: 60, rejectedPairs: 2, ratePerPair: 18 })).toBe(1044);
  });

  it("does not earn wage for a reversed work entry", () => {
    expect(calculateEarnedWage({ totalPairs: 60, ratePerPair: 18, status: "Reversed" })).toBe(0);
  });

  it("requires the optional size breakdown to equal total pairs", () => {
    expect(sizeBreakdownTotal({ "36": 10, "37": 15, "38": 20 })).toBe(45);
    expect(() =>
      assertWorkQuantity({ totalPairs: 50, ratePerPair: 10 }, { "36": 10, "37": 15 }),
    ).toThrow("Size-wise pairs must match total pairs.");
  });

  it("keeps earned work separate from kharcha and advances", () => {
    expect(workerLedgerBalance([
      { kind: "Earned Wage", amount: 5760 },
      { kind: "Midweek Advance", direction: "Paid", amount: 1000 },
      { kind: "Saturday Kharcha", direction: "Paid", amount: 3500 },
    ])).toBe(1260);
  });

  it("carries a negative balance when cash exceeds earned wage", () => {
    expect(workerLedgerBalance([
      { kind: "Earned Wage", amount: 1500 },
      { kind: "Midweek Advance", direction: "Paid", amount: 2000 },
    ])).toBe(-500);
  });

  it("builds the factory Saturday-to-Friday statement period", () => {
    expect(saturdayToFridayPeriod("2026-07-31")).toEqual({
      start: "2026-07-25",
      end: "2026-07-31",
    });
    expect(saturdayToFridayPeriod("2026-08-01")).toEqual({
      start: "2026-08-01",
      end: "2026-08-07",
    });
  });
});
