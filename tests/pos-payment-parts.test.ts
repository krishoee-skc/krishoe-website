import { describe, expect, it } from "vitest";
import {
  moneyByMethod,
  paidTowardBill,
  paidTowardDue,
  paymentPartsProblem,
  readPaymentParts,
  settleExchange,
  settledByExchange,
  type PosPaymentPart,
} from "@/lib/pos-payments";

/**
 * A bill paid in more than one way.
 *
 * Part cash and part QR; an old pair traded against a new one; last month's
 * credit cleared on the same bill. The day close has to put each rupee under
 * the method it came in by, and a bill from before any of this must still add
 * up exactly as it did.
 */

describe("reading what the column holds", () => {
  it("keeps clean parts and drops anything malformed", () => {
    expect(
      readPaymentParts([
        { method: "Cash", amount: 1000, purpose: "bill" },
        { method: "QR", amount: "1600", purpose: "bill", reference: " 88123 " },
        { method: "Gold", amount: 5, purpose: "bill" },
        { method: "Cash", amount: 0, purpose: "bill" },
        null,
        "cash",
      ]),
    ).toEqual([
      { method: "Cash", amount: 1000, purpose: "bill" },
      { method: "QR", amount: 1600, purpose: "bill", reference: "88123" },
    ]);
    expect(readPaymentParts(null)).toEqual([]);
    expect(readPaymentParts({})).toEqual([]);
  });
});

describe("what the parts pay", () => {
  const parts: PosPaymentPart[] = [
    { method: "Cash", amount: 1000, purpose: "bill" },
    { method: "QR", amount: 1600, purpose: "bill", reference: "88123" },
    { method: "Cash", amount: 2500, purpose: "due" },
  ];

  it("keeps the bill apart from the old credit", () => {
    expect(paidTowardBill(parts)).toBe(2600);
    expect(paidTowardDue(parts)).toBe(2500);
  });

  it("refuses more than the bill, and a QR part with no number", () => {
    expect(paymentPartsProblem(parts, 2600)).toBe("");
    expect(paymentPartsProblem(parts, 2000)).toMatch(/more than the bill/);
    expect(paymentPartsProblem([{ method: "QR", amount: 100, purpose: "bill" }], 100)).toMatch(/transaction number/);
    // Cash and an exchange need no number.
    expect(paymentPartsProblem([{ method: "Exchange", amount: 100, purpose: "bill" }], 100)).toBe("");
  });
});

describe("the day close, method by method", () => {
  it("reads an old one-method bill exactly as before", () => {
    expect([...moneyByMethod({ kind: "Sale", paymentMethod: "Cash", paidAmount: 2600 })]).toEqual([["Cash", 2600]]);
    expect([...moneyByMethod({ kind: "Sale", paymentMethod: "Credit", paidAmount: 0 })]).toEqual([]);
  });

  it("splits a part-cash, part-QR bill, with the old credit in the drawer", () => {
    const money = moneyByMethod({
      kind: "Sale",
      paymentMethod: "Cash",
      paidAmount: 2600,
      payments: [
        { method: "Cash", amount: 1000, purpose: "bill" },
        { method: "QR", amount: 1600, purpose: "bill", reference: "88123" },
        { method: "Cash", amount: 2500, purpose: "due" },
      ],
    });
    expect(money.get("Cash")).toBe(3500);
    expect(money.get("QR")).toBe(1600);
  });

  it("takes a refund out of the drawer", () => {
    const money = moneyByMethod({
      kind: "Return",
      paymentMethod: "Cash",
      paidAmount: 0,
      payments: [
        { method: "Exchange", amount: 2400, purpose: "bill", against: "KR-BILL-1" },
        { method: "Cash", amount: 400, purpose: "refund" },
      ],
    });
    expect(money.get("Cash")).toBe(-400);
    expect(money.get("Exchange")).toBe(2400);
    expect(settledByExchange({ payments: [{ method: "Exchange", amount: 1, purpose: "bill" }] })).toBe(true);
    expect(settledByExchange({})).toBe(false);
  });
});

describe("an exchange", () => {
  it("lets the returned pair pay for the new one as far as it goes", () => {
    expect(settleExchange(2400, 2800)).toEqual({ exchanged: 2400, toPay: 400, toRefund: 0 });
    expect(settleExchange(2800, 2400)).toEqual({ exchanged: 2400, toPay: 0, toRefund: 400 });
    expect(settleExchange(2400, 2400)).toEqual({ exchanged: 2400, toPay: 0, toRefund: 0 });
  });
});
