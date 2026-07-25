import { describe, expect, it } from "vitest";
import { validateDeliveryArea, viberOrderUrl, whatsappOrderUrl } from "@/lib/commerce";

describe("order channel links", () => {
  it("builds a wa.me URL with the message URL-encoded", () => {
    const message = "Order KRS-1001 total Rs. 1,999";
    const url = whatsappOrderUrl(message);
    expect(url.startsWith("https://wa.me/")).toBe(true);
    expect(url).toContain(encodeURIComponent(message));
    // The recipient number must be present in the path (empty number drops the
    // customer into WhatsApp with no contact selected).
    expect(url).toMatch(/wa\.me\/\d/);
  });

  it("builds a viber forward URL with the message URL-encoded", () => {
    const message = "Hello KRISHOE";
    expect(viberOrderUrl(message)).toBe(`viber://forward?text=${encodeURIComponent(message)}`);
  });
});

describe("delivery area validation", () => {
  it("redirects an explicitly outside-valley address to nationwide courier", () => {
    expect(validateDeliveryArea("Kathmandu valley delivery", "Bharatpur, Chitwan")).toMatch(
      /outside Kathmandu Valley/,
    );
  });

  it("allows valley delivery when the address does not identify an outside city", () => {
    expect(validateDeliveryArea("Kathmandu valley delivery", "New Road, Kathmandu")).toBe("");
  });

  it("rejects an invented delivery option", () => {
    expect(validateDeliveryArea("Teleport", "Kathmandu")).toBe(
      "Please choose a valid delivery option.",
    );
  });
});
