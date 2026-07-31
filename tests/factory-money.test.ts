import { describe, expect, it } from "vitest";
import { monthKey, numeric, positiveAmount, positiveInteger, ymdDate } from "@/lib/factory-money";

describe("factory numeric parsing", () => {
  it("turns postgres numeric strings into numbers before arithmetic", () => {
    expect(numeric("300.50")).toBe(300.5);
    expect(numeric(null)).toBe(0);
    expect(numeric("not-a-number")).toBe(0);
  });

  it("accepts only positive amounts and pair counts", () => {
    expect(positiveAmount("120.25")).toBe(120.25);
    expect(positiveAmount("0")).toBeNull();
    expect(positiveInteger("12")).toBe(12);
    expect(positiveInteger("12.5")).toBeNull();
  });

  it("validates date keys used by factory APIs", () => {
    expect(ymdDate("2026-07-31")).toBe("2026-07-31");
    expect(ymdDate("31-07-2026")).toBeNull();
    expect(ymdDate("2026-02-31")).toBeNull();
    expect(monthKey("2026-07")).toBe("2026-07");
    expect(monthKey("2026-7")).toBeNull();
    expect(monthKey("2026-13")).toBeNull();
  });
});
