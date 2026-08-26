import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

/**
 * A referral code does not work for the person it belongs to.
 *
 * The guard was `buyerUserId === referrerUserId`, which only has an answer when
 * the buyer is signed in — and signing out was the whole loophole. A private
 * window, your own code, 10% off, every order, forever. Worse than the discount:
 * the claim was recorded against the referrer too, so the same person also
 * collected the referral reward for introducing themselves.
 *
 * Signed out there is nothing certain to check, but the checkout does carry a
 * phone number and usually an email, and an account holds both. That catches
 * the case that actually happens — somebody with an account, ordering without
 * logging in. A determined person with a friend's phone number can still get
 * 10% off; that is a fraud problem, and the claim it writes points at the
 * referrer rather than at them.
 */

vi.mock("@/lib/postgres/client", () => ({ queryPostgres: vi.fn() }));

const users: Record<string, { id: string; email: string; phone: string | null }> = {
  "user-referrer": { id: "user-referrer", email: "Anuska@Example.com", phone: "98-1234-5678" },
};

vi.mock("@/lib/user-store", () => ({
  getSafeUserById: async (id: string) => users[id] ?? null,
}));

const lookup = { code: "KRMD5BX", referrerUserId: "user-referrer" };

describe("nobody refers themselves", () => {
  it("refuses the referrer's own code when they are signed in", async () => {
    const { referralIsSelfUse } = await import("@/lib/referrals");

    expect(await referralIsSelfUse(lookup, { userId: "user-referrer" })).toBe(true);
    expect(await referralIsSelfUse(lookup, { userId: "user-friend" })).toBe(false);
  });

  it("refuses it when they are signed out but the email matches", async () => {
    const { referralIsSelfUse } = await import("@/lib/referrals");

    // Case and spacing are how somebody types their own address twice and gets
    // two different answers.
    expect(await referralIsSelfUse(lookup, { email: "anuska@example.com" })).toBe(true);
    expect(await referralIsSelfUse(lookup, { email: "  ANUSKA@EXAMPLE.COM " })).toBe(true);
    expect(await referralIsSelfUse(lookup, { email: "friend@example.com" })).toBe(false);
  });

  it("refuses it when the phone matches, however it was written", async () => {
    const { referralIsSelfUse } = await import("@/lib/referrals");

    // A Nepali phone number gets typed with spaces, dashes and a country code,
    // and it is the same number every time.
    expect(await referralIsSelfUse(lookup, { phone: "9812345678" })).toBe(true);
    expect(await referralIsSelfUse(lookup, { phone: "98 1234 5678" })).toBe(true);
    expect(await referralIsSelfUse(lookup, { phone: "9800000000" })).toBe(false);
  });

  it("does not treat an empty contact as a match", async () => {
    const { referralIsSelfUse } = await import("@/lib/referrals");

    // Two blanks are equal, and treating that as "same person" would refuse
    // every guest in the shop.
    expect(await referralIsSelfUse(lookup, {})).toBe(false);
    expect(await referralIsSelfUse(lookup, { email: "", phone: "" })).toBe(false);
    expect(await referralIsSelfUse(lookup, { phone: "123" })).toBe(false);
  });

  it("is asked by both the preview and the order, with the same facts", () => {
    const submit = readFileSync("app/actions.ts", "utf8");
    const preview = readFileSync("app/coupon-actions.ts", "utf8");

    // A preview that promises a discount the order then refuses teaches the
    // shopper the shop is lying to them, which is worse than not previewing.
    for (const [name, source] of [["submit", submit], ["preview", preview]] as const) {
      expect(source, `${name} asks`).toContain("referralIsSelfUse");
      expect(source, `${name} passes the email`).toMatch(/email[,:]/);
      expect(source, `${name} passes the phone`).toMatch(/phone[,:]/);
    }
  });
});
