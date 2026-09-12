import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { approvedReviews } from "@/components/Testimonials";
import type { Product, Review } from "@/lib/products";

/**
 * The storefront used to show three invented reviews under invented names,
 * each rated 5/5, while the shop had no reviews at all.
 *
 * These tests hold the section to real ones. The names in the second test are
 * the exact fabrications that shipped, named here so restoring them fails
 * loudly rather than passing review as "placeholder content".
 */

const review = (overrides: Partial<Review> = {}): Review => ({
  id: "r1",
  name: "Anita",
  rating: 5,
  comment: "चप्पल आरामदायी छ।",
  createdAt: "2026-08-01T00:00:00.000Z",
  status: "approved",
  ...overrides,
});

const product = (reviews: Review[]) => ({ reviews }) as unknown as Product;

describe("which reviews reach the storefront", () => {
  it("finds none when the shop has none", () => {
    expect(approvedReviews([])).toEqual([]);
    expect(approvedReviews([product([])])).toEqual([]);
  });

  it("never invents a customer", async () => {
    const source = await readFile("components/Testimonials.tsx", "utf8");
    for (const invented of ["Priya Sharma", "Sita Karki", "Anisha Rai"]) {
      expect(source, invented).not.toContain(invented);
    }
  });

  it("asks for the first review rather than showing an empty row of quotes", async () => {
    const source = await readFile("components/Testimonials.tsx", "utf8");
    const empty = source.slice(
      source.indexOf("if (reviews.length === 0)"),
      source.indexOf("return (\n    <section className=\"bg-brand-paper py-14 md:py-20\">\n      <div className=\"mx-auto max-w-7xl"),
    );

    expect(empty.length, "the empty-state branch is missing").toBeGreaterThan(0);

    // It used to return null. That was right about the quotes and wrong about
    // the door: on the day the shop has no reviews — the day it most needs one
    // — the home page offered no way to leave one, and customers told the owner
    // they could not find where. So the section stays and asks.
    expect(empty).toContain("Be the first to write one");
    expect(empty).toContain(`href="/review"`);

    // What must never come back: praise nobody said, to fill the space.
    expect(empty).not.toContain("★★★★★");
    expect(empty).not.toContain("review.comment");
  });

  it("passes a real review through", () => {
    const shown = approvedReviews([
      product([review({ comment: "साइज ठीक आयो।", name: "Bina" })]),
    ]);

    expect(shown).toHaveLength(1);
    expect(shown[0].name).toBe("Bina");
  });

  it("withholds anything not yet approved", () => {
    // The moderation queue exists so nothing reaches the storefront unread.
    // Showing `pending` would make the queue decorative.
    expect(
      approvedReviews([
        product([review({ id: "p", status: "pending" })]),
        product([review({ id: "r", status: "rejected" })]),
      ]),
    ).toEqual([]);
  });

  it("puts a verified buyer ahead of an unverified one", () => {
    const shown = approvedReviews([
      product([
        review({ id: "a", comment: "unverified", createdAt: "2026-08-10T00:00:00.000Z" }),
        review({
          id: "b",
          comment: "verified",
          verifiedPurchase: true,
          createdAt: "2026-08-01T00:00:00.000Z",
        }),
      ]),
    ]);

    expect(shown.map((entry) => entry.id)).toEqual(["b", "a"]);
  });

  it("shows at most three, newest first", () => {
    const many = Array.from({ length: 6 }, (_, index) =>
      review({
        id: `r${index}`,
        createdAt: `2026-08-0${index + 1}T00:00:00.000Z`,
      }),
    );
    const shown = approvedReviews([product(many)]);

    expect(shown.map((entry) => entry.id)).toEqual(["r5", "r4", "r3"]);
  });

  it("skips a rating left without any words", () => {
    expect(approvedReviews([product([review({ comment: "   " })])])).toEqual([]);
  });

  it("gathers reviews from across the whole catalogue", () => {
    const shown = approvedReviews([
      product([review({ id: "a", createdAt: "2026-08-01T00:00:00.000Z" })]),
      product([review({ id: "b", createdAt: "2026-08-02T00:00:00.000Z" })]),
    ]);

    expect(shown.map((entry) => entry.id)).toEqual(["b", "a"]);
  });
});
