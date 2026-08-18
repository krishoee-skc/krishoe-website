import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trackCommerceEvent, trackContact } from "@/lib/analytics-events";

/**
 * What the shop tells Meta, TikTok and Google when something is bought.
 *
 * The money is the part worth guarding. This codebase stores paisa everywhere —
 * `priceValue: 199900` is Rs 1,999 — while all three ad platforms read `value`
 * as whole currency. Sending the stored number straight through reports every
 * sale as a hundred times its size, and Meta does not merely display that
 * figure: it bids with it. The shop would be shown a 100x return and would
 * spend against it.
 */

type Captured = { event: string; params: Record<string, unknown> };

let gtag: Captured[];
let fbq: Captured[];
let ttq: Captured[];

beforeEach(() => {
  gtag = [];
  fbq = [];
  ttq = [];

  vi.stubGlobal("window", {
    gtag: (_action: string, event: string, params: Record<string, unknown>) =>
      gtag.push({ event, params }),
    fbq: (_action: string, event: string, params: Record<string, unknown>) =>
      fbq.push({ event, params }),
    ttq: {
      track: (event: string, params: Record<string, unknown>) => ttq.push({ event, params }),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the money sent to ad platforms", () => {
  it("reports rupees, not the paisa the cart is stored in", () => {
    trackCommerceEvent("purchase", {
      id: "KRI-1042",
      name: "KRISHOE order",
      pricePaisa: 199900,
      quantity: 1,
    });

    // Rs 1,999 — not 199900, which is what an untranslated paisa value would
    // have claimed, and what would have made the ads look 100x profitable.
    expect(fbq[0].params.value).toBe(1999);
    expect(gtag[0].params.value).toBe(1999);
    expect(ttq[0].params.value).toBe(1999);
    expect(fbq[0].params.currency).toBe("NPR");
  });

  it("multiplies by quantity in rupees", () => {
    trackCommerceEvent("add_to_cart", {
      id: "p1",
      name: "Ladies Sandal",
      pricePaisa: 99900,
      quantity: 3,
    });

    expect(fbq[0].params.value).toBe(2997);
    expect((fbq[0].params.items as { price: number }[])[0].price).toBe(999);
  });

  it("keeps a price that is not a whole rupee exact", () => {
    trackCommerceEvent("purchase", { id: "x", name: "y", pricePaisa: 145050, quantity: 2 });
    expect(fbq[0].params.value).toBe(2901);
  });

  it("treats a missing or nonsense quantity as one item", () => {
    trackCommerceEvent("add_to_cart", { id: "p1", name: "n", pricePaisa: 50000 });
    expect(fbq[0].params.value).toBe(500);

    trackCommerceEvent("add_to_cart", { id: "p1", name: "n", pricePaisa: 50000, quantity: 0 });
    expect(fbq[1].params.value).toBe(500);
  });
});

describe("which event each platform is told", () => {
  it("uses each vendor's own name for the same moment", () => {
    trackCommerceEvent("purchase", { id: "a", name: "b", pricePaisa: 1000 });

    expect(gtag[0].event).toBe("purchase");
    expect(fbq[0].event).toBe("Purchase");
    // TikTok calls this one CompletePayment; sending "Purchase" would be
    // silently dropped rather than rejected.
    expect(ttq[0].event).toBe("CompletePayment");
  });

  it("maps checkout and product views too", () => {
    trackCommerceEvent("begin_checkout");
    expect(fbq[0].event).toBe("InitiateCheckout");
    expect(ttq[0].event).toBe("InitiateCheckout");

    trackCommerceEvent("view_item", { id: "a", name: "b", pricePaisa: 1000 });
    expect(fbq[1].event).toBe("ViewContent");
  });
});

describe("what is never sent", () => {
  /**
   * These trackers belong to advertising companies. An order carries a name, a
   * phone number and a delivery address; none of it has any business leaving
   * the shop, and a purchase event is the easiest place to leak it by accident.
   */
  it("carries no customer details in a purchase", () => {
    trackCommerceEvent("purchase", {
      id: "KRI-1042",
      name: "KRISHOE order",
      pricePaisa: 199900,
    });

    const sent = JSON.stringify([gtag, fbq, ttq]);
    for (const field of ["phone", "email", "address", "customer", "name:", "@"]) {
      expect(sent, field).not.toContain(field);
    }
    expect(Object.keys(fbq[0].params).sort()).toEqual([
      "content_ids",
      "content_name",
      "content_type",
      "contents",
      "currency",
      "items",
      "value",
    ]);
  });

  it("sends only a channel name when a contact button is tapped", () => {
    trackContact("whatsapp");

    expect(fbq[0].event).toBe("Contact");
    // No item — a tap on WhatsApp is not a sale and must not be counted as one.
    expect(fbq[0].params).toEqual({ currency: "NPR" });
    expect(gtag[1].params).toEqual({ content_type: "contact_channel", item_id: "whatsapp" });
  });
});

describe("when no tracker is switched on", () => {
  it("does nothing rather than throwing", () => {
    vi.stubGlobal("window", {});
    expect(() =>
      trackCommerceEvent("purchase", { id: "a", name: "b", pricePaisa: 1000 }),
    ).not.toThrow();
  });
});
