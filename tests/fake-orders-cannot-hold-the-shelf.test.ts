import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { orderHoldsStock, reservedByProduct, UNCONFIRMED_HOLD_HOURS } from "@/lib/order-stock";

/**
 * A New order held its pairs for ever, and the only checkout limit was keyed on
 * the address plus the browser's own name for itself — change the name and the
 * count started again. One sender could fill the shop with fake cash-on-
 * delivery orders and every real shopper saw "Sold out".
 */

const now = new Date("2026-09-23T12:00:00Z");
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();

describe("how long an unconfirmed order holds pairs", () => {
  it("is two days", () => {
    expect(UNCONFIRMED_HOLD_HOURS).toBe(48);
  });

  it("holds while the order is fresh and releases once it is older", () => {
    expect(orderHoldsStock("New", hoursAgo(47), now)).toBe(true);
    expect(orderHoldsStock("New", hoursAgo(49), now)).toBe(false);
  });

  it("holds a confirmed order until it is closed or cancelled, however old", () => {
    expect(orderHoldsStock("Contacted", hoursAgo(24 * 30), now)).toBe(true);
    expect(orderHoldsStock("Closed", hoursAgo(1), now)).toBe(false);
    expect(orderHoldsStock("Cancelled", hoursAgo(1), now)).toBe(false);
  });

  it("keeps the hold when the date cannot be read — releasing by mistake is worse", () => {
    expect(orderHoldsStock("New", undefined, now)).toBe(true);
    expect(orderHoldsStock("New", "not a date", now)).toBe(true);
  });

  it("is what the storefront counts", () => {
    const item = { productId: "runner", productName: "Runner", size: "40", color: "Black", quantity: 3 };
    const reserved = reservedByProduct(
      [
        { status: "New", createdAt: hoursAgo(2), items: [item] },
        { status: "New", createdAt: hoursAgo(72), items: [item] },
      ],
      now,
    );
    expect(reserved.get("runner")).toBe(3);
  });
});

describe("the checkout limits", () => {
  it("adds a limit by address and one by phone to the per-device one", async () => {
    const actions = await readFile("app/actions.ts", "utf8");
    expect(actions).toContain('bucket: "submission:checkout-ip"');
    expect(actions).toContain('bucket: "submission:checkout-phone"');
    // The address limit is recorded on every attempt; the phone limit only on
    // an order actually placed, so a customer told "size sold out" can retry.
    expect(actions).toContain("checkAndRecordRateLimit({ ...CHECKOUT_IP_LIMIT");
    expect(actions).toContain("checkRateLimit({ ...CHECKOUT_PHONE_LIMIT");
    expect(actions).toContain("if (phoneKey && !placement.replayed)");
  });

  it("only accepts the shop's own payment options", async () => {
    const actions = await readFile("app/actions.ts", "utf8");
    expect(actions).toContain("if (!paymentOptions.includes(payment))");
  });
});

describe("the storefront's count of held pairs", () => {
  it("is added up by the database, with the same hold rule as checkout", async () => {
    const submissions = await readFile("lib/submissions.ts", "utf8");
    const checkout = await readFile("lib/checkout-order.ts", "utf8");
    const rule = "o.status = 'New' AND o.created_at > now() - make_interval(hours => $";
    expect(submissions).toContain("export async function getReservedPairsByProduct()");
    expect(submissions).toContain(rule);
    expect(checkout).toContain(rule);
  });

  it("no longer reads the latest thousand orders to do it", async () => {
    const layout = await readFile("app/layout.tsx", "utf8");
    const pricing = await readFile("lib/order-pricing.ts", "utf8");
    for (const source of [layout, pricing]) {
      expect(source).toContain("getReservedPairsByProduct()");
      expect(source).not.toContain("getOrders()");
    }
  });
});
