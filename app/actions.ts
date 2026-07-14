"use server";

import { headers } from "next/headers";
import { getCustomerSession } from "@/lib/customer-auth";
import { validateCustomerProfileInput } from "@/lib/customer-profile";
import { notifyContactReceived, notifyOrderReceived } from "@/lib/notifications";
import { addProductReview } from "@/lib/product-store";
import { saveContactMessage, saveOrder } from "@/lib/submissions";
import { checkAndRecordSubmissionLimit } from "@/lib/submission-rate-limit";
import { updateUser } from "@/lib/user-store";

export type FormState = {
  ok: boolean;
  message: string;
  reference?: string;
};

const successState = (message: string, reference?: string): FormState => ({
  ok: true,
  message,
  reference,
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
  await notifyContactReceived(record);

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

  const session = await getCustomerSession();
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
      total,
    },
    session?.userId,
  );

  if (session?.userId) {
    try {
      await updateUser(session.userId, profile);
    } catch {
      // Checkout success should not be blocked by optional profile sync.
    }
  }

  await notifyOrderReceived(record);

  return successState(
    `Order request saved. Reference: ${record.id}. Use WhatsApp to confirm stock and delivery timing.`,
    record.id,
  );
}

export async function submitReview(
  productId: string,
  _previousState: FormState,
  formData: FormData,
) {
  const name = textValue(formData, "name");
  const comment = textValue(formData, "comment");
  const rating = Number(formData.get("rating"));

  if (!productId || !name || !comment || !Number.isFinite(rating) || rating < 1 || rating > 5) {
    return errorState("Please add your name, review, and rating.");
  }

  if (tooLong(name, 80) || tooLong(comment, 1200)) {
    return errorState("Please keep your review short and try again.");
  }

  await addProductReview(productId, { name, comment, rating });

  return successState("Thank you. Your review is waiting for approval.");
}
