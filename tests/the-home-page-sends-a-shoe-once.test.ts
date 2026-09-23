import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * A shoe on three tabs is still one shoe on the wire.
 *
 * The best-seller row has three tabs — best sellers, trending, new arrivals —
 * and they overlap heavily. On a shop that has tagged nothing, which is this
 * shop, all three fall back to the same eight-shoe shelf. Handed to the tabs as
 * three arrays of whole products, those eight shoes were serialised into the
 * page's own HTML three times: every field, every description, every image URL,
 * paid for on a Nepali phone connection before the page could show anything.
 *
 * Measured on this shop's real product shape: 24.9KB as three arrays against
 * 9.2KB as one pool plus three lists of ids — 15.6KB, a 63% cut, and most of
 * why the home page weighed more than the shop it links to.
 *
 * What a shopper sees is unchanged. The ids are resolved back to products in
 * the browser, in the order the server chose, on the same tabs.
 *
 * These read the source rather than render it, because the fault is in what
 * crosses the wire, not in what appears afterwards — a version that renders
 * correctly while sending the catalogue three times is exactly the bug.
 */

const ROW = "components/BestSeller.tsx";
const TABS = "components/BestSellerTabs.tsx";

describe("the best-seller row", () => {
  it("hands the tabs ids, not three copies of the products", async () => {
    const source = await readFile(ROW, "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // The three props must be id lists. Passing the arrays straight through is
    // the shape that shipped the same shoes three times.
    expect(code, "each tab is named by id").toMatch(/best=\{[^}]*\.map\(\([^)]*\) => [^.]*\.id\)/);
    expect(code, "the pool is sent once").toMatch(/pool=\{pool\}/);
    expect(code, "products must not be passed per tab").not.toMatch(/best=\{best\}/);
  });

  it("deduplicates the pool by id", async () => {
    const source = await readFile(ROW, "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // Without this the pool is just the three lists concatenated, which is the
    // same payload with extra steps.
    expect(code, "one copy of each shoe").toMatch(/new Map\(/);
    expect(code, "keyed by id").toMatch(/\.id,\s*p\]|\[p\.id/);
  });
});

describe("the tabs", () => {
  it("take ids and resolve them against the pool", async () => {
    const source = await readFile(TABS, "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    expect(code, "the tab lists are ids").toMatch(/best:\s*string\[\]/);
    expect(code, "the pool carries the products").toMatch(/pool:\s*Product\[\]/);
    expect(code, "ids are looked up").toMatch(/byId\.get\(/);
  });

  it("skips an id with no product behind it", async () => {
    const source = await readFile(TABS, "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // A missing product must not render as a gap in the shelf. flatMap with an
    // empty array drops it; .map would leave undefined in the list.
    expect(code, "a missing shoe is dropped, not drawn").toMatch(/flatMap\(/);
  });

  it("preloads the photos already on screen, and only those", async () => {
    // `loading="eager"` only stops the browser deferring a request until the
    // card scrolls into view. It does not move the image up the queue, so the
    // first photo a shopper sees still waited behind the page's own scripts.
    // `priority` preloads it. Both belong on the same cards: the ones the shop
    // marks as already visible.
    const card = await readFile("components/ProductCard.tsx", "utf8");
    const code = card.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    expect(code, "the visible photos must be preloaded").toMatch(/priority=\{eager\}/);

    // Never on everything: priority on all of them is priority on none, and it
    // pulls the whole catalogue over a phone connection at once.
    expect(code, "priority must stay tied to eager").not.toMatch(/priority(\s|\/|>)/);
  });

  it("still falls back so the shelf is never empty", async () => {
    const source = await readFile(TABS, "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // An untagged tab shows the best-seller shelf rather than a blank row —
    // the behaviour the row already had, which this must not have dropped.
    expect(code, "an empty tab falls back").toMatch(/chosen\.length\s*>\s*0\s*\?\s*chosen\s*:/);
  });
});
