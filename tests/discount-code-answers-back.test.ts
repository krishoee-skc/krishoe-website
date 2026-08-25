import { readFile } from "node:fs/promises";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { evaluateCoupon, type Coupon } from "@/lib/coupons";

/**
 * A discount a shopper cannot see is not a discount.
 *
 * The box took a code and said nothing. Whether it worked was decided when the
 * whole order was submitted — so a mistyped DASHAIN10 cost the shopper their
 * name, address, phone and delivery choice before anything told them, and a
 * code that DID work never showed them a rupee of it until the order was
 * already placed. Either way the code could not do the one thing a discount
 * code is for: persuade somebody to finish buying.
 *
 * The preview and the submission have to agree. They ask the same function of
 * the same data — this file is what keeps that true.
 */

function coupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    code: "DASHAIN10",
    kind: "percent",
    value: 10,
    minOrderPaisa: 0,
    maxDiscountPaisa: null,
    maxUses: null,
    usedCount: 0,
    status: "Active",
    startsAt: null,
    expiresAt: null,
    ...overrides,
  } as Coupon;
}

describe("what the discount box says while you type", () => {
  const source = () => readFile("components/CheckoutClient.tsx", "utf8");

  it("asks the server about the code, and waits for a pause in typing", async () => {
    const checkout = await source();

    expect(checkout).toContain("previewCouponAction");
    // Not on every keystroke. Eight characters would be eight questions about
    // seven codes nobody typed.
    expect(checkout).toContain("setTimeout");
    expect(checkout).toMatch(/}, 500\);/);
  });

  it("only lets the newest answer win", async () => {
    const checkout = await source();

    // A reply about "DASHAI" arriving after one about "DASHAIN10" must be
    // dropped, or the box contradicts what is in it.
    expect(checkout).toContain("couponAsked.current === code");
  });

  it("shows the money, not just a tick", async () => {
    const checkout = await source();

    expect(checkout).toContain("discountLabel");
    expect(checkout).toContain("payableLabel");
    // Beside the button too — that is where the decision is actually made.
    expect(checkout).toContain("With your discount code");
    expect(checkout).toContain("छुटको कोड लागेपछि");
  });

  it("tells a screen reader when the answer changes", async () => {
    const checkout = await source();
    expect(checkout).toContain('aria-live="polite"');
  });
});

describe("the preview and the order agree", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("runs the same rules the submission runs", async () => {
    const preview = await readFile("app/coupon-actions.ts", "utf8");

    // Same pricing function, same coupon evaluator, same referral resolution.
    // A preview with its own arithmetic would eventually promise a discount the
    // order then refuses, which is worse than no preview at all.
    expect(preview).toContain("computeAuthoritativeOrderTotal");
    expect(preview).toContain("evaluateCoupon");
    expect(preview).toContain("referralAsCoupon");

    const submit = await readFile("app/actions.ts", "utf8");
    expect(submit).toContain("computeAuthoritativeOrderTotal");
    expect(submit).toContain("evaluateCoupon");
    expect(submit).toContain("referralAsCoupon");
  });

  it("never lets the preview be the thing that grants the discount", async () => {
    const preview = await readFile("app/coupon-actions.ts", "utf8");

    // The preview must not redeem, must not write, must not be trusted. The
    // order recomputes and redeems for itself.
    expect(preview).not.toContain("redeemCoupon");
    expect(preview).not.toContain("saveOrder");
  });

  it("refuses a code below its minimum, in the preview's own arithmetic", () => {
    const check = evaluateCoupon(coupon({ minOrderPaisa: 500_000 }), 200_000);

    expect(check.ok).toBe(false);
    expect(check.ok === false && check.reason).toContain("Rs. 5,000");
  });

  it("never discounts more than the basket holds", () => {
    const check = evaluateCoupon(coupon({ kind: "amount", value: 500_000 }), 30_000);

    expect(check.ok).toBe(true);
    expect(check.ok === true && check.discountPaisa).toBe(30_000);
  });
});
