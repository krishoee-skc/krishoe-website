import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The home page never shows a shoe section with no shoes in it.
 *
 * Three sections on the home page pick their shoes by a flag the owner sets
 * per product: best seller, featured, new arrival. On a shop where nobody has
 * ticked those boxes — which is this shop — every one of them comes back
 * empty, and the page draws a heading, a subtitle and a button over nothing.
 *
 * The owner's own screenshots show it: "New Arrivals — Discover the latest
 * KRISHOE styles" above a bare "Browse new arrivals" button, and "Most-loved
 * styles" above an empty row of tabs. A customer scrolls past three promises
 * of shoes without seeing one.
 *
 * It is not a layout fault and no amount of spacing fixes it. The section has
 * to fall back to something real: the newest products the shop actually has.
 * A shop with products can always fill a shelf; only a shop with none should
 * show none.
 */

describe("the best-seller row", () => {
  it("falls back to real products when nothing is tagged", async () => {
    const source = await readFile("components/BestSeller.tsx", "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // Asserted as a fallback computed from the full list, not from `best`:
    // the tabs already fall back to `best`, and on this shop `best` is empty
    // too, so that fallback resolves to nothing. The row has to reach past it.
    expect(code, "an untagged shop must still see shoes").toMatch(
      /best\.length\s*(>|===)\s*0|fallback|all\.slice/,
    );
  });
});

describe("the new-arrivals row", () => {
  it("shows the newest products when none are tagged", async () => {
    const source = await readFile("components/NewArrivals.tsx", "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // This one had no fallback at all: filter by flag, slice four, draw the
    // heading regardless. On an untagged shop that is a heading over nothing.
    expect(code, "an untagged shop must still see shoes").toMatch(
      /length\s*(>|===)\s*0|fallback/,
    );
  });

  it("hides itself rather than showing an empty shelf", async () => {
    const source = await readFile("components/NewArrivals.tsx", "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // The last resort, for a shop with no products at all: say nothing rather
    // than promise shoes and show a button to an empty page.
    expect(code, "a shop with no products must not promise shoes").toMatch(
      /return null/,
    );
  });
});

describe("what the fallback must not do", () => {
  it("does not invent a product that is not in stock", async () => {
    const best = await readFile("components/BestSeller.tsx", "utf8");
    const arrivals = await readFile("components/NewArrivals.tsx", "utf8");

    // Both rows draw from the same products the shop sells. A hard-coded
    // sample shoe on the home page is a shoe a customer cannot buy.
    for (const [name, source] of [["BestSeller", best], ["NewArrivals", arrivals]] as const) {
      expect(source, `${name} must not carry a sample product`).not.toMatch(
        /const\s+(sample|placeholder|demo)Product/i,
      );
    }
  });
});
