export type CommerceAnalyticsItem = {
  id: string;
  name: string;
  /**
   * Paisa, matching `priceValue` and the cart subtotal everywhere else in this
   * codebase — named for the unit because getting it wrong is invisible.
   *
   * Meta, TikTok and GA all read `value` as whole currency. Sending paisa makes
   * every reported sale a hundred times too large, and that number is not just
   * a report: Meta bids with it. A shop would be told its ads returned 100x and
   * would spend accordingly.
   */
  pricePaisa: number;
  quantity?: number;
};

/** Paisa to rupees, to two decimals — what the ad platforms expect. */
function toRupees(paisa: number) {
  return Math.round(paisa) / 100;
}

type AnalyticsEvent =
  | "view_item"
  | "add_to_cart"
  | "begin_checkout"
  | "purchase"
  | "contact";

declare global {
  interface Window {
    fbq?: (action: string, event: string, parameters?: Record<string, unknown>) => void;
    gtag?: (action: "event", event: string, parameters?: Record<string, unknown>) => void;
    ttq?: { track?: (event: string, parameters?: Record<string, unknown>) => void };
  }
}

function eventPayload(item: CommerceAnalyticsItem) {
  const quantity = Math.max(1, Math.round(item.quantity ?? 1));
  const price = toRupees(item.pricePaisa);

  return {
    content_ids: [item.id],
    content_name: item.name,
    content_type: "product",
    contents: [{ id: item.id, quantity, item_price: price }],
    currency: "NPR",
    value: Math.round(price * quantity * 100) / 100,
    items: [{ item_id: item.id, item_name: item.name, price, quantity }],
  };
}

/**
 * Sends the same meaningful commerce moment to every tracker that is enabled.
 *
 * The tracker scripts are optional, so this is deliberately a safe no-op until
 * their public IDs are set in the deployment. It also keeps customer names,
 * phones, emails and addresses out of advertising trackers.
 */
export function trackCommerceEvent(event: AnalyticsEvent, item?: CommerceAnalyticsItem) {
  if (typeof window === "undefined") return;

  const payload = item ? eventPayload(item) : { currency: "NPR" };
  const metaEvent =
    event === "view_item"
      ? "ViewContent"
      : event === "add_to_cart"
        ? "AddToCart"
        : event === "begin_checkout"
          ? "InitiateCheckout"
          : event === "purchase"
            ? "Purchase"
            : "Contact";
  const tiktokEvent =
    event === "view_item"
      ? "ViewContent"
      : event === "add_to_cart"
        ? "AddToCart"
        : event === "begin_checkout"
          ? "InitiateCheckout"
          : event === "purchase"
            ? "CompletePayment"
            : "Contact";

  window.gtag?.("event", event, payload);
  window.fbq?.("track", metaEvent, payload);
  window.ttq?.track?.(tiktokEvent, payload);
}

export function trackContact(channel: "whatsapp" | "viber" | "facebook" | "instagram" | "tiktok") {
  trackCommerceEvent("contact");

  if (typeof window !== "undefined") {
    window.gtag?.("event", "select_content", { content_type: "contact_channel", item_id: channel });
  }
}
