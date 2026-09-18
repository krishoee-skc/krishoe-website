import { describe, expect, it } from "vitest";
import { colourKey, sameColour, canonicalColourName } from "@/lib/colour-name";

/**
 * One colour, however it was typed.
 *
 * The factory's own records hold "black" and "Black" as separate colours today,
 * written by two people on two days for the same shoe. A person reads them as
 * one. The app read them as two, which means sixty uppers in "Black" and sixty
 * bottoms in "black" cannot be matched to each other and the finished pairs
 * cannot be posted to stock automatically.
 *
 * This is the second of the two keys that make that matching possible — the
 * first is the size run. It follows lib/design-name.ts exactly, because the
 * same problem was already solved there for shoe names and a second style of
 * answer would be one more thing to keep in step.
 *
 * Deliberately not clever: case and spacing only. "cherry" and "cherry red" are
 * different colours and stay different, because guessing that two genuinely
 * different words mean the same thing is how a system silently merges two real
 * products.
 */

describe("the same colour written two ways", () => {
  it("reads Black and black as one colour", () => {
    expect(colourKey("Black")).toBe(colourKey("black"));
    expect(sameColour("Black", "black")).toBe(true);
    expect(sameColour("BLACK", "black")).toBe(true);
  });

  it("ignores stray spacing", () => {
    expect(sameColour("  black  ", "black")).toBe(true);
    // Two words with an accidental double space is still one colour.
    expect(sameColour("cherry  red", "cherry red")).toBe(true);
  });
});

describe("colours that are genuinely different stay different", () => {
  it("keeps cherry apart from cherry red", () => {
    expect(sameColour("cherry", "cherry red")).toBe(false);
  });

  it("keeps crim apart from cream", () => {
    // Both are in the records. They are not the same colour, and no amount of
    // looking alike should merge them.
    expect(sameColour("crim", "cream")).toBe(false);
  });

  it("treats blank as its own thing, not as everything", () => {
    expect(sameColour("", "black")).toBe(false);
    expect(sameColour("", "")).toBe(false);
    expect(colourKey("")).toBe("");
  });
});

describe("the spelling that gets stored", () => {
  it("adopts the spelling already on record", () => {
    // So a later "Black" is filed under the "black" the shop already uses, and
    // one spelling appears everywhere instead of two that read the same.
    expect(canonicalColourName("Black", ["black", "cherry"])).toBe("black");
    expect(canonicalColourName("CHERRY", ["black", "cherry"])).toBe("cherry");
  });

  it("keeps what was typed when nothing matches", () => {
    expect(canonicalColourName("Maroon", ["black", "cherry"])).toBe("Maroon");
  });

  it("trims what it keeps", () => {
    expect(canonicalColourName("  Maroon  ", [])).toBe("Maroon");
  });
});
