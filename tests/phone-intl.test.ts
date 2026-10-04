import { describe, expect, it } from "vitest";
import { isForeignPhone, joinPhone, splitPhone, whatsappNumber } from "@/lib/phone-intl";
import { phoneProblem } from "@/lib/customer-contact-rules";
import { whatsappToUrl } from "@/lib/commerce";

/**
 * Owner, 2026-10-03: WhatsApp to India and every other country, not Nepal
 * alone — one rule, and the country beside the number.
 */
describe("phone numbers from any country", () => {
  it("keeps Nepal as it was", () => {
    expect(whatsappNumber("9841234567")).toBe("9779841234567");
    expect(whatsappNumber("984-123-4567")).toBe("9779841234567");
    expect(whatsappNumber("9779841234567")).toBe("9779841234567");
    expect(whatsappNumber("+977 9841234567")).toBe("9779841234567");
  });

  it("keeps the code that was typed", () => {
    expect(whatsappNumber("+91 98765 43210")).toBe("919876543210");
    expect(whatsappNumber("0091 9876543210")).toBe("919876543210");
    expect(whatsappNumber("+971 50 123 4567")).toBe("971501234567");
    expect(whatsappNumber("919876543210")).toBe("919876543210");
  });

  it("gives no WhatsApp rather than a wrong one", () => {
    expect(whatsappNumber("")).toBe("");
    expect(whatsappNumber("5555555")).toBe("");
    expect(whatsappNumber("014412345")).toBe("");
  });

  it("stores Nepal as ten digits and others with their code", () => {
    expect(joinPhone("977", "9841234567")).toBe("9841234567");
    expect(joinPhone("91", "09876543210")).toBe("+91 9876543210");
    expect(joinPhone("977", "+91 9876543210")).toBe("+91 9876543210");
    expect(joinPhone("91", "")).toBe("");
  });

  it("reads a stored number back into the box", () => {
    expect(splitPhone("9841234567")).toEqual({ code: "977", national: "9841234567" });
    expect(splitPhone("+91 9876543210")).toEqual({ code: "91", national: "9876543210" });
    expect(splitPhone("+1 4155550100")).toEqual({ code: "1", national: "4155550100" });
    const { code, national } = splitPhone("+971 501234567");
    expect(joinPhone(code, national)).toBe("+971 501234567");
  });

  it("does not warn at the counter about a number from abroad", () => {
    expect(isForeignPhone("+91 9876543210")).toBe(true);
    expect(isForeignPhone("9841234567")).toBe(false);
    expect(phoneProblem("+91 9876543210")).toBeNull();
    expect(phoneProblem("5555555")).not.toBeNull();
  });

  it("sends the shop's WhatsApp links through the one rule", () => {
    expect(whatsappToUrl("+91 9876543210", "hi")).toBe("https://wa.me/919876543210?text=hi");
    expect(whatsappToUrl("9841234567", "hi")).toBe("https://wa.me/9779841234567?text=hi");
  });
});

describe("the country box beside the number", () => {
  it("keeps its own width whatever style the number box is given", async () => {
    const { withoutWidth } = await import("@/components/PhoneWithCountry");
    expect(withoutWidth("h-11 w-full rounded-xl md:w-1/2 min-w-0 px-3")).toBe("h-11 rounded-xl px-3");
    expect(withoutWidth("min-h-11 rounded-xl border")).toBe("min-h-11 rounded-xl border");
  });
});
