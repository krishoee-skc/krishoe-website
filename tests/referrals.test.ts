import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  REFERRAL_MAX_DISCOUNT_PAISA,
  REFERRAL_PERCENT,
  referralAsCoupon,
} from "@/lib/referrals";
import { evaluateCoupon } from "@/lib/coupons";

/**
 * Customers bringing customers.
 *
 * Both sides get 5%, and the timing of each is the entire fraud design: the
 * friend's discount lands at checkout, because that is the only reason to type
 * the code, while the referrer is paid only once the friend's order has been
 * delivered. A discount on goods you pay for cannot be farmed; a reward paid on
 * orders that merely exist can be, by anyone willing to place orders they never
 * accept.
 */

const lookup = { code: "KRABC12", referrerUserId: "cust-1" };

describe("the discount the friend gets", () => {
  it("is 5%, through the same path a coupon takes", () => {
    const coupon = referralAsCoupon(lookup, "cust-2");
    expect(coupon).not.toBeNull();

    const check = evaluateCoupon(coupon, 200_000);
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.discountPaisa).toBe(10_000);
  });

  it("is capped, because a percentage of an unbounded number is unbounded", () => {
    // A wholesale order of Rs 50,000 would otherwise hand over Rs 2,500 on a
    // code meant to be worth about seventy rupees.
    const check = evaluateCoupon(referralAsCoupon(lookup, "cust-2"), 5_000_000);

    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.discountPaisa).toBe(REFERRAL_MAX_DISCOUNT_PAISA);
  });

  it("refuses the referrer their own code", () => {
    // Without this the cheapest referral in the shop is to yourself, forever.
    expect(referralAsCoupon(lookup, "cust-1")).toBeNull();
  });

  it("still works for a friend with no account", () => {
    // Refusing guests would remove most of the people a referrer can reach.
    expect(referralAsCoupon(lookup, undefined)).not.toBeNull();
  });

  it("has no use limit of its own", () => {
    // A referral code is meant to be passed to many people; one use per order
    // is enforced by the claim table, not by burning a counter.
    expect(referralAsCoupon(lookup, "cust-2")?.maxUses).toBeNull();
  });
});

describe("when the referrer is paid", () => {
  it("only on delivery, and only from the order desk", async () => {
    const admin = await readFile("app/admin/actions.ts", "utf8");
    const status = admin.slice(admin.indexOf("updateOrderStatusAction"));

    expect(status).toContain('validatedFields.data.status === "Closed"');
    expect(status).toContain("rewardReferrerForDeliveredOrder");
  });

  it("cannot pay twice for one order", async () => {
    const source = await readFile("lib/referrals.ts", "utf8");

    // Moving an order out of Closed and back must not mint a second coupon,
    // and two status changes arriving together must not both pay out.
    expect(source).toContain("WHERE order_id = $1 AND rewarded_at IS NULL");
    expect(source).toContain("RETURNING order_id");
  });

  it("cannot fail the order desk", async () => {
    const admin = await readFile("app/admin/actions.ts", "utf8");
    // A marketing reward must never block marking an order delivered.
    expect(admin).toContain("reportingErrors(`reward referrer");
  });

  it("issues a single-use coupon that expires", async () => {
    const source = await readFile("lib/referrals.ts", "utf8");

    // A thank-you for one referral, not a standing discount.
    expect(source).toContain("maxUses: 1");
    expect(source).toContain("REWARD_VALID_DAYS");
  });
});

describe("the code itself", () => {
  it("is one per customer, permanently", async () => {
    const migration = await readFile("scripts/migrations/20260820_referrals.sql", "utf8");

    // Someone who could mint codes could hand a fresh one to every
    // acquaintance and collect on all of them.
    expect(migration).toContain("customer_user_id text NOT NULL UNIQUE");
  });

  it("avoids characters that do not survive being read aloud", async () => {
    const source = await readFile("lib/referrals.ts", "utf8");
    const alphabet = source.match(/const alphabet = "([^"]+)"/)?.[1] ?? "";

    // This gets dictated in a shop. O/0 and I/1 are where that fails.
    expect(alphabet).not.toContain("0");
    expect(alphabet).not.toContain("O");
    expect(alphabet).not.toContain("1");
    expect(alphabet).not.toContain("I");
  });

  it("does not burn a coupon use when it is not a coupon", async () => {
    const checkout = await readFile("app/actions.ts", "utf8");
    expect(checkout).toContain("couponCheck?.ok && !referralCoupon");
    expect(checkout).toContain("recordReferralClaim");
  });
});

describe("the rate", () => {
  it("is the same on both sides", () => {
    expect(REFERRAL_PERCENT).toBe(5);
  });
});
