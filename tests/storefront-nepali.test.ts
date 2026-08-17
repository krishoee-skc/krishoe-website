import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The customers are Nepali and the shop was in English.
 *
 * These three surfaces are the ones every shopper meets: the card on every
 * listing, the buttons on it, and the footer under every page. They are Server
 * Components, so the T island does the translating — reading the language from
 * a cookie instead would opt the prerendered category pages into dynamic
 * rendering and cost every shopper the fast HTML they get today.
 */
describe("the product card", () => {
  it("speaks Nepali on the labels a shopper reads first", async () => {
    const card = await readFile("components/ProductCard.tsx", "utf8");

    expect(card).toContain('ne="बिक्री सकियो"');
    expect(card).toContain("जोडी मात्र बाँकी");
    expect(card).toContain('ne="हेर्नुहोस्"');
  });

  it("stays a server component", async () => {
    const card = await readFile("components/ProductCard.tsx", "utf8");
    // The category pages are prerendered; a "use client" here would take that
    // away from every listing in the shop.
    expect(card.trimStart().startsWith('"use client"')).toBe(false);
    expect(card).toContain('import T from "@/components/T"');
  });
});

describe("the add-to-cart button", () => {
  it("translates every state, including the one screen readers hear", async () => {
    const actions = await readFile("components/ProductCardActions.tsx", "utf8");

    expect(actions).toContain('text("Sold out", "सकियो")');
    expect(actions).toContain('text("Added", "थपियो")');
    expect(actions).toContain('text("Add", "थप्ने")');
    // The wishlist control is an icon; its aria-label is the only words it has.
    expect(actions).toContain('text("Add to wishlist", "मनपर्नेमा राख्ने")');
  });
});

describe("the footer", () => {
  it("translates its headings and every link", async () => {
    const footer = await readFile("components/Footer.tsx", "utf8");

    for (const nepali of [
      "छिटो जाने",
      "किसिम",
      "सम्पर्क",
      "गृह पृष्ठ",
      "पसल",
      "हाम्रो कथा",
      "थोक बिक्री",
      "साट्ने नियम",
      "महिला सेन्डिल",
    ]) {
      expect(footer, nepali).toContain(nepali);
    }
  });
});

describe("why choose KRISHOE", () => {
  it("says it the way a Nepali shopper would ask it", async () => {
    const why = await readFile("components/WhyChoose.tsx", "utf8");

    expect(why).toContain('ne="किन KRISHOE?"');
    // Not a word-for-word rendering: "Fast Confirmation" is brochure English,
    // and what a shopper wants to know is that someone will call.
    expect(why).toContain("हामी चाँडै फोन गरेर पक्का गर्छौँ");
    expect(why).toContain("बीचमा कोही छैन");
  });
});
