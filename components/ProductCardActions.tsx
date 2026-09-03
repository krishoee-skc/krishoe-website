"use client";

import { useState } from "react";
import type { Product } from "@/lib/products";
import { HeartIcon, ShoppingBagIcon } from "@/components/Icons";
import { useCommerce } from "@/components/commerce/CommerceProvider";
import { stockLevel } from "@/lib/stock-thresholds";
import { trackCommerceEvent } from "@/lib/analytics-events";

import { useLanguage } from "@/components/LanguageProvider";
type ProductCardActionsProps = {
  product: Product;
};

export default function ProductCardActions({ product }: ProductCardActionsProps) {
  const { addToCart, toggleWishlist, isWishlisted } = useCommerce();
  const [added, setAdded] = useState(false);
  const { text } = useLanguage();
  const wished = isWishlisted(product.id);
  const outOfStock = stockLevel(product.stock) === "out";

  function addDefaultItem() {
    if (outOfStock) {
      return;
    }

    addToCart({
      productId: product.id,
      size: product.sizes[0],
      color: product.colors[0],
      quantity: 1,
    });
    trackCommerceEvent("add_to_cart", {
      id: product.id,
      name: product.name,
      pricePaisa: product.priceValue,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  }

  return (
    <div className="flex items-center gap-2.5 md:gap-2">
      <button
        type="button"
        onClick={() => toggleWishlist(product.id)}
        aria-label={wished ? text("Remove from wishlist", "मनपर्नेबाट हटाउने") : text("Add to wishlist", "मनपर्नेमा राख्ने")}
        className={`grid min-h-12 w-12 place-items-center rounded-full border transition md:h-11 md:w-11 ${
          wished
            ? "border-brand-gold-bright bg-brand-cream text-brand-gold-dark"
            : "border-black/10 text-brand-green hover:border-brand-green hover:bg-brand-mist"
        }`}
      >
        <HeartIcon className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={addDefaultItem}
        disabled={outOfStock}
        className={`group/add relative inline-flex min-h-12 flex-1 items-center justify-center gap-2 overflow-hidden rounded-full px-4 py-2.5 text-sm font-bold transition-all duration-300 md:h-11 md:py-0 ${
          outOfStock
            ? "cursor-not-allowed bg-slate-100 text-brand-muted"
            : added
              ? "bg-brand-gold-bright text-brand-green-ink shadow-[0_10px_24px_rgba(201,162,75,0.35)]"
              : "bg-[linear-gradient(135deg,#0e6349,#0B4D3B)] text-white shadow-[0_10px_24px_-6px_rgba(11,77,59,0.5)] hover:-translate-y-0.5 hover:shadow-[0_18px_34px_-8px_rgba(11,77,59,0.55)] active:scale-[0.97]"
        }`}
      >
        {/* A gold sheen sweeps across on hover — the button stays readable the
            whole time because the text never changes colour, only the surface
            lifts. */}
        {!outOfStock && !added ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -translate-x-full bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.22),transparent)] transition-transform duration-700 group-hover/add:translate-x-full"
          />
        ) : null}
        <ShoppingBagIcon className="relative h-4 w-4" />
        <span className="relative">
          {outOfStock
            ? text("Sold out", "सकियो")
            : added
              ? text("Added ✓", "थपियो ✓")
              : text("Add", "थप्ने")}
        </span>
      </button>
    </div>
  );
}
