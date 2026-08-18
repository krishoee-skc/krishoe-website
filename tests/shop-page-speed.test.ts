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

describe("the search box", () => {
  it("reads /shop?query= in the browser", async () => {
    const controls = await readFile("app/shop/ShopCatalogControls.tsx", "utf8");

    // CommandSearch navigates to /shop?query=…; that has to keep working.
    expect(controls).toContain("useSearchParams");
    expect(controls).toContain('searchParams.get("query")');
  });

  it("seeds the box once instead of following the address bar", async () => {
    const controls = await readFile("app/shop/ShopCatalogControls.tsx", "utf8");
    // A lazy useState initialiser, not an effect that re-syncs: a shopper
    // editing the box should not be fighting the URL.
    expect(controls).toContain('useState(() => searchParams.get("query")');
  });

  it("is wrapped in Suspense, which is what keeps the page prerendered", async () => {
    const catalog = await readFile("app/shop/ShopCatalog.tsx", "utf8");

    expect(catalog).toContain("Suspense");
    expect(catalog).toContain("ShopCatalogControls");
  });
});
