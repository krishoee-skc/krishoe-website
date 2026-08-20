import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { evaluateCoupon, normalizeCouponCode, type Coupon } from "@/lib/coupons";

function coupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    code: "DASHAIN10",
    kind: "percent",
    value: 10,
    minOrderPaisa: 0,
    maxDiscountPaisa: null,
    startsAt: null,
    expiresAt: null,
    maxUses: null,
    usedCount: 0,
    status: "Active",
    note: "",
    createdAt: "2026-08-16T00:00:00.000Z",
    ...overrides,
  };
}

const NOW = new Date("2026-08-16T12:00:00.000Z");

/**
 * Nothing in the shop could take a discount code before this, so no campaign
 * could exist: no launch offer, no Dashain code, no "10% off from the TikTok
 * video" — which is how a small Nepali shop gets its first hundred customers.
 */
describe("code spelling", () => {
  it("finds the same coupon however it is typed", () => {
    for (const typed of ["DASHAIN10", "dashain10", " Dashain10 ", "dashain 10"]) {
      expect(normalizeCouponCode(typed), typed).toBe("DASHAIN10");
    }
  });
});

describe("what a code is worth", () => {
  it("takes a percentage off the basket", () => {
    const result = evaluateCoupon(coupon({ value: 10 }), 200_000, NOW);
    expect(result).toMatchObject({ ok: true, discountPaisa: 20_000 });
  });

  it("takes a fixed amount off", () => {
    const result = evaluateCoupon(coupon({ kind: "amount", value: 25_000 }), 200_000, NOW);
    expect(result).toMatchObject({ ok: true, discountPaisa: 25_000 });
  });

  it("never gives back more than the basket costs", () => {
    // A Rs 500 code on a Rs 300 order is a Rs 300 discount, not a Rs 200
    // refund.
    const result = evaluateCoupon(coupon({ kind: "amount", value: 50_000 }), 30_000, NOW);
    expect(result).toMatchObject({ ok: true, discountPaisa: 30_000 });
  });

  it("caps a percentage when a ceiling is set", () => {
    // A 20% code meeting a wholesale-sized basket should not quietly give away
    // thousands.
    const result = evaluateCoupon(
      coupon({ value: 20, maxDiscountPaisa: 50_000 }),
      1_000_000,
      NOW,
    );
    expect(result).toMatchObject({ ok: true, discountPaisa: 50_000 });
  });
});

describe("when a code is refused", () => {
  it("names the minimum instead of saying invalid", () => {
    // Told "this needs Rs 1,000", a customer adds another pair. Told "invalid",
    // they leave.
    const result = evaluateCoupon(coupon({ minOrderPaisa: 100_000 }), 50_000, NOW);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain("Rs. 1,000");
  });

  it("refuses a disabled, unstarted, expired or exhausted code", () => {
    const cases: [Partial<Coupon>, RegExp][] = [
      [{ status: "Disabled" }, /no longer active/],
      [{ startsAt: "2026-09-01T00:00:00.000Z" }, /has not started/],
      [{ expiresAt: "2026-08-01T00:00:00.000Z" }, /expired/],
      [{ maxUses: 100, usedCount: 100 }, /fully used/],
    ];

    for (const [overrides, message] of cases) {
      const result = evaluateCoupon(coupon(overrides), 200_000, NOW);
      expect(result.ok, JSON.stringify(overrides)).toBe(false);
      expect(result.ok === false && result.reason).toMatch(message);
    }
  });

  it("refuses a code that does not exist", () => {
    const result = evaluateCoupon(null, 200_000, NOW);
    expect(result.ok).toBe(false);
  });

  it("refuses a code worth nothing on this order", () => {
    const result = evaluateCoupon(coupon({ value: 1 }), 50, NOW);
    expect(result.ok).toBe(false);
  });
});

describe("the checkout", () => {
  it("takes the code from the form and decides the discount on the server", async () => {
    const source = await readFile("app/actions.ts", "utf8");

    // A discount submitted by the browser would be a price the customer chose
    // for themselves — the same reason the total is recomputed here.
    expect(source).toContain('normalizeCouponCode(textValue(formData, "couponCode"))');
    // Checked as intent rather than as one expression: a referral code is now
    // resolved through the same call, deliberately, so that there stays exactly
    // one place where a price can fall. What must hold is that the worth of the
    // code is decided here, against the total this server computed.
    expect(source).toContain("evaluateCoupon(");
    expect(source).toContain("pricing.totalPaisa)");
    expect(source).toContain("getCoupon(submittedCode)");
    expect(source).not.toContain('textValue(formData, "discount')
  });

  it("counts a use only once the order exists", async () => {
    const source = await readFile("app/actions.ts", "utf8");
    const body = source.slice(source.indexOf("const record = await saveOrder"));
    // Counting at validation time would burn a use every time somebody typed a
    // code and changed their mind.
    expect(body).toContain("redeemCoupon(couponCheck.coupon.code)");
  });

  it("stores what the code took, so a campaign can be measured", async () => {
    const source = await readFile("lib/submissions.ts", "utf8");
    expect(source).toContain("coupon_code");
    expect(source).toContain("discount_paisa");
  });
});

describe("the redemption counter", () => {
  it("checks the ceiling inside the update, not before it", async () => {
    const source = await readFile("lib/coupons.ts", "utf8");
    // Two orders in the same second must not both take the last use of a
    // hundred-use code.
    expect(source).toContain("AND (max_uses IS NULL OR used_count < max_uses)");
  });
});
