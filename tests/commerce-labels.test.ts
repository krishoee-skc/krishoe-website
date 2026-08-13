import { describe, expect, it } from "vitest";
import { paymentOptions, shippingOptions } from "@/lib/commerce";
import { paymentOptionLabel, shippingOptionLabel } from "@/lib/commerce-labels";

describe("checkout option labels", () => {
  it("translates every delivery option that the form offers", () => {
    const untranslated = shippingOptions.filter(
      (option) => shippingOptionLabel(option, true) === option,
    );

    expect(untranslated).toEqual([]);
  });

  it("translates every payment option that the form offers", () => {
    const untranslated = paymentOptions.filter(
      (option) => paymentOptionLabel(option, true) === option,
    );

    expect(untranslated).toEqual([]);
  });

  it("leaves the English label untouched", () => {
    for (const option of [...shippingOptions, ...paymentOptions]) {
      expect(shippingOptionLabel(option, false)).toBe(option);
      expect(paymentOptionLabel(option, false)).toBe(option);
    }
  });

  // The submitted value must stay English: the server checks it with
  // shippingOptions.includes(delivery) and branches on the exact string
  // "Kathmandu valley delivery" to decide the delivery-area rule.
  it("falls back to the English text for an unknown option rather than blanking it", () => {
    expect(shippingOptionLabel("Some new option", true)).toBe("Some new option");
    expect(paymentOptionLabel("Some new option", true)).toBe("Some new option");
  });
});
