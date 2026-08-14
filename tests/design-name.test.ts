import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { canonicalDesignName, designKey, sameDesign } from "@/lib/design-name";

/**
 * The owner's rule, applied to designs as it already is to worker names:
 * capitals and spacing are spelling, not identity. "bag open" and "Bag Open"
 * are one product, and being made to type the exact capitalisation to hit the
 * right stock row is precisely the friction that produces two rows and splits
 * the pairs between them.
 */
describe("designKey", () => {
  it("treats capitals and spacing as spelling", () => {
    for (const written of ["bag open", "Bag Open", "BAG OPEN", "  bag   open  ", "bAg OpEn"]) {
      expect(designKey(written), written).toBe("bag open");
    }
  });

  it("keeps genuinely different spellings apart", () => {
    // "bagopen" as one word is a different string. Guessing that it means the
    // same thing is how a system silently merges two real products.
    expect(designKey("bagopen")).not.toBe(designKey("bag open"));
    expect(designKey("panja")).not.toBe(designKey("panja moto"));
  });

  it("gives nothing back for an empty name", () => {
    expect(designKey("")).toBe("");
    expect(designKey("   ")).toBe("");
    expect(sameDesign("", "")).toBe(false);
  });
});

describe("sameDesign", () => {
  it("matches across capitals and spacing", () => {
    expect(sameDesign("Bag Open", "bag  open")).toBe(true);
    expect(sameDesign("Doctor Chappal moto", "DOCTOR CHAPPAL MOTO")).toBe(true);
    expect(sameDesign("bag open", "bagopen")).toBe(false);
  });
});

describe("canonicalDesignName", () => {
  it("adopts the spelling already on record", () => {
    expect(canonicalDesignName("Bag Open", ["bag open", "halka fom"])).toBe("bag open");
    expect(canonicalDesignName("  DOCTOR  CHAPPAL  ", ["Doctor Chappal"])).toBe("Doctor Chappal");
  });

  it("keeps what was typed when the design is genuinely new", () => {
    expect(canonicalDesignName("New Sandal", ["bag open"])).toBe("New Sandal");
    expect(canonicalDesignName("  New Sandal  ", [])).toBe("New Sandal");
  });

  it("never invents a name from an empty entry", () => {
    expect(canonicalDesignName("", ["bag open"])).toBe("");
  });
});

/**
 * Both backends have to agree about what counts as one design. If the Postgres
 * lookup were stricter than designKey(), a movement typed as "Bag Open" would
 * open a second stock row that the catalog sync then folds back together — the
 * pairs would appear and disappear depending on which screen was read.
 */
describe("both backends compare the same way", () => {
  it("normalizes case and spacing in the Postgres lookup", async () => {
    const source = await readFile("lib/operations-postgres.ts", "utf8");
    expect(source).toContain("regexp_replace(btrim(design), '\\\\s+', ' ', 'g')");
    expect(source).toContain("designKey(movement.design)");
  });

  it("keys local finished stock through designKey", async () => {
    const source = await readFile("lib/operations.ts", "utf8");
    const body = source.slice(source.indexOf("function stockKey"));
    expect(body.slice(0, body.indexOf("\n}"))).toContain("designKey(value.design)");
  });

  it("files the movement under the stock row's spelling", async () => {
    for (const file of ["lib/operations.ts", "lib/operations-postgres.ts"]) {
      const source = await readFile(file, "utf8");
      expect(source, file).toMatch(/(record|movement)\.design = stock\.design/);
    }
  });
});
