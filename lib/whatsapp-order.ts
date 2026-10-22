/**
 * Orders that came by WhatsApp and were typed in on the order desk (owner,
 * 2026-10-21: "mero whatsapp ma eauta order aako thiyo yaha dekhiyena").
 *
 * They are saved through the website's own checkout (lib/checkout-order.ts),
 * so stock, price and the one-order-per-press rule are the same. What marks
 * them is the retry key the checkout already stores on every order: a website
 * order carries a bare UUID, one from the desk carries this prefix. No new
 * column, nothing for the owner to switch on.
 */
export const WHATSAPP_ORDER_KEY_PREFIX = "whatsapp-";

/** The key placeCheckoutOrder stores, from the one the desk's form made when it opened. */
export function whatsappOrderKey(formKey: string) {
  const key = formKey.trim();
  return /^[A-Za-z0-9-]{16,64}$/.test(key) ? `${WHATSAPP_ORDER_KEY_PREFIX}${key}` : "";
}

export function orderCameFromWhatsApp(order: { checkoutSubmissionKey?: string }) {
  return (order.checkoutSubmissionKey ?? "").startsWith(WHATSAPP_ORDER_KEY_PREFIX);
}
