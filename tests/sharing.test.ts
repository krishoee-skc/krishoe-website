import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { shareableProductUrl } from "@/lib/analytics-events";

/**
 * Passing a pair, or the shop, on to someone else.
 *
 * Sharing already worked — the phone's own share sheet, with WhatsApp, Viber
 * and Facebook as fallbacks. What it could not do was be shown to work: the
 * shared link was the plain product URL, so a friend who followed it arrived
 * indistinguishable from anyone else, and the owner had no way to answer "did
 * that bring us customers?" except by feeling.
 */

describe("the link that gets shared", () => {
  it("carries what Analytics needs to attribute the visit", () => {
    const shared = new URL(
      shareableProductUrl("https://krishoe-website.vercel.app/product/abc", "whatsapp"),
    );

    expect(shared.searchParams.get("utm_source")).toBe("krishoe-share");
    expect(shared.searchParams.get("utm_medium")).toBe("whatsapp");
    expect(shared.searchParams.get("utm_campaign")).toBe("product-share");
  });

  it("still points at the same page", () => {
    const shared = new URL(
      shareableProductUrl("https://krishoe-website.vercel.app/product/abc", "native"),
    );

    expect(shared.origin).toBe("https://krishoe-website.vercel.app");
    expect(shared.pathname).toBe("/product/abc");
  });

  it("tells the channels apart", () => {
    const medium = (channel: Parameters<typeof shareableProductUrl>[1]) =>
      new URL(shareableProductUrl("https://x.test/p", channel)).searchParams.get("utm_medium");

    // Which app a share came back through is the difference between "post more
    // on Facebook" and "ask customers to forward on WhatsApp".
    expect(new Set([medium("whatsapp"), medium("viber"), medium("facebook"), medium("copy")]).size)
      .toBe(4);
  });

  it("does not multiply parameters when a URL already has some", () => {
    const once = shareableProductUrl("https://x.test/p?utm_medium=old", "viber");
    expect(new URL(once).searchParams.getAll("utm_medium")).toEqual(["viber"]);
  });
});

describe("what the product share sends", () => {
  it("tags every channel, including the phone's own share sheet", async () => {
    const source = await readFile("components/ShareProduct.tsx", "utf8");

    for (const channel of ["native", "whatsapp", "viber", "facebook", "copy"]) {
      expect(source, channel).toContain(`trackShare("${channel}")`);
    }
    expect(source).toContain("shareableProductUrl");
  });

  it("puts the price in the message", async () => {
    const source = await readFile("components/ShareProduct.tsx", "utf8");
    // A forwarded link with no price makes the friend ask, and the ask is where
    // most of them stop.
    expect(source).toContain("${name} — ${price}");
  });
});

describe("asking a buyer to tell a friend", () => {
  it("appears on the order page and nowhere else", async () => {
    const order = await readFile("app/order/[id]/page.tsx", "utf8");
    const product = await readFile("app/product/[id]/page.tsx", "utf8");

    // Someone looking at their own order has already decided the shop is worth
    // trusting; a shopper who has not ordered yet has not.
    expect(order).toContain("<ShareShop");
    expect(product).not.toContain("ShareShop");
  });

  it("shares the shop rather than one pair", async () => {
    const order = await readFile("app/order/[id]/page.tsx", "utf8");
    const share = await readFile("components/ShareShop.tsx", "utf8");

    expect(order).toContain('absoluteUrl("/shop")');
    // What a friend needs is the shop, and the shop is what the buyer has just
    // formed an opinion about.
    expect(share).toContain("नेपालमै बनेको जुत्ता");
  });

  it("does not leak the order into the message", async () => {
    const share = await readFile("components/ShareShop.tsx", "utf8");

    // The share text goes to whoever the buyer picks. An order reference in it
    // would hand a stranger a lookup for someone else's delivery address.
    for (const leak of ["order.id", "orderId", "reference", "phone", "address"]) {
      expect(share, leak).not.toContain(leak);
    }
  });
});
