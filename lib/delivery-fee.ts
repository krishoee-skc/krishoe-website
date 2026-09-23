import { formatPrice } from "@/lib/products";

/**
 * What delivery costs, decided in one place.
 *
 * The shop said "free delivery over NPR 2000" in the header, on the home page
 * and to the AI assistant, while the home page badges said "Free Shipping" to
 * everyone and the checkout said the fee would be worked out on the phone. No
 * code anywhere charged a fee or granted the free one. The customer could not
 * know what they would pay at the door, and the shop could not know whether it
 * had promised to carry the courier cost itself.
 *
 * Now the owner sets two numbers in Settings and every screen reads them:
 *
 *   feePaisa       the flat courier charge. 0 = not set: the shop confirms the
 *                  fee on the call, as it always has.
 *   freeOverPaisa  orders at or above this (after any discount) go free.
 *                  0 = no free-delivery threshold.
 *
 * Both 0 means delivery is free for everyone. Store pickup is always free.
 *
 * Deliberately free of any server import, so the checkout shows the customer
 * the same charge the server then puts on the order.
 */
export type DeliveryPricing = {
  feePaisa: number;
  freeOverPaisa: number;
};

/**
 * Until the owner saves a number, the shop keeps saying what it has always
 * said: free over NPR 2000, anything under it confirmed on the call.
 */
export const defaultDeliveryPricing: DeliveryPricing = {
  feePaisa: 0,
  freeOverPaisa: 200_000,
};

/** The shipping option that never pays for a courier. Matches lib/commerce.ts. */
export const STORE_PICKUP = "Store pickup";

export type DeliveryCharge =
  /** Nothing to pay for delivery. */
  | { kind: "free"; feePaisa: 0 }
  /** A known flat fee, added to the order total. */
  | { kind: "charged"; feePaisa: number }
  /** No fee is set, so the shop confirms it on the call; the total excludes it. */
  | { kind: "confirm"; feePaisa: 0 };

function cleanPaisa(value: unknown) {
  const number = Math.round(Number(value) || 0);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

export function cleanDeliveryPricing(input: Partial<DeliveryPricing> | null | undefined): DeliveryPricing {
  return {
    feePaisa: cleanPaisa(input?.feePaisa),
    freeOverPaisa: cleanPaisa(input?.freeOverPaisa),
  };
}

/**
 * The delivery charge for one order.
 *
 * `goodsPaisa` is what the pairs cost after any discount — the free-delivery
 * threshold is judged on what the customer actually pays for shoes, so a coupon
 * cannot push a Rs 1,900 basket over a Rs 2,000 line it never reached.
 */
export function deliveryChargeFor(
  pricing: DeliveryPricing,
  delivery: string,
  goodsPaisa: number,
): DeliveryCharge {
  if (delivery === STORE_PICKUP) return { kind: "free", feePaisa: 0 };

  const { feePaisa, freeOverPaisa } = cleanDeliveryPricing(pricing);

  if (freeOverPaisa > 0 && goodsPaisa >= freeOverPaisa) return { kind: "free", feePaisa: 0 };
  if (feePaisa > 0) return { kind: "charged", feePaisa };
  if (freeOverPaisa > 0) return { kind: "confirm", feePaisa: 0 };
  return { kind: "free", feePaisa: 0 };
}

/** The line written into the order text, so the order desk sees it too. */
export function deliveryChargeLine(charge: DeliveryCharge) {
  if (charge.kind === "charged") return `Delivery charge: ${formatPrice(charge.feePaisa)}`;
  if (charge.kind === "free") return "Delivery charge: Free";
  return "Delivery charge: to be confirmed on the call";
}

/**
 * The delivery charge an order was placed with, read back from its money.
 *
 * total = subtotal − discount + delivery, so the fee is what is left over. No
 * separate column is needed, and every order placed before this existed reads
 * back as 0, which is what it was.
 */
export function orderDeliveryFeePaisa(order: {
  subtotalPaisa?: number;
  discountPaisa?: number;
  totalPaisa?: number;
}) {
  const subtotal = cleanPaisa(order.subtotalPaisa);
  const total = cleanPaisa(order.totalPaisa);
  if (subtotal <= 0 || total <= 0) return 0;
  return Math.max(0, total + cleanPaisa(order.discountPaisa) - subtotal);
}

/** The promise the shop makes about delivery, in both languages. */
export function deliveryPromise(pricing: DeliveryPricing): { en: string; ne: string } {
  const { feePaisa, freeOverPaisa } = cleanDeliveryPricing(pricing);

  if (freeOverPaisa > 0) {
    const over = formatPrice(freeOverPaisa);
    return { en: `Free delivery over ${over}`, ne: `${over} माथि Free delivery` };
  }
  if (feePaisa > 0) {
    const fee = formatPrice(feePaisa);
    return { en: `Delivery ${fee} anywhere in Nepal`, ne: `देशभर ${fee} मा डेलिभरी` };
  }
  return { en: "Free delivery across Nepal", ne: "देशभर Free delivery" };
}

/** The delivery policy in one plain sentence, for the shop's AI assistant. */
export function deliveryPolicySentence(pricing: DeliveryPricing): string {
  const { feePaisa, freeOverPaisa } = cleanDeliveryPricing(pricing);
  const pickup = "Store pickup is always free.";

  if (feePaisa > 0 && freeOverPaisa > 0) {
    return `Delivery charge ${formatPrice(feePaisa)}; free on orders of ${formatPrice(freeOverPaisa)} or more. ${pickup}`;
  }
  if (feePaisa > 0) return `Delivery charge ${formatPrice(feePaisa)} anywhere in Nepal. ${pickup}`;
  if (freeOverPaisa > 0) {
    return `Free delivery on orders of ${formatPrice(freeOverPaisa)} or more; below that the courier charge is confirmed on the phone call. ${pickup}`;
  }
  return "Free delivery across Nepal.";
}

/** The same promise, short enough for a badge under the hero. */
export function deliveryBadge(pricing: DeliveryPricing): { en: string; ne: string } {
  const { feePaisa, freeOverPaisa } = cleanDeliveryPricing(pricing);

  if (freeOverPaisa > 0) {
    const over = formatPrice(freeOverPaisa);
    return { en: `Free over ${over}`, ne: `${over} माथि Free` };
  }
  if (feePaisa > 0) return { en: "Delivery across Nepal", ne: "देशभर डेलिभरी" };
  return { en: "Free Delivery", ne: "Free डेलिभरी" };
}
