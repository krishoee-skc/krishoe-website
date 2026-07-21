import { describe, expect, it } from "vitest";
import { toBikramSambatNepali, toBikramSambatRoman } from "@/lib/bikram-sambat";

// Bills carry the Bikram Sambat date beside the English one. The conversion is a
// maintained library, but the wiring is ours — these pin that a real date comes
// back, and a bad one does not throw.
describe("Bikram Sambat on a bill", () => {
  // 2026-07-21 AD is Shrawan 5, 2083 BS.
  it("converts a known date to the right BS day", () => {
    expect(toBikramSambatRoman("2026-07-21T06:00:00.000Z")).toBe("05 Shrawan 2083");
  });

  it("writes it in Devanagari for a Nepali reader", () => {
    const label = toBikramSambatNepali("2026-07-21T06:00:00.000Z");
    expect(label).toContain("श्रावण");
    expect(label).toContain("२०८३");
  });

  it("returns nothing for an unparseable date rather than throwing", () => {
    expect(toBikramSambatNepali("not a date")).toBe("");
    expect(toBikramSambatRoman("")).toBe("");
  });

  it("accepts a Date object as well as a string", () => {
    expect(toBikramSambatRoman(new Date("2026-07-21T06:00:00.000Z"))).toBe("05 Shrawan 2083");
  });
});
