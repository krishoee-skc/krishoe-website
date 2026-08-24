import { describe, expect, it } from "vitest";
import { autoPaidAmount, posBillCreditDue, posBillTotal } from "@/lib/pos-bill";

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

// The shop lost two bills to this rule on the morning of 2026-08-24: a credit
// sale was refused after it had been keyed, in an English sentence that did not
// say what to do. The rule is right; the moment it was applied was wrong. These
// hold the rule where the bill screen can ask the question in time.
describe("whether a bill has to name a customer's account", () => {
  it("does not for a cash sale paid in full", () => {
    expect(posBillCreditDue("Sale", 7200, 7200)).toEqual({ needsAccount: false, creditAmount: 0 });
  });

  it("does for a credit sale, and says the whole amount is owed", () => {
    expect(posBillCreditDue("Sale", 7200, 0)).toEqual({ needsAccount: true, creditAmount: 7200 });
  });

  it("does for a part payment, and says only the rest is owed", () => {
    expect(posBillCreditDue("Sale", 7200, 5000)).toEqual({ needsAccount: true, creditAmount: 2200 });
  });

  it("does for every return, whatever was paid", () => {
    expect(posBillCreditDue("Return", 7200, 7200)).toEqual({ needsAccount: true, creditAmount: 0 });
  });

  it("does not while the bill is still empty, so an untouched screen stays quiet", () => {
    expect(posBillCreditDue("Sale", 0, 0)).toEqual({ needsAccount: false, creditAmount: 0 });
  });

  it("treats an overpayment as settled rather than owing a negative amount", () => {
    expect(posBillCreditDue("Sale", 7200, 8000)).toEqual({ needsAccount: false, creditAmount: 0 });
  });

  it("does not trip on rupees-and-paisa arithmetic", () => {
    expect(posBillCreditDue("Sale", 1250.1, 1250.1)).toEqual({ needsAccount: false, creditAmount: 0 });
  });
});
