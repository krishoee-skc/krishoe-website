"use client";

import { useEffect, useState } from "react";
import ProductReviews, { type PublishedReview } from "@/components/ProductReviews";
import type { Product } from "@/lib/products";
import type { ReviewAccessAnswer } from "@/app/api/products/review-access/route";

/**
 * The review panel, with the "may I write one" question asked from the browser.
 *
 * Asking it on the server cost /product/[id] its prerendering: working out who
 * is reading means reading a cookie, and one request-time read anywhere in the
 * tree makes the whole route dynamic. The page was rebuilt for every visitor
 * and never cached — 2.3 seconds against 0.45 for /shop — on the page a
 * Facebook ad, a shared link and a Google result all land on.
 *
 * Signed out is what it shows until the answer arrives, because that is what
 * almost every visitor is, and because it is the answer that offers nothing:
 * the worst case is a buyer waiting a moment for a button, not a stranger being
 * handed one.
 */
const SIGNED_OUT: ReviewAccessAnswer = {
  canReview: false,
  isLoggedIn: false,
  reason: {
    en: "Sign in to review a product you purchased.",
    ne: "किन्नुभएको सामानको समीक्षा लेख्न साइन इन गर्नुहोस्।",
  },
};

export default function ProductReviewsPanel({
  product,
  reviews,
}: {
  product: Product;
  reviews: PublishedReview[];
}) {
  const [access, setAccess] = useState<ReviewAccessAnswer>(SIGNED_OUT);

  useEffect(() => {
    let alive = true;

    const id = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/products/review-access?productId=${encodeURIComponent(product.id)}`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const answer = (await response.json()) as ReviewAccessAnswer;
        // Ignore anything without the shape, so a stray error body cannot
        // switch the panel into offering a review form.
        if (alive && typeof answer?.isLoggedIn === "boolean") setAccess(answer);
      } catch {
        // Signed out already stands. The reviews themselves are on the page.
      }
    }, 0);

    return () => {
      alive = false;
      window.clearTimeout(id);
    };
  }, [product.id]);

  return <ProductReviews product={product} reviews={reviews} reviewAccess={access} />;
}
