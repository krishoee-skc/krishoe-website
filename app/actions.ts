"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { validateDeliveryArea } from "@/lib/commerce";
import { markCheckoutRecovered } from "@/lib/checkout-attempts";
import { evaluateCoupon, getCoupon, normalizeCouponCode, redeemCoupon } from "@/lib/coupons";
import { findReferralCode, recordReferralClaim, referralAsCoupon } from "@/lib/referrals";
import { formatPrice } from "@/lib/products";
import { getCurrentCustomer, getCustomerSession } from "@/lib/customer-auth";
import { validateCustomerProfileInput } from "@/lib/customer-profile";
import { notifyContactReceived, notifyOrderReceived } from "@/lib/notifications";
import {
  computeAuthoritativeOrderTotal,
  describeStockShortfalls,
  parseCheckoutItems,
} from "@/lib/order-pricing";
import { addProductReview, getProductById } from "@/lib/product-store";
import { reportError, reportingErrors } from "@/lib/report-error";
import { getOrdersForCustomer, saveContactMessage, saveOrder } from "@/lib/submissions";
import { notifyOrderConfirmation } from "@/lib/notifications";
import { getSiteUrl } from "@/lib/seo";
import { checkAndRecordSubmissionLimit } from "@/lib/submission-rate-limit";
import { updateUser } from "@/lib/user-store";
import { autoNotifyOrderCreatedBySMS } from "@/lib/sms-order-integration";

export type FormState = {
  ok: boolean;
  message: string;
  reference?: string;
  total?: string;
};

const successState = (message: string, reference?: string, total?: string): FormState => ({
  ok: true,
  message,
  reference,
  total,
});
const errorState = (message: string): FormState => ({ ok: false, message });

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function tooLong(value: string, maxLength: number) {
  return value.length > maxLength;
}

async function submissionKey() {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headerStore.get("x-real-ip")?.trim();
  const userAgent = headerStore.get("user-agent")?.slice(0, 120) ?? "unknown";

  return `${forwardedFor || realIp || "local"}:${userAgent}`;
}

