import type { OrderStatus } from "@/lib/submissions";

/**
 * What each order status means to the person waiting for shoes.
 *
 * "Contacted" and "Closed" are the order desk's words; neither tells a customer
 * whether anything is coming. These say what has happened and what happens next.
 *
 * Kept in its own module because the tracking page renders it in the browser,
 * and lib/order-tracking.ts reaches the database and the rate limiter — pulling
 * this from there dragged the Postgres driver into the client bundle, where
 * `fs` and `dns` do not exist and the build fails outright.
 */
export function trackingStage(status: OrderStatus) {
  switch (status) {
    case "New":
      return {
        step: 1,
        en: "Order received",
        ne: "अर्डर आइपुग्यो",
        detailEn: "We have your order and will call you shortly to confirm.",
        detailNe: "अर्डर हामीसँग आइपुग्यो — साइज र ठेगाना पक्का गर्न चाँडै फोन गर्छौँ।",
      };
    case "Contacted":
      return {
        step: 2,
        en: "Confirmed, being prepared",
        ne: "पक्का भयो — तयारी हुँदैछ",
        detailEn: "Your pair is being packed and will be sent for delivery.",
        detailNe: "तपाईंको जोडी प्याक हुँदैछ, त्यसपछि पठाइन्छ।",
      };
    case "Closed":
      return {
        step: 3,
        en: "Completed",
        ne: "पुग्यो",
        detailEn: "This order is complete. Thank you.",
        detailNe: "यो अर्डर पूरा भयो। धन्यवाद 🙏",
      };
    case "Cancelled":
      return {
        step: 0,
        en: "Cancelled",
        ne: "रद्द भयो",
        detailEn: "This order was cancelled. Call us if that is not right.",
        detailNe: "यो अर्डर रद्द भएको छ। मिलेन भने हामीलाई फोन गर्नुहोस्।",
      };
  }
}
