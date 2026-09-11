import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { productReviewStats } from "@/lib/products";
import type { Review } from "@/lib/products";

/**
 * A star nobody gave.
 *
 * Every shoe in the shop carried ★ 4.8 — a number typed into the catalogue by
 * hand, shown beside the price, while not one review had been published for any
 * of them. The shop had already decided against invented praise: the home page
 * testimonials were rebuilt from real reviews months ago, and ProductCard reads
 * `productReviewStats`. The product page's own badge was missed, so the shoe
 * showed no stars in the grid and 4.8 on its own page.
 *
 * Google saw through it before the owner did. productJsonLd only emits
 * aggregateRating when real reviews exist, so Search Console reported
 * "Review snippets: 0" while the page itself displayed a rating — the schema
 * was honest and the page was not. That mismatch is what confirmed it.
 *
 * With no reviews the badge now says "New" and asks for the first one, which is
 * true, and is also the thing the shop actually wants.
 */
const PAGE = "app/product/[id]/page.tsx";

function review(rating: number, status: string) {
  return {
    id: "r",
    name: "A shopper",
    comment: "Fits well.",
    rating,
    createdAt: "2026-09-11",
    status,
  } as unknown as Review;
}

describe("what the badge is allowed to say", () => {
  it("shows nothing to average when nobody has reviewed", () => {
    expect(productReviewStats([])).toEqual({ count: 0, average: 0 });
  });

  it("ignores a review the shop has not published yet", () => {
    // Pending means nobody has read it. Counting it would put an unchecked
    // stranger's score on the shop's own page.
    expect(productReviewStats([review(5, "pending")]).count).toBe(0);
  });

  it("averages the published ones", () => {
    expect(productReviewStats([review(5, "approved"), review(4, "approved")])).toEqual({
      count: 2,
      average: 4.5,
    });
  });
});

describe("the product page", () => {
  it("no longer prints the hand-typed rating", async () => {
    const page = await readFile(PAGE, "utf8");

    // This was the whole bug: {product.rating} straight from the catalogue.
    expect(page).not.toContain("{product.rating}");
  });

  it("reads the same helper the grid does", async () => {
    const page = await readFile(PAGE, "utf8");

    // A shoe must not show one score on a card and another on its own page.
    expect(page).toContain("productReviewStats(product.reviews)");
    expect(page).toContain("reviewStats.average.toFixed(1)");
  });

  it("says New instead of a number when there are none", async () => {
    const page = await readFile(PAGE, "utf8");

    expect(page).toContain("reviewStats.count > 0 ?");
    expect(page).toContain(`<T en="New" ne="नयाँ" />`);
  });

  it("asks for the first review rather than pretending there are some", async () => {
    const page = await readFile(PAGE, "utf8");

    expect(page).toContain("Be the first to review");
    expect(page).toContain("पहिलो राय तपाईंकै");
  });
});

describe("the page and the schema agree", () => {
  it("both withhold a rating until reviews exist", async () => {
    const seo = await readFile("lib/seo.ts", "utf8");

    // productJsonLd already did this correctly, which is how the mismatch was
    // spotted: Search Console said "Review snippets: 0" while the page showed
    // 4.8. Whatever changes here, the two must move together.
    expect(seo).toContain("aggregateRating");
    const block = seo.slice(seo.indexOf("data.aggregateRating") - 400, seo.indexOf("data.aggregateRating"));
    expect(block).toMatch(/count > 0|length > 0|reviewCount/);
  });
});
