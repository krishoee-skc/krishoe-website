"use server";

import { evaluateCoupon, getCoupon, normalizeCouponCode } from "@/lib/coupons";
import { findReferralCode, referralAsCoupon } from "@/lib/referrals";
import { getCustomerSession } from "@/lib/customer-auth";
import { computeAuthoritativeOrderTotal, parseCheckoutItems } from "@/lib/order-pricing";
import { formatPrice } from "@/lib/products";
import { reportError } from "@/lib/report-error";

/**
 * What a discount code is worth, answered while the shopper is still typing it.
 *
 * The code was accepted or refused only when the whole order was submitted.
 * A shopper who mistyped DASHAIN10 filled in their name, address, phone and
 * delivery choice, pressed the button, and got back "This code does not exist"
 * — and a shopper whose code DID work never saw a rupee of it until the order
 * was already placed. A discount nobody can see before deciding is not much of
 * a discount.
 *
 * Deliberately the same arithmetic as the real thing: the cart is priced from
 * the catalogue here exactly as `submitOrder` prices it, and `evaluateCoupon`
 * is the same function with the same minimum, ceiling and expiry rules. This
 * preview cannot promise a discount the submission then refuses, because they
 * ask the same question of the same data.
 *
 * It stays a preview all the same. Nothing here is trusted at submit time —
 * the order recomputes everything and redeems the code itself, so a tampered
 * reply to this action buys nobody anything.
 */
export type CouponPreview =
  | { status: "empty" }
  | { status: "ok"; discountLabel: string; payableLabel: string }
  | { status: "no"; reason: string }
  | { status: "unknown" };

export async function previewCouponAction(
  code: string,
  itemsField: string,
): Promise<CouponPreview> {
  const normalized = normalizeCouponCode(code);
  if (!normalized) return { status: "empty" };

  try {
    const items = parseCheckoutItems(itemsField);
    if (items.length === 0) return { status: "unknown" };

    const pricing = await computeAuthoritativeOrderTotal(items);
    if (pricing.matchedItems === 0) return { status: "unknown" };

    // A referral code is typed into the same box, because to the person typing
    // it there is no difference. Resolved the same way here as at submit.
    const session = await getCustomerSession();
    const referral = await findReferralCode(normalized);
    const coupon = referral
      ? referralAsCoupon(referral, session?.userId)
      : await getCoupon(normalized);

    const check = evaluateCoupon(coupon, pricing.totalPaisa);
    if (!check.ok) return { status: "no", reason: check.reason };

    return {
      status: "ok",
      discountLabel: formatPrice(check.discountPaisa),
      payableLabel: formatPrice(Math.max(0, pricing.totalPaisa - check.discountPaisa)),
    };
  } catch (error) {
    // A preview that cannot answer must not block the order. The submission
    // will decide for real either way.
    reportError("preview a discount code", error);
    return { status: "unknown" };
  }
}
