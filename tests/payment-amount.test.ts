import { describe, expect, it } from "vitest";
import { parseOrderTotalRupees } from "@/lib/payment-amount";

// Orders store their total as a display label like "Rs. 1,999". This parser
// must recover the real rupee amount — a regression here silently disables
// payment amount verification.
describe("parseOrderTotalRupees", () => {
  it("parses the real stored format (regression: used to return 0)", () => {
    expect(parseOrderTotalRupees("Rs. 1,999")).toBe(1999);
  });

  it("parses large grouped amounts", () => {
    expect(parseOrderTotalRupees("Rs. 12,499")).toBe(12499);
    expect(parseOrderTotalRupees("Rs. 1,00,000")).toBe(100000);
  });

  it("parses a plain numeric string", () => {
    expect(parseOrderTotalRupees("1999")).toBe(1999);
  });

  it("handles an NPR label", () => {
    expect(parseOrderTotalRupees("NPR 2,500")).toBe(2500);
  });

  it("rounds decimal paisa to whole rupees", () => {
    expect(parseOrderTotalRupees("Rs. 1,999.40")).toBe(1999);
    expect(parseOrderTotalRupees("Rs. 1,999.60")).toBe(2000);
  });

  it("returns 0 for empty or non-numeric input", () => {
    expect(parseOrderTotalRupees("")).toBe(0);
    expect(parseOrderTotalRupees("Rs.")).toBe(0);
    expect(parseOrderTotalRupees("free")).toBe(0);
  });

  it("never returns a negative amount (clamps to 0)", () => {
    expect(parseOrderTotalRupees("Rs. -500")).toBe(0);
  });
});
