import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * /shop must stay prerendered.
 *
 * It is the page the "पसल" link goes to and where customers actually choose a
 * pair, and it was the slowest page on the site — over two seconds, against
 * well under one for the category pages beside it. The cause was reading
 * `searchParams` on the server to seed the search box, which opts the route
 * into being rebuilt for every visitor.
 *
 * The search term is read in the browser now. These tests guard the shape that
 * keeps the page prerendered, because the regression is invisible in review:
 * adding a `searchParams` prop back looks harmless and costs every shopper a
 * second and a half on a Nepali connection.
 */
/**
 * Source with comments removed.
 *
 * These checks are about what the code does, and the comments here deliberately
 * name the thing that was taken out. Matching prose would fail the moment
 * someone explains a fix well.
 */
function code(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("the shop page", () => {
  it("does not read searchParams on the server", async () => {
    const page = code(await readFile("app/shop/page.tsx", "utf8"));

    expect(page).not.toContain("searchParams");
    expect(page).not.toContain("force-dynamic");
  });

  it("still lists the whole catalogue for Google", async () => {
    const page = await readFile("app/shop/page.tsx", "utf8");
    // The structured data is what puts the products in search results; it has
    // to be in the prerendered HTML, not fetched afterwards.
    expect(page).toContain("collectionPageJsonLd");
    expect(page).toContain("getProducts");
  });
});

/**
 * The three tests that used to live here held the wrong half of the fix.
 *
 * They required useSearchParams inside a Suspense boundary, because that is
 * what stopped /shop being rebuilt for every visitor — and it did, taking TTFB
 * from over two seconds to under one. What nobody measured was what it did to
 * the other end: a Suspense boundary around a component that cannot prerender
 * bakes the FALLBACK into the page, so /shop shipped as an empty 60vh box with
 * no product and no photograph in it. The server got fast and the shopper got
 * slower — one LCP reading came in at 5.5 seconds.
 *
 * The goal was always "the page stays prerendered". That goal is unchanged and
 * still guarded above. The mechanism moved: the URL is read after mounting
 * instead of during render, which costs no prerendering and empties nothing.
 * The shape is held in tests/pages-ship-their-content.test.ts.
 */
describe("the search box", () => {
  it("still reads a search arriving at /shop?query=", async () => {
    const controls = await readFile("app/shop/ShopCatalogControls.tsx", "utf8");

    // CommandSearch navigates to /shop?query=…; that has to keep working
    // whichever way the URL is read.
    expect(controls).toContain("window.location.search");
    expect(controls).toContain('get("query")');
  });

  it("seeds the box once instead of following the address bar", async () => {
    const controls = await readFile("app/shop/ShopCatalogControls.tsx", "utf8");

    // An empty dependency array: read on arrival, never re-synced. A shopper
    // editing the box should not be fighting the URL.
    const effect = controls.slice(controls.indexOf("useIsomorphicLayoutEffect(() => {"));
    expect(effect.slice(0, 300)).toContain("}, []);");
  });
});

/**
 * /wholesale must stay prerendered too.
 *
 * It carried `force-dynamic` from the commit that created it — not added to fix
 * anything, just the shape the page was born in — and it was the only shopper
 * page the edge cache never held: MISS at nine hundred milliseconds against
 * three hundred for /shop beside it, reading the same catalogue with the same
 * function and needing nothing about the visitor.
 *
 * It is also the page that matters most per visit. A retail customer buys one
 * pair; a shopkeeper reading this one buys fifty.
 */
describe("the wholesale page", () => {
  it("is not forced to rebuild for every visitor", async () => {
    const page = code(await readFile("app/wholesale/page.tsx", "utf8"));

    expect(page).not.toContain("force-dynamic");
    expect(page).not.toContain("searchParams");
  });

  it("still reads the trade rates it exists to show", async () => {
    const page = await readFile("app/wholesale/page.tsx", "utf8");

    expect(page).toContain("getProducts");
    expect(page).toContain("wholesalePriceValue");
  });
});
