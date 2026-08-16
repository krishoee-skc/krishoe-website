import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Guessing the size is the single biggest reason a pair of shoes comes back,
 * and KRISHOE pays for that twice — the courier out and the courier back.
 *
 * The table is derived from the Paris point rather than copied: EU sizing is
 * 2/3 cm of last length per point, and a last runs about 1.5 cm longer than the
 * foot in it, so foot = size / 1.5 − 1.5. Working from the definition means
 * every row agrees with every other one, and with the sizes on the products.
 */
describe("size guide", () => {
  it("derives foot length from the size rather than hard-coding a table", async () => {
    const source = await readFile("components/SizeGuide.tsx", "utf8");
    expect(source).toContain("euSize / 1.5 - 1.5");
  });

  it("builds the table from the product's own sizes", async () => {
    const source = await readFile("components/SizeGuide.tsx", "utf8");
    // A child's 26 and an adult's 26 are not the same shoe, so a page must show
    // the rows for the pair being looked at, not every size KRISHOE makes.
    expect(source).toContain("numeric.map");
    expect(source).toContain("isKids");
  });

  it("teaches the measurement before showing the numbers", async () => {
    const source = await readFile("components/SizeGuide.tsx", "utf8");
    // A table alone is useless to someone who does not know what to measure.
    expect(source).toContain("भुइँमा कागज राखेर");
    expect(source).toContain("ठूलो लिनुहोस्");
  });

  it("sits beside the size selector", async () => {
    const actions = await readFile("components/ProductDetailActions.tsx", "utf8");
    const selector = actions.indexOf('title={text("Select size"');
    const guide = actions.indexOf("<SizeGuide");
    // A guide linked from the footer is a guide nobody opens.
    expect(selector).toBeGreaterThan(-1);
    expect(guide).toBeGreaterThan(selector);
    expect(guide - selector).toBeLessThan(600);
  });

  it("says nothing when a product has no numeric sizes", async () => {
    const source = await readFile("components/SizeGuide.tsx", "utf8");
    expect(source).toContain("if (numeric.length === 0) return null;");
  });
});
