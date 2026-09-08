import { describe, expect, it } from "vitest";
import { money, roundedMoney } from "@/lib/format-money";

/**
 * Every rupee figure the shop shows goes through here. A wage read one way on
 * the ledger and another on the payslip is an argument, so the rules are held
 * down rather than left to whichever screen happens to format it.
 */
describe("writing a rupee amount", () => {
  it("groups the way the shop reads a number", () => {
    // Indian grouping: 1,25,000 — not 125,000.
    expect(money(125000)).toBe("Rs. 1,25,000");
    expect(money(1000)).toBe("Rs. 1,000");
  });

  it("shows the paisa when there are paisa", () => {
    expect(money(1250.5)).toBe("Rs. 1,250.50");
    expect(money(76.66)).toBe("Rs. 76.66");
  });

  it("drops the paisa when there are none, rather than writing .00", () => {
    expect(money(900)).toBe("Rs. 900");
    expect(money(0)).toBe("Rs. 0");
  });

  it("never writes a half-paisa figure that no note can pay", () => {
    // 76.665 cannot be handed over. It reads as the two-decimal amount the
    // ledger stores, not as "Rs. 76.665".
    expect(money(76.665)).toBe("Rs. 76.67");
  });

  it("writes a debt as a negative rather than hiding the sign", () => {
    expect(money(-500)).toBe("Rs. -500");
  });

  it("treats a missing amount as nothing, not as NaN on screen", () => {
    expect(money(Number.NaN)).toBe("Rs. 0");
    expect(money(undefined as unknown as number)).toBe("Rs. 0");
    expect(money(null as unknown as number)).toBe("Rs. 0");
  });
});

describe("a headline figure", () => {
  it("drops the paisa, because a month's turnover does not need them", () => {
    expect(roundedMoney(1250.5)).toBe("Rs. 1,251");
    expect(roundedMoney(125000.49)).toBe("Rs. 1,25,000");
  });

  it("rounds rather than truncating, so a total never reads lower than it is", () => {
    // Truncating 999.99 to "Rs. 999" would quietly understate what is owed.
    expect(roundedMoney(999.99)).toBe("Rs. 1,000");
  });

  it("reads an empty figure as zero", () => {
    expect(roundedMoney(Number.NaN)).toBe("Rs. 0");
  });
});
