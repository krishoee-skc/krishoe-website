"use client";

import { useMemo, useState } from "react";
import type { Product } from "@/lib/products";
import { whatsappOrderUrl, viberOrderUrl } from "@/lib/commerce";
import { HeartIcon, ShoppingBagIcon } from "@/components/Icons";
import { useCommerce } from "@/components/commerce/CommerceProvider";
import ProductOptionSelector from "@/components/ProductOptionSelector";
import QuantitySelector from "@/components/QuantitySelector";
import { stockLevel } from "@/lib/stock-thresholds";

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
  const level = stockLevel(product.stock);
  const outOfStock = level === "out";
  const lowStock = level === "low";

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
      {outOfStock ? (
        <p className="mb-4 inline-flex items-center rounded-full bg-[#FBE9E7] px-3 py-1 text-sm font-bold text-brand-danger">
          Sold out
        </p>
      ) : lowStock ? (
        <p className="mb-4 inline-flex items-center rounded-full bg-brand-cream px-3 py-1 text-sm font-bold text-brand-gold-dark">
          Hurry — only {product.stock} left
        </p>
      ) : null}

      <div className="space-y-6">
        <ProductOptionSelector title="Select size" options={product.sizes} selectedValue={size} onValueChange={setSize} />
        <ProductOptionSelector title="Select color" options={product.colors} selectedValue={color} onValueChange={setColor} variant="color" />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <QuantitySelector quantity={quantity} setQuantity={setQuantity} />

        <button
          type="button"
          onClick={addSelectedItem}
          disabled={outOfStock}
          className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-brand-green px-6 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink disabled:cursor-not-allowed disabled:bg-[#9AA6A1] disabled:hover:text-white"
        >
          <ShoppingBagIcon className="h-4 w-4" />
          {outOfStock ? "Sold out" : added ? "Added to cart" : "Add to cart"}
        </button>

        <button
          type="button"
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
          onClick={() => toggleWishlist(product.id)}
          className={`grid h-12 w-12 place-items-center rounded-full border transition ${
            wished
              ? "border-brand-gold-bright bg-brand-cream text-brand-gold-dark"
              : "border-black/10 text-brand-green hover:border-brand-green"
          }`}
        >
          <HeartIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <a
          href={whatsappOrderUrl(orderMessage)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[#25D366] px-6 text-sm font-bold text-white transition hover:brightness-95"
        >
          Order on WhatsApp
        </a>
        <a
          href={viberOrderUrl(orderMessage)}
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[#7360F2] px-6 text-sm font-bold text-white transition hover:brightness-95"
        >
          Order on Viber
        </a>
      </div>

      <ul className="mt-5 space-y-2 border-t border-black/10 pt-4 text-sm text-brand-muted">
        <li className="flex items-center gap-2">
          <span aria-hidden className="text-brand-green">✓</span> Cash on Delivery available
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="text-brand-green">✓</span> Delivery across Nepal
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="text-brand-green">✓</span> Genuine product &amp; easy returns
        </li>
      </ul>
    </div>
  );
}
