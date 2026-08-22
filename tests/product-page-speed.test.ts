import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const PAGE = "app/product/[id]/page.tsx";
const PANEL = "components/ProductReviewsPanel.tsx";
const API = "app/api/products/review-access/route.ts";

/** Source with comments removed — the fix's own comment names what it took out. */
function code(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(?:\/\/|\{\/\*).*$/gm, "");
}

/**
 * The page a Facebook ad lands on, a shared link lands on, and a Google result
 * lands on — where a shopper meets KRISHOE. It took 2.3 seconds and never
 * cached, against 0.45 for /shop beside it.
 *
 * The cause was not the missing generateStaticParams. It was that working out
 * whether the reader may write a review meant reading a cookie, and one
 * request-time read anywhere in the tree makes the whole route dynamic. Adding
 * the params alone would have changed nothing.
 */
describe("the product page", () => {
  it("builds a page per product", async () => {
    const page = await readFile(PAGE, "utf8");

    expect(page).toContain("export async function generateStaticParams");
    expect(page).toContain("products.map((product) => ({ id: product.id }))");
  });

  it("reads nothing about who is asking", async () => {
    const page = code(await readFile(PAGE, "utf8"));

    // Any one of these would take the prerendering back.
    expect(page).not.toContain("getCurrentCustomer");
    expect(page).not.toContain("getOrdersForCustomer");
    expect(page).not.toContain("cookies(");
  });

  it("calls the navbar the way every prerendered page does", async () => {
    const page = await readFile(PAGE, "utf8");

    // isLoggedIn only swaps "Sign in" for "My Account"; /shop, /wholesale and
    // /about have always shown the signed-out one. This page was the odd one
    // out and was paying for the difference with its prerendering.
    expect(page).toContain("<Navbar />");
    expect(page).not.toContain("<Navbar isLoggedIn");
  });

  it("keeps serving a shoe added after the last build", async () => {
    const page = await readFile(PAGE, "utf8");

    // dynamicParams defaults to true; turning it off would 404 every new
    // product until the next deploy.
    expect(code(page)).not.toContain("dynamicParams = false");
  });
});

/**
 * A prerendered page for a deleted product is exactly what put 404s in front of
 * shoppers after the trial data was cleared. The catalogue's ten-second
 * revalidate is what stops that happening again, so it has to stay.
 */
describe("a product that goes away", () => {
  it("still says so, rather than serving a page that no longer exists", async () => {
    const page = await readFile(PAGE, "utf8");

    expect(page).toContain("notFound()");
  });
});

describe("who may write a review", () => {
  it("is asked from the browser, not while building the page", async () => {
    const panel = await readFile(PANEL, "utf8");

    expect(panel).toContain('"use client"');
    expect(panel).toContain("/api/products/review-access?productId=");
  });

  it("shows signed out until it knows otherwise", async () => {
    const panel = await readFile(PANEL, "utf8");

    // The answer that offers nothing: the worst case is a buyer waiting a
    // moment for a button, not a stranger being handed one.
    expect(panel).toContain("const SIGNED_OUT");
    expect(panel).toContain("useState<ReviewAccessAnswer>(SIGNED_OUT)");
  });

  it("will not be talked into a review form by a stray response", async () => {
    const panel = await readFile(PANEL, "utf8");

    expect(panel).toContain('typeof answer?.isLoggedIn === "boolean"');
  });

  it("counts only a purchase that arrived", async () => {
    const api = await readFile(API, "utf8");

    // A review is worth something because the pair arrived; an order still in
    // transit has not proved that.
    expect(api).toContain('order.status === "Closed"');
    expect(api).toContain("alreadyReviewed");
  });

  it("answers signed out rather than failing the page", async () => {
    const api = await readFile(API, "utf8");

    // A shopper reading a product page must not see it break because the
    // review panel could not work out who they are.
    const fallback = api.slice(api.indexOf("} catch (error) {"));
    expect(fallback).toContain("SIGNED_OUT");
    expect(fallback).toContain("reportError");
  });
});
