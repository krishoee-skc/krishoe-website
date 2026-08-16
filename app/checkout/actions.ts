"use server";

import { recordCheckoutAttempt } from "@/lib/checkout-attempts";
import { computeAuthoritativeOrderTotal, parseCheckoutItems } from "@/lib/order-pricing";
import { reportError } from "@/lib/report-error";
import { checkAndRecordSubmissionLimit } from "@/lib/submission-rate-limit";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Called from the checkout page once the shopper has given an email and has
 * something in the basket — the moment they have identified themselves and can
 * be written to if they walk away.
 *
 * Prices come from the server's own catalog read, not the form: the reminder
 * email quotes a total, and a total supplied by the browser is a number the
 * shopper chose. Nothing here creates an order or holds stock.
 */
export async function rememberCheckoutAttemptAction(formData: FormData) {
  const email = textValue(formData, "email");
  if (!email.includes("@")) return;

  // One shopper hammering the page must not become a write per keystroke.
  const limit = await checkAndRecordSubmissionLimit({
    bucket: "checkout-attempt",
    key: email.toLowerCase(),
    maxAttempts: 12,
    windowMs: 10 * 60_000,
  });
  if (limit.limited) return;

  try {
    const items = parseCheckoutItems(textValue(formData, "items"));
    if (items.length === 0) return;

    const pricing = await computeAuthoritativeOrderTotal(items);
    if (pricing.matchedItems === 0) return;

    const summary = pricing.orderItems
      .slice(0, 3)
      .map((item) => `${item.productName} × ${item.quantity}`)
      .join(", ");

    await recordCheckoutAttempt({
      email,
      name: textValue(formData, "name"),
      phone: textValue(formData, "phone"),
      itemCount: pricing.orderItems.reduce((total, item) => total + item.quantity, 0),
      totalPaisa: pricing.totalPaisa,
      summary: pricing.orderItems.length > 3 ? `${summary} …` : summary,
    });
  } catch (error) {
    // A shopper must never see an error for a background note-to-self.
    reportError("remember checkout attempt", error);
  }
}
