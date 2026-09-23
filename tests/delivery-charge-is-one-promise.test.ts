import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  cleanDeliveryPricing,
  defaultDeliveryPricing,
  deliveryBadge,
  deliveryChargeFor,
  deliveryChargeLine,
  deliveryPolicySentence,
  deliveryPromise,
  orderDeliveryFeePaisa,
  STORE_PICKUP,
} from "@/lib/delivery-fee";
import { shippingOptions } from "@/lib/commerce";
import { buildAssistantPrompt } from "@/lib/ai/assistant-prompt";

/**
 * The shop said "free delivery over NPR 2000" in the header, "Free Shipping" to
 * everyone on the home page, and "the fee is confirmed on the call" at
 * checkout — while no code charged a fee or granted the free one. These pin the
 * one rule every screen and the order total now share.
 */

const COURIER = "Nationwide courier coordination";
const flat150Free2000 = { feePaisa: 15_000, freeOverPaisa: 200_000 };

describe("what delivery costs an order", () => {
  it("charges the flat fee under the free-delivery line", () => {
    expect(deliveryChargeFor(flat150Free2000, COURIER, 199_900)).toEqual({ kind: "charged", feePaisa: 15_000 });
  });

  it("goes free at the line itself, not only past it", () => {
    expect(deliveryChargeFor(flat150Free2000, COURIER, 200_000)).toEqual({ kind: "free", feePaisa: 0 });
  });

  it("never charges store pickup", () => {
    expect(STORE_PICKUP).toBe(shippingOptions[1]);
    expect(deliveryChargeFor(flat150Free2000, STORE_PICKUP, 50_000)).toEqual({ kind: "free", feePaisa: 0 });
  });

  it("keeps the old promise until the owner sets a fee: free over 2000, else confirmed on the call", () => {
    expect(defaultDeliveryPricing).toEqual({ feePaisa: 0, freeOverPaisa: 200_000 });
    expect(deliveryChargeFor(defaultDeliveryPricing, COURIER, 150_000).kind).toBe("confirm");
    expect(deliveryChargeFor(defaultDeliveryPricing, COURIER, 250_000).kind).toBe("free");
  });

  it("charges a flat fee on every order when there is no threshold", () => {
    expect(deliveryChargeFor({ feePaisa: 10_000, freeOverPaisa: 0 }, COURIER, 900_000).feePaisa).toBe(10_000);
  });

  it("is free for everyone when both numbers are 0", () => {
    expect(deliveryChargeFor({ feePaisa: 0, freeOverPaisa: 0 }, COURIER, 10_000).kind).toBe("free");
  });

  it("never lets a stored number go negative or fractional", () => {
    expect(cleanDeliveryPricing({ feePaisa: -5, freeOverPaisa: 12.6 })).toEqual({ feePaisa: 0, freeOverPaisa: 13 });
  });
});

describe("the charge an order carries, read back", () => {
  it("is total − subtotal + discount", () => {
    expect(orderDeliveryFeePaisa({ subtotalPaisa: 180_000, discountPaisa: 20_000, totalPaisa: 175_000 })).toBe(15_000);
  });

  it("is 0 for an order placed before delivery was charged", () => {
    expect(orderDeliveryFeePaisa({ subtotalPaisa: 180_000, discountPaisa: 20_000, totalPaisa: 160_000 })).toBe(0);
    expect(orderDeliveryFeePaisa({ totalPaisa: 160_000 })).toBe(0);
  });

  it("is written into the order text the desk and the customer read", () => {
    expect(deliveryChargeLine({ kind: "charged", feePaisa: 15_000 })).toBe("Delivery charge: Rs. 150");
    expect(deliveryChargeLine({ kind: "free", feePaisa: 0 })).toBe("Delivery charge: Free");
    expect(deliveryChargeLine({ kind: "confirm", feePaisa: 0 })).toContain("confirmed on the call");
  });
});

describe("one promise, everywhere", () => {
  it("says the same thing in the header, the badge and to the assistant", () => {
    expect(deliveryPromise(flat150Free2000).en).toBe("Free delivery over Rs. 2,000");
    expect(deliveryBadge(flat150Free2000).en).toBe("Free over Rs. 2,000");
    expect(deliveryPolicySentence(flat150Free2000)).toContain("Delivery charge Rs. 150; free on orders of Rs. 2,000 or more.");
    expect(deliveryPromise({ feePaisa: 0, freeOverPaisa: 0 }).en).toBe("Free delivery across Nepal");
  });

  it("hands the assistant the owner's policy instead of a hard-coded one", () => {
    const prompt = buildAssistantPrompt("", [], "delivery?", deliveryPolicySentence(flat150Free2000));
    expect(prompt).toContain("Delivery charge Rs. 150");
    expect(prompt).not.toContain("Free delivery on orders over NPR 2,000");
  });

  it("has no hard-coded delivery promise left on the storefront", async () => {
    for (const file of ["components/Navbar.tsx", "app/page.tsx", "lib/ai/assistant-prompt.ts"]) {
      const source = await readFile(file, "utf8");
      expect(source, file).not.toMatch(/NPR 2,?000/);
      expect(source, file).not.toContain('en="Free Shipping"');
    }
  });
});

describe("the order total", () => {
  it("is pairs after discount plus delivery, on both checkout paths", async () => {
    const checkout = await readFile("lib/checkout-order.ts", "utf8");
    expect(checkout).toContain("totalPaisa: goodsPaisa + delivery.feePaisa");
    expect(checkout.match(/orderMoney\(/g)?.length).toBe(3);
  });

  it("keeps the delivery charge off the POS tax invoice, where it would print as VAT", async () => {
    const pos = await readFile("lib/order-pos.ts", "utf8");
    expect(pos).toContain("order.totalPaisa / 100 - deliveryFee");
    expect(pos).toContain("collected with the order, not on this bill");
  });

  it("does not need the migration to have run for checkout to work", async () => {
    const settings = await readFile("lib/delivery-settings.ts", "utf8");
    expect(settings).toContain('code === "42703"');
    expect(settings).toContain("return defaultDeliveryPricing");
  });
});
