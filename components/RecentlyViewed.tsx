"use client";

import ProductCard from "@/components/ProductCard";
import { useCommerce } from "@/components/commerce/CommerceProvider";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * The shoes this shopper has already opened, offered back to them.
 *
 * Someone deciding between two or three pairs opens them in turn and loses the
 * earlier ones to the back button. This row keeps them one tap away, which is
 * exactly where a decision that was nearly made can still be finished. Read from
 * the browser only — nothing about who is looking leaves the device — so it also
 * costs the page's caching nothing; the list arrives after the page paints.
 */
export default function RecentlyViewed({ excludeId }: { excludeId?: string }) {
  const { recentlyViewed, products } = useCommerce();
  const { text } = useLanguage();

  const byId = new Map(products.map((product) => [product.id, product]));
  const shown = recentlyViewed
    .filter((id) => id !== excludeId)
    .map((id) => byId.get(id))
    .filter((product): product is NonNullable<typeof product> => Boolean(product))
    .slice(0, 4);

  // Fewer than two is not a row worth a heading; it removes itself rather than
  // standing nearly empty.
  if (shown.length < 2) return null;

  return (
    <section className="bg-brand-paper py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <h2 className="text-2xl font-black tracking-tight text-brand-green-ink md:text-4xl">
          {text("Recently viewed", "भर्खर हेरेका")}
        </h2>
        <div className="mt-8 grid grid-cols-2 gap-3 md:gap-6 lg:grid-cols-4">
          {shown.map((product) => (
            <ProductCard key={product.id} product={product} intent="shop" />
          ))}
        </div>
      </div>
    </section>
  );
}
