import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { shippingOptions, validateDeliveryArea } from "@/lib/commerce";
import { shippingOptionLabel } from "@/lib/commerce-labels";

/**
 * KRISHOE is in Narayangadh, Chitwan. The checkout offered "Kathmandu valley
 * delivery" and, behind it, a rule that read the address for "chitwan",
 * "bharatpur", "hetauda" and the like and refused them as outside the valley —
 * a rule written for a Kathmandu shop, telling customers in the shop's own
 * district they were too far away.
 *
 * Both orders taken so far, from Gaidakot and Tulsipur, had to be booked as
 * nationwide courier because nothing else fitted. The owner sends everything by
 * courier, near or far, so that is the option that stays.
 */
describe("delivery options", () => {
  it("offers courier and pickup, and nothing about a valley", () => {
    expect(shippingOptions).toEqual(["Nationwide courier coordination", "Store pickup"]);
  });

  it("no longer reads the address at all", async () => {
    expect(validateDeliveryArea("Nationwide courier coordination")).toBe("");

    // The address was only ever read to refuse it. Bharatpur, Kawasoti,
    // Gaidakot and Hetauda are all a short ride from the shop and were all on
    // the refusal list.
    const source = await readFile("lib/commerce.ts", "utf8");
    expect(source).not.toContain("outsideValleyPlaces");
    expect(source).not.toContain("is outside Kathmandu Valley");
    expect(validateDeliveryArea.length).toBe(1);
  });

  it("still refuses an option that is not on the list", () => {
    expect(validateDeliveryArea("Free helicopter")).toBe(
      "Please choose a valid delivery option.",
    );
  });

  it("reads as one choice each in Nepali", () => {
    expect(shippingOptionLabel("Nationwide courier coordination", true)).toContain("कुरियर");
    expect(shippingOptionLabel("Store pickup", true)).toBe("पसलमै आएर लिने");
  });
});

describe("store pickup", () => {
  it("shows the hours before the customer sets out", async () => {
    const checkout = await readFile("components/CheckoutClient.tsx", "utf8");

    // A closed shutter after a journey is the kind of thing a customer tells
    // people about.
    // The hours are written once (owner, 2026-10-13: 8 to 6, closed Monday)
    // and checkout, the contact page and Google all read them from there.
    const hours = await readFile("lib/shop-hours.ts", "utf8");
    expect(hours).toContain("बिहान ८ बजे – साँझ ६ बजे");
    expect(hours).toContain("हरेक सोमबार बन्द");
    expect(hours).toContain("Closed every Monday");
    expect(hours).toContain('schema: "Su,Tu-Sa 08:00-18:00"');
    expect(checkout).toContain("shopHours.en");
    expect(checkout).toContain("shopHours.ne");
    expect(await readFile("app/contact/page.tsx", "utf8")).toContain('["Hours", shopHours.en]');
    expect(await readFile("lib/seo.ts", "utf8")).toContain("openingHours: shopHours.schema");
  });
});
