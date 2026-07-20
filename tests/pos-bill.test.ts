import { describe, expect, it } from "vitest";
import { autoPaidAmount, posBillTotal } from "@/lib/pos-bill";

describe("the bill total the counter pays against", () => {
  it("is items less a bill discount plus tax", () => {
    expect(posBillTotal(7400, 400, 200)).toBe(7200);
  });

  it("never falls below zero", () => {
    expect(posBillTotal(500, 900, 0)).toBe(0);
  });

  it("is just the items when there is no discount or tax", () => {
    expect(posBillTotal(7400, 0, 0)).toBe(7400);
  });
});

// The cashier asked for the paid amount to fill itself so it is not keyed on
// every sale, and to stay editable for a part payment.
describe("what the paid amount fills itself to", () => {
  it("fills the full total for a cash sale", () => {
    expect(autoPaidAmount("Cash", 7400)).toBe(7400);
  });

  it("fills the full total for QR, eSewa, cheque and bank too", () => {
    for (const method of ["QR", "eSewa", "Khalti", "Cheque", "Bank"]) {
      expect(autoPaidAmount(method, 7400)).toBe(7400);
    }
  });

  // A credit bill is the due itself, so nothing is paid up front.
  it("stays at zero for a credit bill", () => {
    expect(autoPaidAmount("Credit", 7400)).toBe(0);
  });
});
