"use client";

import { useState } from "react";
import type { Product } from "@/lib/products";
import { HeartIcon, ShoppingBagIcon } from "@/components/Icons";
import { useCommerce } from "@/components/commerce/CommerceProvider";
import { stockLevel } from "@/lib/stock-thresholds";

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
        className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_22px_rgba(11,77,59,0.16)] transition md:h-11 md:py-0 ${
          outOfStock
            ? "cursor-not-allowed border-black/10 bg-slate-100 text-brand-muted"
            : added
              ? "border-brand-gold-bright bg-brand-gold-bright text-brand-green-ink"
              : "border-brand-green bg-[linear-gradient(135deg,#0B4D3B,#07513D)] text-white hover:-translate-y-0.5 hover:border-brand-gold-bright hover:bg-brand-gold-bright hover:text-brand-green-ink hover:shadow-[0_16px_32px_rgba(11,77,59,0.20)]"
        }`}
      >
        <ShoppingBagIcon className="h-4 w-4" />
        {outOfStock
          ? text("Sold out", "सकियो")
          : added
            ? text("Added", "थपियो")
            : text("Add", "थप्ने")}
      </button>
    </div>
  );
}
