import { stockLevel } from "@/lib/stock-thresholds";
import type { Product } from "@/lib/products";

/**
 * Finding a pair by typing part of its name.
 *
 * The shop had a search box that searched nothing: it took what was typed and
 * navigated to /shop?query=…, where a second box did the actual filtering. Two
 * boxes, one of which only forwards to the other, and neither shows a result
 * until Enter is pressed — the owner reported it as broken, which is a fair
 * reading of a search that never shows anything.
 *
 * This is the matching itself, kept apart from the palette that draws it so it
 * can be tested without a browser.
 */

export type ProductMatch = {
  product: Product;
  /** Lower sorts first. */
  rank: number;
};

/** Everything about a pair that someone might type. */
function haystack(product: Product) {
  return [
    product.name,
    product.nameNe,
    product.sku,
    product.category,
    product.badge,
    product.colors.join(" "),
    product.sizes.join(" "),
    product.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * The words a shopper types for what the shop calls something else (owner,
 * 2026-10-01: search in Nepali too). "चप्पल" finds the chappals and slippers,
 * "हिल" the hills, Roman spellings included. A typed word matches when any of
 * its alternatives does; a word not listed stands for itself.
 */
const SAME_AS: Array<string[]> = [
  ["चप्पल", "chappal", "chapal", "slipper", "slippers", "स्लिपर"],
  ["स्यान्डल", "स्याण्डल", "sandal", "sandals", "sandel", "sandil", "सेन्डल"],
  ["हिल", "hill", "heel", "heels", "हिल्स"],
  ["जुत्ता", "shoe", "shoes", "jutta", "juta"],
  ["बच्चा", "kids", "kid", "bachha", "baccha", "child", "children", "केटाकेटी"],
  ["महिला", "ladies", "lady", "women", "लेडिज", "लेडीज", "केटी"],
  ["पुरुष", "men", "mens", "gents", "केटा"],
  ["कालो", "black", "kalo"],
  ["सेतो", "white", "seto"],
  ["रातो", "red", "rato"],
  ["खैरो", "brown", "khairo"],
];

function alternativesOf(word: string): string[] {
  const group = SAME_AS.find((words) => words.includes(word));
  return group ? group : [word];
}

/**
 * Matches, best first.
 *
 * Ranked rather than merely filtered, because a shopper typing "doctor" wants
 * the pair called Doctor Chappal before one whose description happens to
 * mention a doctor. Name beats SKU beats everything else, and within a rank a
 * pair that can actually be bought comes before one that is sold out — offering
 * an unavailable pair first is the search working against the shop.
 *
 * Every word must match somewhere, so "black sandal" narrows rather than
 * widens. People type more words to see less, and a search that returns more
 * for a longer phrase feels broken even when it is technically correct.
 */
export function searchProducts(products: Product[], rawQuery: string, limit = 6): ProductMatch[] {
  const words = rawQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const matches: ProductMatch[] = [];

  for (const product of products) {
    const text = haystack(product);
    if (!words.every((word) => alternativesOf(word).some((alternative) => text.includes(alternative)))) continue;

    const name = product.name.toLowerCase();
    const sku = (product.sku ?? "").toLowerCase();
    const first = words[0];
    const firstAlternatives = alternativesOf(first);

    const rank = firstAlternatives.some((alternative) => name.startsWith(alternative))
      ? 0
      : firstAlternatives.some((alternative) => name.includes(alternative))
        ? 1
        : sku.includes(first)
          ? 2
          : 3;

    matches.push({ product, rank });
  }

  return matches
    .sort((left, right) => {
      if (left.rank !== right.rank) return left.rank - right.rank;

      const leftOut = stockLevel(left.product.stock) === "out";
      const rightOut = stockLevel(right.product.stock) === "out";
      if (leftOut !== rightOut) return leftOut ? 1 : -1;

      return left.product.name.localeCompare(right.product.name);
    })
    .slice(0, limit);
}
