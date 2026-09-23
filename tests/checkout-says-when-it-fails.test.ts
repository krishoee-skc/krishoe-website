import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Two things the checkout screen got wrong about the customer's own order.
 *
 * When the request never came back, the button stopped spinning and nothing
 * was said. And with a discount code, the WhatsApp message and the sale sent to
 * analytics both carried the price of the pairs before the discount — so the
 * customer quoted the shop the wrong figure and the shop's reports counted
 * money it never took.
 */

describe("the checkout screen", () => {
  it("tells the customer when the order could not be sent", async () => {
    const client = await readFile("components/CheckoutClient.tsx", "utf8");
    expect(client).toMatch(/await submitCheckout\(state, formData\);[\s\S]*\} catch \{[\s\S]*We could not reach KRISHOE/);
  });

  it("quotes the discounted total, with delivery, not the pairs alone", async () => {
    const client = await readFile("components/CheckoutClient.tsx", "utf8");
    expect(client).not.toContain("My total is ${subtotalLabel}");
    expect(client).toContain("const goodsPaisa = Math.max(0, subtotal - discountPaisa);");
    expect(client).toContain("My total is ${totalForMessage}");
  });

  it("reports the order's real total to analytics", async () => {
    const client = await readFile("components/CheckoutClient.tsx", "utf8");
    expect(client).toContain("pricePaisa: result.totalPaisa ?? estimatedTotalPaisa");
    expect(client).not.toContain("pricePaisa: subtotal,");
  });

  it("gets that total back from the server", async () => {
    const actions = await readFile("app/actions.ts", "utf8");
    expect(actions.match(/record\.totalPaisa,/g)).toHaveLength(2);
  });
});
