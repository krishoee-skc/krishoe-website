"use client";

import { useState } from "react";
import ProductCard from "@/components/ProductCard";
import { useLanguage } from "@/components/LanguageProvider";
import type { Product } from "@/lib/products";

/**
 * Best Sellers / Trending / New — the three ways a shopper browses the front
 * page, on the tabs the approved design asks for. The lists are worked out on
 * the server (which product carries which flag) and handed here; this only
 * switches between them, so pressing a tab is instant and no products cross the
 * wire twice. An empty tab falls back to the best sellers rather than a blank
 * shelf, so the row is never empty on a shop that has not tagged everything yet.
 */
type Lists = {
  /** Every shoe any tab names, once. */
  pool: Product[];
  /** The tabs, as ids into the pool — so an overlapping shoe is sent once. */
  best: string[];
  trending: string[];
  newArrivals: string[];
};

const TABS = [
  { id: "best", en: "Best Sellers", ne: "धेरै बिक्ने" },
  { id: "trending", en: "Trending", ne: "चर्चामा" },
  { id: "new", en: "New Arrivals", ne: "नयाँ" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function BestSellerTabs({ pool, best, trending, newArrivals }: Lists) {
  const [tab, setTab] = useState<TabId>("best");
  const { text } = useLanguage();

  // The ids are resolved back to shoes here. Order is the order the server
  // chose, and an id with nothing behind it is skipped rather than drawn as a
  // gap — the shelf shows shoes or it shows nothing.
  const byId = new Map(pool.map((product) => [product.id, product]));
  const resolve = (ids: string[]) =>
    ids.flatMap((id) => {
      const product = byId.get(id);
      return product ? [product] : [];
    });

  const chosen = resolve(tab === "trending" ? trending : tab === "new" ? newArrivals : best);
  const list = chosen.length > 0 ? chosen : resolve(best);

  return (
    <>
      <div className="mt-8 flex gap-6 overflow-x-auto border-b border-brand-green-line">
        {TABS.map((entry) => {
          const active = entry.id === tab;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={`-mb-px flex-none border-b-2 pb-3 text-sm font-bold uppercase tracking-[0.08em] transition ${
                active
                  ? "border-brand-green text-brand-green"
                  : "border-transparent text-brand-muted-soft hover:text-brand-green-ink"
              }`}
            >
              {text(entry.en, entry.ne)}
            </button>
          );
        })}
      </div>

      <div className="mobile-product-rail mt-8 md:grid md:grid-cols-2 md:gap-6 lg:grid-cols-4">
        {list.slice(0, 8).map((product) => (
          <div key={product.id} className="mobile-product-slide">
            <ProductCard product={product} intent="shop" />
          </div>
        ))}
      </div>
    </>
  );
}
