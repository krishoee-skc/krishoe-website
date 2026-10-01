import type { Product, Review } from "@/lib/products";
import { productPath } from "@/lib/product-url";

/**
 * The reviews the storefront shows together — on the home page and on
 * /reviews (owner, 2026-10-01): every published review of a shoe in the shop,
 * and the published reviews about the shop itself, which belong to no shoe and
 * used to be shown nowhere.
 *
 * Only what the Owner published reaches here: a product's reviews are already
 * the published ones (lib/product-store hydrates them from customer_voice),
 * and the shop's are read with `published = true`. Nothing is invented.
 */

export type WallShoe = { id: string; name: string; href: string; image: string; price: string };

export type WallReview = {
  id: string;
  name: string;
  comment: string;
  rating: number;
  createdAt: string;
  verified: boolean;
  /** The shoe it is about, or null for a review of the shop. */
  shoe: WallShoe | null;
};

export type ShopReview = { id: string; name: string; comment: string; rating: number; createdAt: string; verified: boolean };

/** Every review on the wall, a verified buyer's first, then newest. */
export function wallReviews(products: Product[], shopReviews: ShopReview[]): WallReview[] {
  const fromShoes = products.flatMap((product) =>
    (product.reviews ?? [])
      .filter((review: Review) => review.status === "approved" && review.comment.trim().length > 0)
      .map(
        (review: Review): WallReview => ({
          id: review.id,
          name: review.name,
          comment: review.comment,
          rating: review.rating,
          createdAt: review.createdAt,
          verified: Boolean(review.verifiedPurchase),
          shoe: {
            id: product.id,
            name: product.name,
            href: productPath(product),
            image: product.image || product.gallery?.[0] || "",
            price: product.price,
          },
        }),
      ),
  );
  const fromShop = shopReviews
    .filter((review) => review.comment.trim().length > 0)
    .map((review): WallReview => ({ ...review, shoe: null }));
  return [...fromShoes, ...fromShop].sort((first, second) => {
    if (first.verified !== second.verified) return first.verified ? -1 : 1;
    return second.createdAt.localeCompare(first.createdAt);
  });
}

export type WallSummary = { count: number; average: number; distribution: Array<{ star: number; count: number }> };

/** The real average and the spread of stars, from the same reviews shown. Null when there are none. */
export function wallSummary(reviews: WallReview[]): WallSummary | null {
  const rated = reviews.filter((review) => review.rating > 0);
  if (rated.length === 0) return null;
  const average = rated.reduce((sum, review) => sum + review.rating, 0) / rated.length;
  return {
    count: rated.length,
    average,
    distribution: [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: rated.filter((review) => Math.round(review.rating) === star).length,
    })),
  };
}

/** The shoes that have reviews, with how many — the /reviews filter chips. */
export function wallShoes(reviews: WallReview[]) {
  const counts = new Map<string, { shoe: WallShoe; count: number }>();
  let shop = 0;
  for (const review of reviews) {
    if (!review.shoe) {
      shop += 1;
      continue;
    }
    const entry = counts.get(review.shoe.id) ?? { shoe: review.shoe, count: 0 };
    entry.count += 1;
    counts.set(review.shoe.id, entry);
  }
  return { shoes: [...counts.values()].sort((a, b) => b.count - a.count), shop };
}

/** "S" for Sunil — the avatar's letter. */
export function initialOf(name: string) {
  return (name.trim()[0] ?? "★").toUpperCase();
}
