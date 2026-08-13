import { describe, expect, it } from "vitest";
import {
  facebookShareUrl,
  viberShareUrl,
  whatsappOrderUrl,
  whatsappShareUrl,
} from "@/lib/commerce";
import { businessContact } from "@/lib/seo";

const PRODUCT_URL = "https://krishoe-website.vercel.app/product/ladies-sandal";
const MESSAGE = `Flatpatta — Rs. 1,200\nKRISHOE\n${PRODUCT_URL}`;

describe("share links", () => {
  // The whole point of the share buttons is to reach a friend. Putting the
  // shop's number in the path would open a chat with the shop instead, quietly
  // turning "send this to a friend" into "message the shop".
  it("sends a shared product to a contact the shopper picks, not to the shop", () => {
    const shared = whatsappShareUrl(MESSAGE);

    expect(shared.startsWith("https://wa.me/?text=")).toBe(true);
    expect(shared).not.toContain(businessContact.whatsappNumber);
  });

  it("still addresses the shop on the ordering link", () => {
    expect(whatsappOrderUrl(MESSAGE)).toContain(`wa.me/${businessContact.whatsappNumber}`);
  });

  it("encodes the message so newlines and spaces survive", () => {
    const shared = whatsappShareUrl(MESSAGE);

    expect(shared).toContain(encodeURIComponent(MESSAGE));
    expect(shared).not.toMatch(/\s/);
    expect(decodeURIComponent(shared.split("text=")[1])).toBe(MESSAGE);
  });

  it("opens Viber's forward picker with the same message", () => {
    const shared = viberShareUrl(MESSAGE);

    expect(shared.startsWith("viber://forward?text=")).toBe(true);
    expect(decodeURIComponent(shared.split("text=")[1])).toBe(MESSAGE);
  });

  // Facebook's sharer reads the destination page's Open Graph tags, so the URL
  // has to arrive intact and encoded — a raw one truncates at the first &.
  it("hands Facebook an encoded product URL", () => {
    const shared = facebookShareUrl(PRODUCT_URL);

    expect(shared).toBe(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(PRODUCT_URL)}`,
    );
    expect(decodeURIComponent(shared.split("u=")[1])).toBe(PRODUCT_URL);
  });

  it("carries an absolute URL, since a shared link leaves the site", () => {
    expect(MESSAGE).toContain("https://");
    expect(facebookShareUrl(PRODUCT_URL)).toContain(encodeURIComponent("https://"));
  });
});
