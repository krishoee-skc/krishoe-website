export type CommerceAnalyticsItem = {
  id: string;
  name: string;
  price: number;
  quantity?: number;
};

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

  return {
    content_ids: [item.id],
    content_name: item.name,
    content_type: "product",
    contents: [{ id: item.id, quantity, item_price: item.price }],
    currency: "NPR",
    value: item.price * quantity,
    items: [{ item_id: item.id, item_name: item.name, price: item.price, quantity }],
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
