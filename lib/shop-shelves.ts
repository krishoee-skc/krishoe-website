import { unstable_cache } from "next/cache";
import { getProducts } from "@/lib/product-store";
import { categories, type Product } from "@/lib/products";
import { getProductsByCategory } from "@/lib/seo";
import { reportError } from "@/lib/report-error";

/**
 * How many shoes each shelf holds (owner's sample 9 ख, 2026-10-14).
 *
 * The shop listed thirteen shelves in its chips and its footer while only
 * Ladies Sandals held any shoes; a shopper tapped Men's Slippers, Kids Shoes,
 * New Arrivals and found "Coming soon" each time. The menus now offer only the
 * shelves with shoes, with their count. The empty shelves' pages stay — Google
 * and old links still land on their "Coming soon" — they are only out of the
 * way. A shelf shows again by itself when a shoe is put on it.
 */
export function shelfCounts(products: Product[]): Record<string, number> {
  return Object.fromEntries(categories.map((category) => [category.slug, getProductsByCategory(products, category).length]));
}

/**
 * The counts, or null when the shoes cannot be read — then every shelf shows,
 * as before. Kept ten minutes, like the home page's own line from Settings, so
 * the footer on every page does not read the whole catalogue each time.
 */
export const loadShelfCounts = unstable_cache(
  async (): Promise<Record<string, number> | null> => {
    try {
      return shelfCounts(await getProducts());
    } catch (error) {
      reportError("count the shoes on each shelf", error);
      return null;
    }
  },
  ["shop-shelf-counts"],
  { revalidate: 600 },
);

/** The slug of a shelf link ("/shop/ladies-sandals"), or "" for any other link. */
export function shelfSlugOf(href: string) {
  const match = /^\/shop\/([a-z0-9-]+)$/.exec(href);
  return match ? match[1] : "";
}