async function enforceSubmissionLimit(bucket: string, maxAttempts: number) {
  const rateLimit = await checkAndRecordSubmissionLimit({
    bucket,
    key: await submissionKey(),
    maxAttempts,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.limited) {
    return null;
  }

  return errorState(
    `Too many requests. Please wait ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minute(s) and try again.`,
  );
}

export async function submitContact(_previousState: FormState, formData: FormData) {
  const name = textValue(formData, "name");
  const email = textValue(formData, "email");
  const message = textValue(formData, "message");

  if (!name || !email || !message) {
    return errorState("Please fill name, email, and message.");
  }

  if (!email.includes("@")) {
    return errorState("Please enter a valid email address.");
  }

  if (tooLong(name, 80) || tooLong(email, 120) || tooLong(message, 1600)) {
    return errorState("Please keep your message short and try again.");
  }

  const rateLimitError = await enforceSubmissionLimit("contact", 5);

  if (rateLimitError) {
    return rateLimitError;
  }

  const record = await saveContactMessage({ name, email, message });
  // Saved is saved. A failure to notify must not tell the customer to resend.
  await reportingErrors(`notify admin of message ${record.id}`, () =>
    notifyContactReceived(record),
  );

  return successState(
    `Thank you. KRISHOE has received your message. Reference: ${record.id}`,
    record.id,
  );
}

export async function submitCheckout(_previousState: FormState, formData: FormData) {
  const name = textValue(formData, "name");
  const email = textValue(formData, "email");
  const phone = textValue(formData, "phone");
  const address = textValue(formData, "address");
  const order = textValue(formData, "order");
  const delivery = textValue(formData, "delivery");
  const payment = textValue(formData, "payment");
  const total = textValue(formData, "total");

  if (!order) {
    return errorState("Please complete customer details before submitting the order request.");
  }

  const customerProfile = validateCustomerProfileInput(
    { name, phone, address },
    { requirePhone: true, requireAddress: true },
  );

  if (!customerProfile.ok) {
    return errorState(customerProfile.message);
  }

  const deliveryError = validateDeliveryArea(delivery);

  if (deliveryError) {
    return errorState(deliveryError);
  }

  if (
    (email && tooLong(email, 120)) ||
    tooLong(order, 4000) ||
    tooLong(total, 80)
  ) {
    return errorState("Please shorten the order details and try again.");
  }

  const rateLimitError = await enforceSubmissionLimit("checkout", 8);

  if (rateLimitError) {
    return rateLimitError;
  }

  // Never trust the client-submitted total: recompute it from catalog prices
  // using only the submitted product ids + quantities. This blocks a tampered
  // total (e.g. paying Rs.1 for a Rs.9,999 cart).
  const items = parseCheckoutItems(textValue(formData, "items"));

  if (items.length === 0) {
    return errorState("We couldn't read your cart. Please refresh the page and try again.");
  }

  const pricing = await computeAuthoritativeOrderTotal(items);

  if (pricing.matchedItems === 0) {
    return errorState("We couldn't verify the items in your cart. Please refresh and try again.");
  }

  // Block the order rather than take one we cannot fill.
  if (pricing.shortfalls.length > 0) {
    return errorState(
      `${describeStockShortfalls(pricing.shortfalls)}. Please update your cart and try again.`,
    );
  }

  // The code is the only thing taken from the form. What it is worth is decided
  // here, against the total this server just computed — a discount submitted by
  // the browser would be a price the customer chose for themselves.
  const submittedCode = normalizeCouponCode(textValue(formData, "couponCode"));
  const checkoutSession = await getCustomerSession();

  // A referral code is entered in the same box as a coupon, because to the
  // person typing it there is no difference. Resolving it into a coupon here
  // means the minimum, the cap and the server-side recalculation all apply
  // unchanged, and there stays exactly one place where a price can fall.
  const referral = submittedCode ? await findReferralCode(submittedCode) : null;
  const referralCoupon = referral
    ? referralAsCoupon(referral, checkoutSession?.userId)
    : null;

  const couponCheck = submittedCode
    ? evaluateCoupon(referralCoupon ?? (await getCoupon(submittedCode)), pricing.totalPaisa)
    : null;

  if (submittedCode && couponCheck && !couponCheck.ok) {
    return errorState(couponCheck.reason);
  }

  const discountPaisa = couponCheck?.ok ? couponCheck.discountPaisa : 0;
  const payablePaisa = Math.max(0, pricing.totalPaisa - discountPaisa);
  const authoritativeTotal = formatPrice(payablePaisa);

  const session = checkoutSession;
  const profile = customerProfile.profile;
  const record = await saveOrder(
    {
      name: profile.name,
      email: email || undefined,
      phone: profile.phone ?? "",
      address: profile.address ?? "",
      delivery,
      payment,
      order,
      // The structured list, so the order can hold stock. `order` above is the
      // same thing as a sentence, which nothing can count.
      items: pricing.orderItems,
      total: authoritativeTotal,
      couponCode: couponCheck?.ok ? couponCheck.coupon.code : undefined,
      discountPaisa,
    },
    session?.userId,
  );

  // Counted only once the order exists. Counting at validation time would burn
  // a use every time someone typed a code and then changed their mind, and a
  // hundred-use launch code would be gone before a hundred orders.
  if (couponCheck?.ok && !referralCoupon) {
    await reportingErrors(`redeem coupon ${couponCheck.coupon.code}`, () =>
      redeemCoupon(couponCheck.coupon.code),
    );
  }

  // A referral code has no use counter to burn — it is meant to be passed to
  // many people. What is recorded instead is the claim, which is what the
  // referrer eventually gets paid on, and only once the order is delivered.
  if (couponCheck?.ok && referral && referralCoupon) {
    await reportingErrors(`record referral claim for ${record.id}`, () =>
      recordReferralClaim({
        orderId: record.id,
        code: referral.code,
        referrerUserId: referral.referrerUserId,
        friendUserId: session?.userId,
      }),
    );
  }

  // Whether or not a reminder was ever sent. An attempt that turned into an
  // order on its own must stop being a candidate — nobody should be chased for
  // a basket they already paid for.
  if (email) {
    await reportingErrors(`close checkout attempt for ${email}`, () =>
      markCheckoutRecovered(email, record.id),
    );
  }

  if (session?.userId) {
    try {
      await updateUser(session.userId, profile);
    } catch (error) {
      // Checkout success should not be blocked by optional profile sync.
      reportError(`sync profile for user ${session.userId} after order ${record.id}`, error);
    }
  }

  // The order is already saved. If telling the admin about it fails, the
  // customer must still be told it worked — an error here would send them back
  // to place the same order again, and the shop would hold two.
  await reportingErrors(`notify admin of order ${record.id}`, () => notifyOrderReceived(record));

  // And the customer, who until now got nothing: the screen said the order was
  // saved and gave a reference, and closing the tab took both away. On a shop
  // that takes cash on delivery and rings to confirm, that silence sits exactly
  // where the buyer is deciding whether to trust it.
  //
  // After the order is saved and never in front of it — a mail that fails must
  // not make a saved order look unsaved to the person who placed it.
  // No address, no confirmation — and no error either. Ordering by phone
  // alone is ordinary here, and it must not be made to look like a failure.
  const customerEmail = record.email?.trim() ?? "";
  if (customerEmail) {
    await reportingErrors(`confirm order ${record.id} to the customer`, () =>
      notifyOrderConfirmation({
        email: customerEmail,
        orderId: record.id,
        customerName: record.name,
        orderText: record.order,
        total: record.total,
        payment: record.payment || record.paymentProvider || "",
        delivery: record.delivery || "",
        trackUrl: `${getSiteUrl()}/track-order`,
      }),
    );
  }

  // Send SMS notification to customer (non-blocking)
  await autoNotifyOrderCreatedBySMS(record);

  return successState(
    `Order request saved. Reference: ${record.id}. Use WhatsApp to confirm stock and delivery timing.`,
    record.id,
    authoritativeTotal,
  );
}

export async function submitReview(
  productId: string,
  _previousState: FormState,
  formData: FormData,
) {
  const comment = textValue(formData, "comment");
  const rating = Number(formData.get("rating"));

  if (!productId || !comment || !Number.isFinite(rating) || rating < 1 || rating > 5) {
    return errorState("Please add your review and rating.");
  }

  if (comment.length < 10 || tooLong(comment, 1200)) {
    return errorState("Please keep your review short and try again.");
  }

  const customer = await getCurrentCustomer();
  if (!customer) {
    return errorState("Sign in to review a product you purchased.");
  }

  const rateLimitError = await enforceSubmissionLimit("product-review", 4);
  if (rateLimitError) return rateLimitError;

  const [product, orders] = await Promise.all([
    getProductById(productId),
    getOrdersForCustomer(customer),
  ]);

  if (!product) {
    return errorState("This product is no longer available for review.");
  }

  if (product.reviews.some((review) => review.customerUserId === customer.id)) {
    return errorState("You have already reviewed this product.");
  }

  const purchase = orders.find(
    (order) =>
      order.status === "Closed" &&
      order.items.some((item) => item.productId === productId && item.quantity > 0),
  );

  if (!purchase) {
    return errorState("Reviews open after a completed purchase of this product.");
  }

  await addProductReview(productId, {
    customerUserId: customer.id,
    orderId: purchase.id,
    name: customer.name,
    comment,
    rating,
    verifiedPurchase: true,
  });

  revalidatePath(`/product/${productId}`);
  revalidatePath("/admin/reviews");

  return successState("Thank you. Your verified-purchase review is waiting for approval.");
}
