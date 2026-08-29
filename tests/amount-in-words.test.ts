import { describe, expect, it } from "vitest";
import { amountInWords } from "@/lib/amount-in-words";

describe("amountInWords spells a bill total in the Nepali system", () => {
  it("matches the sample bill", () => {
    expect(amountInWords(16500)).toBe("Sixteen Thousand Five Hundred Only");
  });

  it("handles small and round numbers", () => {
    expect(amountInWords(0)).toBe("Zero Only");
    expect(amountInWords(7)).toBe("Seven Only");
    expect(amountInWords(90)).toBe("Ninety Only");
    expect(amountInWords(100)).toBe("One Hundred Only");
    expect(amountInWords(115)).toBe("One Hundred Fifteen Only");
    expect(amountInWords(2850)).toBe("Two Thousand Eight Hundred Fifty Only");
  });

  it("uses Lakh and Crore, not million", () => {
    expect(amountInWords(150000)).toBe("One Lakh Fifty Thousand Only");
    expect(amountInWords(1250000)).toBe("Twelve Lakh Fifty Thousand Only");
    expect(amountInWords(10000000)).toBe("One Crore Only");
  });

  it("floors paisa and never goes negative", () => {
    expect(amountInWords(999.9)).toBe("Nine Hundred Ninety Nine Only");
    expect(amountInWords(-50)).toBe("Zero Only");
  });
});
