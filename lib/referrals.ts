import { queryPostgres } from "@/lib/postgres/client";
import { normalizeCouponCode, saveCoupon, type Coupon } from "@/lib/coupons";

/**
 * Customers bringing customers.
 *
 * A shop this size in Nepal grows because somebody tells somebody. That already
 * happens; the shop has simply never been able to see it, reward it, or tell it
 * apart from luck.
 *
 * Both sides get 5%, and the timing of each is the entire fraud design. The
 * friend's discount lands at checkout, because that is the only reason to type
 * the code. The referrer's reward lands only when the friend's order is
 * actually delivered — a discount on goods you pay for cannot be farmed, but a
 * reward paid on orders that merely exist can be, by anyone willing to place
 * orders they never accept.
 */

const STORE = "orders";

/** Both sides. Changing it changes new rewards only; issued coupons stand. */
export const REFERRAL_PERCENT = 5;

/**
 * The most 5% may take off one order, in paisa.
 *
 * Without a ceiling this is a percentage of an unbounded number: a wholesale
 * order of Rs 50,000 would hand over Rs 2,500 on a code meant to be worth
 * about seventy rupees. Rs 500 is far above any ordinary pair and far below
 * anything that would hurt.
 */
export const REFERRAL_MAX_DISCOUNT_PAISA = 50_000;

/** How long a referrer's reward coupon stays usable. */
const REWARD_VALID_DAYS = 90;

type CodeRow = { code: string; customer_user_id: string };
type ClaimRow = {
  order_id: string;
  code: string;
  referrer_user_id: string;
  friend_user_id: string | null;
  reward_code: string | null;
  rewarded_at: Date | null;
};

/**
 * A short code a person can read aloud over the phone.
 *
 * No O/0 or I/1: this gets dictated in a shop, and a code that cannot survive
 * being spoken is one nobody passes on.
 */
function buildCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let index = 0; index < 5; index += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `KR${suffix}`;
}

/**
 * The customer's code, made on first request and never changed.
 *
 * One per customer, permanently: someone who could mint codes could hand a
 * fresh one to every acquaintance and collect on all of them.
 */
export async function referralCodeFor(customerUserId: string) {
  if (!customerUserId) return null;

  const existing = await queryPostgres<CodeRow>(
    STORE,
    `SELECT code, customer_user_id FROM referral_codes WHERE customer_user_id = $1`,
    [customerUserId],
  );
  if (existing[0]) return existing[0].code;

  // Retry on collision rather than trusting five random characters to be
  // unique — the table is small now and will not always be.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const rows = await queryPostgres<CodeRow>(
      STORE,
      `INSERT INTO referral_codes (code, customer_user_id)
       VALUES ($1, $2)
       ON CONFLICT (code) DO NOTHING
       RETURNING code, customer_user_id`,
      [buildCode(), customerUserId],
    );
    if (rows[0]) return rows[0].code;

    // Another request created this customer's code between our check and our
    // insert; take theirs.
    const raced = await queryPostgres<CodeRow>(
      STORE,
      `SELECT code, customer_user_id FROM referral_codes WHERE customer_user_id = $1`,
      [customerUserId],
    );
    if (raced[0]) return raced[0].code;
  }

  return null;
}

export type ReferralLookup = { code: string; referrerUserId: string } | null;

export async function findReferralCode(rawCode: string): Promise<ReferralLookup> {
  const code = normalizeCouponCode(rawCode);
  if (!code) return null;

  const rows = await queryPostgres<CodeRow>(
    STORE,
    `SELECT code, customer_user_id FROM referral_codes WHERE code = $1`,
    [code],
  );
  return rows[0] ? { code: rows[0].code, referrerUserId: rows[0].customer_user_id } : null;
}

/**
 * A referral code, expressed as the coupon the checkout already knows how to
 * evaluate.
 *
 * Reusing the coupon path rather than adding a second discount route means the
 * minimum-order rule, the cap and the server-side recalculation all apply
 * unchanged — and there is only one place where a price can be reduced.
 *
 * Refused for the referrer's own code. Without that check the cheapest referral
 * in the shop is to yourself, forever.
 */
