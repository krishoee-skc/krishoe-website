import { describe, expect, it } from "vitest";
import {
  bikramMonthLabel,
  bikramMonthStartAdKey,
  bikramYearMonth,
  isBikramMonthStart,
  toBikramSambatNepali,
  toBikramSambatRoman,
} from "@/lib/bikram-sambat";

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

// The monthly digest turns over on the Bikram Sambat month, so it needs the
// A.D. day each BS month begins and a way to know it is gate 1. These pin known
// 2083 boundaries; the day key is read from local fields, so it is the Nepali
// calendar day whether the test runs in UTC or in Nepal time.
describe("Bikram Sambat month boundaries", () => {
  it("gives the A.D. day a BS month begins", () => {
    // Shrawan 2083 begins 2026-07-17; Asar begins 2026-06-15.
    expect(bikramMonthStartAdKey(2083, 3)).toBe("2026-07-17");
    expect(bikramMonthStartAdKey(2083, 2)).toBe("2026-06-15");
  });

  it("carries an out-of-range month index into the neighbouring year", () => {
    // One before Baisakh 2083 is Chaitra 2082 (2026-03-15).
    expect(bikramMonthStartAdKey(2083, -1)).toBe("2026-03-15");
    // Twelve past Baisakh 2083 is Baisakh 2084.
    expect(bikramMonthStartAdKey(2083, 12)).toBe(bikramMonthStartAdKey(2084, 0));
  });

  it("knows gate 1 of a BS month from any other day", () => {
    // 2026-07-17 is Shrawan 1; 2026-07-21 is Shrawan 5.
    expect(isBikramMonthStart("2026-07-17T06:00:00.000Z")).toBe(true);
    expect(isBikramMonthStart("2026-07-21T06:00:00.000Z")).toBe(false);
    expect(isBikramMonthStart("not a date")).toBe(false);
  });

  it("reads the BS year and month index, and names the month", () => {
    expect(bikramYearMonth("2026-07-21T06:00:00.000Z")).toEqual({ year: 2083, monthIndex: 3 });
    expect(bikramYearMonth("not a date")).toBeNull();
    expect(bikramMonthLabel("2026-07-21T06:00:00.000Z")).toContain("श्रावण");
    expect(bikramMonthLabel("2026-07-21T06:00:00.000Z", "en")).toBe("Shrawan 2083");
  });
});
