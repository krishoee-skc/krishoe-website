"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { validateDeliveryArea } from "@/lib/commerce";
import { markCheckoutRecovered } from "@/lib/checkout-attempts";
import { normalizeCouponCode } from "@/lib/coupons";
import {
  findReferralCode,
  referralIsSelfUse,
} from "@/lib/referrals";
import { getCurrentCustomer, getCustomerSession } from "@/lib/customer-auth";
import { validateCustomerProfileInput } from "@/lib/customer-profile";
import { notifyContactReceived, notifyOrderReceived } from "@/lib/notifications";
import { parseCheckoutItems } from "@/lib/order-pricing";
import { placeCheckoutOrder } from "@/lib/checkout-order";
import { getProductById } from "@/lib/product-store";
import { saveCustomerVoice } from "@/lib/customer-voice";
import { reportError, reportingErrors } from "@/lib/report-error";
import { getOrdersForCustomer, saveContactMessage } from "@/lib/submissions";
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
  const delivery = textValue(formData, "delivery");
  const payment = textValue(formData, "payment");
  const checkoutSubmissionKey = textValue(formData, "checkoutSubmissionKey");

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

  if (email && tooLong(email, 120)) {
    return errorState("Please shorten the order details and try again.");
  }

  const rateLimitError = await enforceSubmissionLimit("checkout", 8);

  if (rateLimitError) {
    return rateLimitError;
  }

  // Product ids and quantities are the only cart facts accepted from the
  // browser. Names, line totals, subtotal and final total are rebuilt while
  // the catalog rows are locked in placeCheckoutOrder.
  const items = parseCheckoutItems(textValue(formData, "items"));

  if (items.length === 0) {
    return errorState("We couldn't read your cart. Please refresh the page and try again.");
  }

  const submittedCode = normalizeCouponCode(textValue(formData, "couponCode"));
  const checkoutSession = await getCustomerSession();

  // A referral code is entered in the same box as a coupon, because to the
  // person typing it there is no difference. Resolving it into a coupon here
  // means the minimum, the cap and the server-side recalculation all apply
  // unchanged, and there stays exactly one place where a price can fall.
  const referral = submittedCode ? await findReferralCode(submittedCode) : null;

  // Signed in, the user id settles whether this is the referrer's own code.
  // Signed out it cannot, and that was the loophole — so the phone and email on
  // this very order are compared with the referrer's account as well.
  const eligibleReferral =
    referral &&
    !(await referralIsSelfUse(referral, {
      userId: checkoutSession?.userId,
      email,
      phone,
    }))
      ? referral
      : undefined;

  const session = checkoutSession;
  const profile = customerProfile.profile;
  const placement = await placeCheckoutOrder({
    checkoutSubmissionKey,
    name: profile.name,
    email: email || undefined,
    phone: profile.phone ?? "",
    address: profile.address ?? "",
    delivery,
    payment,
    items,
    submittedCode,
    customerUserId: session?.userId,
    referral: eligibleReferral,
  });

  if (!placement.ok) {
    return errorState(placement.message);
  }

  const record = placement.order;

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

  // A lost response can make the browser retry a checkout that already
  // committed. Return the same order, but do not send every notification twice.
  if (placement.replayed) {
    return successState(
      `Order request already saved. Reference: ${record.id}.`,
      record.id,
      record.total,
    );
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
        // Nepali unless the checkout says English. An order placed by any
        // other route sends nothing here and keeps the Nepali letter this
        // shop has always sent.
        language: textValue(formData, "language") === "en" ? "en" : "ne",
      }),
    );
  }

  // Send SMS notification to customer (non-blocking)
  await autoNotifyOrderCreatedBySMS(record);

  // The shop shows what is buyable = catalog minus the pairs open orders hold,
  // so this new order has just changed what every shopper should see. Push that
  // change now, exactly as an admin edit or a POS sale does — the storefront is
  // no longer left to a timed refresh to notice a pair was reserved, which is
  // how the shelf drifted out of step with real stock before.
  revalidatePath("/", "layout");

  return successState(
    `Order request saved. Reference: ${record.id}. Use WhatsApp to confirm stock and delivery timing.`,
    record.id,
    record.total,
  );
}

export async function submitReview(
  productId: string,
  _previousState: FormState,
  formData: FormData,
) {
  const comment = textValue(formData, "comment");
  const typedName = textValue(formData, "name");
  const rating = Number(formData.get("rating"));

  if (!productId || !comment || !Number.isFinite(rating) || rating < 1 || rating > 5) {
    return errorState("Please add your review and rating.");
  }

  if (comment.length < 10 || tooLong(comment, 1200)) {
    return errorState("Please keep your review short and try again.");
  }

  if (tooLong(typedName, 80)) {
    return errorState("Please keep your name short and try again.");
  }

  // Anyone may write a review — a shopper deciding between KRISHOE and a shop
  // they already know has nothing to read otherwise. Nothing appears in the
  // shop until the owner publishes it from the inbox, so an open form is not an
  // open door: the rate limit (keyed on the sender, not the account) blunts
  // spam, and the owner reads every review before a single one is shown.
  const rateLimitError = await enforceSubmissionLimit("product-review", 4);
  if (rateLimitError) return rateLimitError;

  const product = await getProductById(productId);
  if (!product) {
    return errorState("This product is no longer available for review.");
  }

  // Verified means the order arrived, not merely that someone is signed in. A
  // signed-in buyer whose pair is Closed gets the badge and a one-per-order
  // guard; everyone else may still write, unbadged.
  const customer = await getCurrentCustomer();
  const purchase = customer
    ? (await getOrdersForCustomer(customer)).find(
        (order) =>
          order.status === "Closed" &&
          order.items.some((item) => item.productId === productId && item.quantity > 0),
      )
    : undefined;

  const reviewerName =
    (typedName || customer?.name || "").trim() || "";

  try {
    await saveCustomerVoice({
      kind: "review",
      customerName: reviewerName,
      productId,
      productName: product.name,
      // The order stamps the review as verified and, through the one-review-
      // per-order index, stops the same buyer double-posting the same pair.
      orderId: purchase?.id ?? "",
      rating: Math.round(rating),
      message: comment,
      source: "site",
    });
  } catch (error) {
    // A verified buyer re-submitting the same pair hits the unique index rather
    // than writing twice. "Already received" is both true and the calmest reply.
    if (String((error as { code?: string })?.code) === "23505") {
      return successState("Your review already reached us — thank you.");
    }
    reportError(`save product review for ${productId}`, error);
    return errorState("It could not be sent. Please try again in a moment.");
  }

  revalidatePath(`/product/${productId}`);
  revalidatePath("/admin/inbox");

  return successState("Thank you. Your review is waiting for the shop to publish it.");
}
