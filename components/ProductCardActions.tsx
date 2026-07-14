"use client";

import { useState } from "react";
import type { Product } from "@/lib/products";
import { HeartIcon, ShoppingBagIcon } from "@/components/Icons";
import { useCommerce } from "@/components/commerce/CommerceProvider";

type ProductCardActionsProps = {
  product: Product;
};

export default function ProductCardActions({ product }: ProductCardActionsProps) {
  const { addToCart, toggleWishlist, isWishlisted } = useCommerce();
  const [added, setAdded] = useState(false);
  const wished = isWishlisted(product.id);

  function addDefaultItem() {
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
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => toggleWishlist(product.id)}
        aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
        className={`grid h-11 w-11 place-items-center rounded-full border transition ${
          wished
            ? "border-[#D4AF37] bg-[#FFF6D8] text-[#9A6B08]"
            : "border-black/10 text-[#0B4D3B] hover:border-[#0B4D3B] hover:bg-[#F5F7F4]"
        }`}
      >
        <HeartIcon className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={addDefaultItem}
        className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#0B4D3B] px-4 text-sm font-semibold text-white transition hover:bg-[#D4AF37] hover:text-[#10231D]"
      >
        <ShoppingBagIcon className="h-4 w-4" />
        {added ? "Added" : "Add"}
      </button>
    </div>
  );
}
