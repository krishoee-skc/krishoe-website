"use client";

import { useMemo, useState } from "react";
import type { Product } from "@/lib/products";
import { whatsappOrderUrl } from "@/lib/commerce";
import { HeartIcon, ShoppingBagIcon } from "@/components/Icons";
import { useCommerce } from "@/components/commerce/CommerceProvider";
import ProductOptionSelector from "@/components/ProductOptionSelector";
import QuantitySelector from "@/components/QuantitySelector";

type ProductDetailActionsProps = {
  product: Product;
};

export default function ProductDetailActions({ product }: ProductDetailActionsProps) {
  const { addToCart, toggleWishlist, isWishlisted } = useCommerce();
  const [size, setSize] = useState(product.sizes[0]);
  const [color, setColor] = useState(product.colors[0]);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const wished = isWishlisted(product.id);

  const orderMessage = useMemo(
    () =>
      [
        `Hello KRISHOE, I want to order ${product.name}.`,
        `Size: ${size}`,
        `Color: ${color}`,
        `Quantity: ${quantity}`,
        `Price: ${product.price}`,
      ].join("\n"),
    [color, product.name, product.price, quantity, size],
  );

  function addSelectedItem() {
    addToCart({ productId: product.id, size, color, quantity });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  }

  return (
    <div className="rounded-lg border border-black/10 bg-white p-5 shadow-[0_24px_70px_rgba(16,35,29,0.10)]">
      <div className="space-y-6">
        <ProductOptionSelector title="Select size" options={product.sizes} selectedValue={size} onValueChange={setSize} />
        <ProductOptionSelector title="Select color" options={product.colors} selectedValue={color} onValueChange={setColor} variant="color" />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <QuantitySelector quantity={quantity} setQuantity={setQuantity} />

        <button
          type="button"
          onClick={addSelectedItem}
          className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#0B4D3B] px-6 text-sm font-bold text-white transition hover:bg-[#D4AF37] hover:text-[#10231D]"
        >
          <ShoppingBagIcon className="h-4 w-4" />
          {added ? "Added to cart" : "Add to cart"}
        </button>

        <button
          type="button"
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
          onClick={() => toggleWishlist(product.id)}
          className={`grid h-12 w-12 place-items-center rounded-full border transition ${
            wished
              ? "border-[#D4AF37] bg-[#FFF6D8] text-[#9A6B08]"
              : "border-black/10 text-[#0B4D3B] hover:border-[#0B4D3B]"
          }`}
        >
          <HeartIcon className="h-5 w-5" />
        </button>
      </div>

      <a
        href={whatsappOrderUrl(orderMessage)}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-full border border-[#0B4D3B] px-6 text-sm font-bold text-[#0B4D3B] transition hover:bg-[#0B4D3B] hover:text-white"
      >
        Order on WhatsApp
      </a>
    </div>
  );
}
