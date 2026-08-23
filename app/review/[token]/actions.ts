"use server";

import { revalidatePath } from "next/cache";
import { saveCustomerVoice } from "@/lib/customer-voice";
import { queryPostgres } from "@/lib/postgres/client";
import { getProductById } from "@/lib/product-store";
import { readReviewToken } from "@/lib/review-invite";
import { getOrderById } from "@/lib/submissions";
import { reportError } from "@/lib/report-error";

export type ReviewFormState = { ok: boolean; message: string };

/**
 * A review written from an emailed link, with no account behind it.
 *
 * Everything that decides whether this is allowed comes from the token, not
 * from the form: a posted orderId would be a field anybody could type. The
 * signature is the proof of purchase, and the order is read back to confirm the
 * pair was actually on it — a token is proof the shop sent the link, not proof
 * of what the link should be able to say.
 */
export async function submitInvitedReview(
  token: string,
  _previous: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const invite = readReviewToken(token);
  if (!invite) {
    // One message for every kind of wrong. A link that failed should not tell
    // whoever sent it which part it failed on.
    return { ok: false, message: "यो लिङ्क चल्दैन वा म्याद सकिएको छ।" };
  }

  const rating = Number(formData.get("rating"));
  const comment = String(formData.get("comment") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return { ok: false, message: "कति तारा दिने, छान्नुहोस्।" };
  }
  if (comment.length < 5) {
    return { ok: false, message: "दुई शब्द भए पनि लेख्नुहोस् — अरू ग्राहकलाई त्यही काम लाग्छ।" };
  }
  if (comment.length > 1200) {
    return { ok: false, message: "अलि छोटो लेख्नुहोस्।" };
  }

  try {
    const [order, product] = await Promise.all([
      getOrderById(invite.orderId),
      getProductById(invite.productId),
    ]);

    if (!order || !product) {
      return { ok: false, message: "यो लिङ्क चल्दैन वा म्याद सकिएको छ।" };
    }

    // The token says which pair; the order says whether it was ever bought.
    const bought = order.items.some(
      (item) => item.productId === invite.productId && item.quantity > 0,
    );
    if (!bought) {
      return { ok: false, message: "यो लिङ्क चल्दैन वा म्याद सकिएको छ।" };
    }

    await saveCustomerVoice({
      kind: "review",
      customerName: name || order.name,
      phone: order.phone,
      email: order.email,
      productId: product.id,
      productName: product.name,
      orderId: order.id,
      rating: Math.round(rating),
      message: comment,
      source: "review-invite",
    });
  } catch (error) {
    // A second tap on the same link hits the one-review-per-order index rather
    // than writing twice. Saying "already received" is both true and the least
    // alarming thing a customer can be told.
    if (String((error as { code?: string })?.code) === "23505") {
      return { ok: true, message: "तपाईंको राय पहिल्यै आइसकेको छ — धन्यवाद 🙏" };
    }
    reportError("save invited review", error);
    return { ok: false, message: "पठाउन सकिएन। एकैछिनपछि फेरि प्रयास गर्नुहोस्।" };
  }

  revalidatePath(`/product/${invite.productId}`);
  return {
    ok: true,
    message: "धन्यवाद 🙏 तपाईंको राय पुग्यो। KRISHOE ले हेरेर पसलमा राख्नेछ।",
  };
}

/**
 * Marks the order as invited.
 *
 * Kept beside the action it belongs with rather than in the mailer, so a resend
 * and a first send stamp the same column the same way.
 */
export async function markReviewInviteSent(orderId: string) {
  await queryPostgres(
    "customer voice",
    `UPDATE orders SET review_invite_sent_at = now() WHERE id = $1`,
    [orderId],
  );
}