export function referralAsCoupon(lookup: NonNullable<ReferralLookup>, buyerUserId?: string): Coupon | null {
  if (buyerUserId && buyerUserId === lookup.referrerUserId) return null;

  return {
    code: lookup.code,
    kind: "percent",
    value: REFERRAL_PERCENT,
    minOrderPaisa: 0,
    maxDiscountPaisa: REFERRAL_MAX_DISCOUNT_PAISA,
    startsAt: null,
    expiresAt: null,
    // A referral code is meant to be passed to many people; the limit that
    // matters is one use per order, which the claim table enforces.
    maxUses: null,
    usedCount: 0,
    status: "Active",
    note: "Referral",
    createdAt: new Date().toISOString(),
  };
}

/** Records that an order arrived through somebody's code. */
export async function recordReferralClaim(input: {
  orderId: string;
  code: string;
  referrerUserId: string;
  friendUserId?: string;
}) {
  await queryPostgres(
    STORE,
    `INSERT INTO referral_claims (order_id, code, referrer_user_id, friend_user_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (order_id) DO NOTHING`,
    [input.orderId, input.code, input.referrerUserId, input.friendUserId ?? null],
  );
}

/**
 * Pays the referrer, once, when the friend's order has been delivered.
 *
 * Called on every move to Closed, so it has to be safe to call repeatedly: the
 * update only matches a claim that has not been rewarded, and a second call
 * finds nothing to do. Reversing an order out of Closed and back must not mint
 * a second coupon.
 *
 * Never throws. A reward that could fail an order status change would make the
 * order desk unusable over a marketing feature.
 */
export async function rewardReferrerForDeliveredOrder(orderId: string) {
  const claims = await queryPostgres<ClaimRow>(
    STORE,
    `SELECT order_id, code, referrer_user_id, friend_user_id, reward_code, rewarded_at
       FROM referral_claims
      WHERE order_id = $1 AND rewarded_at IS NULL`,
    [orderId],
  );
  const claim = claims[0];
  if (!claim) return { rewarded: false as const };

  const rewardCode = `${claim.code}-${orderId.slice(-4).toUpperCase()}`;
  const expires = new Date(Date.now() + REWARD_VALID_DAYS * 86_400_000).toISOString();

  await saveCoupon({
    code: rewardCode,
    kind: "percent",
    value: REFERRAL_PERCENT,
    minOrderPaisa: 0,
    maxDiscountPaisa: REFERRAL_MAX_DISCOUNT_PAISA,
    startsAt: null,
    expiresAt: expires,
    // One use. This is a thank-you for one referral, not a standing discount.
    maxUses: 1,
    status: "Active",
    note: `Referral reward for order ${orderId}`,
  });

  // Claims the reward only if nobody else already did, so two status changes
  // arriving together cannot both pay out.
  const marked = await queryPostgres<{ order_id: string }>(
    STORE,
    `UPDATE referral_claims
        SET reward_code = $2, rewarded_at = now()
      WHERE order_id = $1 AND rewarded_at IS NULL
      RETURNING order_id`,
    [orderId, rewardCode],
  );

  return marked[0]
    ? { rewarded: true as const, rewardCode, referrerUserId: claim.referrer_user_id }
    : { rewarded: false as const };
}

export type ReferralSummary = {
  code: string;
  invited: number;
  delivered: number;
  rewards: { code: string; at: string }[];
};

/** What one customer sees about their own referrals. */
export async function referralSummary(customerUserId: string): Promise<ReferralSummary | null> {
  const code = await referralCodeFor(customerUserId);
  if (!code) return null;

  const claims = await queryPostgres<ClaimRow>(
    STORE,
    `SELECT order_id, code, referrer_user_id, friend_user_id, reward_code, rewarded_at
       FROM referral_claims WHERE referrer_user_id = $1 ORDER BY claimed_at DESC`,
    [customerUserId],
  );

  return {
    code,
    invited: claims.length,
    delivered: claims.filter((claim) => claim.rewarded_at).length,
    rewards: claims
      .filter((claim) => claim.reward_code && claim.rewarded_at)
      .map((claim) => ({
        code: claim.reward_code as string,
        at: new Date(claim.rewarded_at as Date).toISOString(),
      })),
  };
}
