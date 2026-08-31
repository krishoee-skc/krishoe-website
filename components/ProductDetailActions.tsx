"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/products";
import { whatsappOrderUrl, viberOrderUrl } from "@/lib/commerce";
import { CheckIcon, HeartIcon, ShoppingBagIcon } from "@/components/Icons";
import { useCommerce } from "@/components/commerce/CommerceProvider";
import ProductOptionSelector from "@/components/ProductOptionSelector";
import QuantitySelector from "@/components/QuantitySelector";
import { stockLevel } from "@/lib/stock-thresholds";
import { useLanguage } from "@/components/LanguageProvider";
import { goods } from "@/lib/words";
import SizeGuide from "@/components/SizeGuide";
import { trackCommerceEvent, trackContact } from "@/lib/analytics-events";

type ProductDetailActionsProps = {
  product: Product;
};

export default function ProductDetailActions({ product }: ProductDetailActionsProps) {
  const { text } = useLanguage();
  const router = useRouter();
  const { addToCart, toggleWishlist, isWishlisted, recordView } = useCommerce();
  const [size, setSize] = useState(product.sizes[0]);
  const [color, setColor] = useState(product.colors[0]);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const wished = isWishlisted(product.id);
  const level = stockLevel(product.stock);
  const outOfStock = level === "out";
  const lowStock = level === "low";
  const maxQuantity = outOfStock ? 1 : Math.max(1, Math.min(9, product.stock));
  const selectedQuantity = Math.min(quantity, maxQuantity);

  useEffect(() => {
    trackCommerceEvent("view_item", {
      id: product.id,
      name: product.name,
      pricePaisa: product.priceValue,
    });
    recordView(product.id);
  }, [product.id, product.name, product.priceValue, recordView]);

  const orderMessage = useMemo(() => {
    if (outOfStock) {
      return `Hello KRISHOE, is ${product.name} available again?`;
    }

    return [
      `Hello KRISHOE, I want to order ${product.name}.`,
      `Size: ${size}`,
      `Color: ${color}`,
      `Quantity: ${selectedQuantity}`,
      `Price: ${product.price}`,
    ].join("\n");
  }, [color, outOfStock, product.name, product.price, selectedQuantity, size]);

  const trustItems = [
    text("Cash on Delivery available", "सामान बुझ्दा नगद सुविधा"),
    text("Delivery across Nepal", "देशभर डेलिभरी"),
    text("Stock confirmed before digital payment", "अनलाइन भुक्तानीअघि स्टक पक्का"),
  ];

  function addSelectedItem() {
    if (outOfStock) {
      return;
    }

    addToCart({ productId: product.id, size, color, quantity: selectedQuantity });
    trackCommerceEvent("add_to_cart", {
      id: product.id,
      name: product.name,
      pricePaisa: product.priceValue,
      quantity: selectedQuantity,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  }

  // Buy Now: the same selected pair, straight to checkout. It shortens the road
  // between wanting the shoe and paying for it to a single tap — no cart detour —
  // which is where an impulse to buy is most often lost.
  function buyNow() {
    if (outOfStock) {
      return;
    }

    addToCart({ productId: product.id, size, color, quantity: selectedQuantity });
    trackCommerceEvent("add_to_cart", {
      id: product.id,
      name: product.name,
      pricePaisa: product.priceValue,
      quantity: selectedQuantity,
    });
    router.push("/checkout");
  }

  function setClampedQuantity(update: (current: number) => number) {
    setQuantity((current) => Math.min(maxQuantity, Math.max(1, update(Math.min(current, maxQuantity)))));
  }

  return (
    <>
      <div className="rounded-lg border border-black/10 bg-brand-paper p-5 shadow-[0_24px_70px_rgba(16,35,29,0.10)]">
        {outOfStock ? (
          <p className="mb-4 inline-flex items-center rounded-full bg-brand-clay-tint px-3 py-1 text-sm font-bold text-brand-danger">
            {text("Sold out", "बिक्री सकियो")}
          </p>
        ) : lowStock ? (
          <p className="mb-4 inline-flex items-center rounded-full bg-brand-cream px-3 py-1 text-sm font-bold text-brand-gold-dark">
            {text(`Hurry - only ${product.stock} left`, `हतार गर्नुहोस् — ${product.stock} जोडी मात्र बाँकी`)}
          </p>
        ) : null}

        <div className="space-y-6">
          <div>
            <ProductOptionSelector title={text("Select size", "साइज छान्नुहोस्")} options={product.sizes} selectedValue={size} onValueChange={setSize} />
            {/* Beside the sizes, where the doubt is. A guide linked from the
                footer is a guide nobody opens — and guessing the size is the
                single biggest reason a pair of shoes comes back. */}
            <div className="mt-2">
              <SizeGuide sizes={product.sizes} />
            </div>
          </div>
          <ProductOptionSelector title={text("Select color", "रङ छान्नुहोस्")} options={product.colors} selectedValue={color} onValueChange={setColor} variant="color" />
        </div>

        {/* Buy Now is the primary path — a shopper who has chosen a size wants to
            pay, not to manage a cart. Add to cart stays for anyone building a
            larger order. */}
        <button
          type="button"
          onClick={buyNow}
          disabled={outOfStock}
          className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-brand-green px-6 text-base font-black text-white shadow-[0_14px_30px_-12px_rgba(16,35,29,0.6)] transition hover:bg-brand-gold-bright hover:text-brand-green-ink disabled:cursor-not-allowed disabled:bg-brand-muted-soft disabled:hover:text-white"
        >
          {outOfStock
            ? text("Sold out", "बिक्री सकियो")
            : text("Buy now", "अहिले किन्नुहोस्")}
        </button>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <QuantitySelector quantity={selectedQuantity} setQuantity={setClampedQuantity} maxQuantity={maxQuantity} />

          <button
            type="button"
            onClick={addSelectedItem}
            disabled={outOfStock}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border-2 border-brand-green bg-transparent px-6 text-sm font-bold text-brand-green transition hover:bg-brand-green hover:text-white disabled:cursor-not-allowed disabled:border-brand-muted-soft disabled:text-brand-muted-soft"
          >
            <ShoppingBagIcon className="h-4 w-4" />
            {outOfStock
              ? text("Sold out", "बिक्री सकियो")
              : added
                ? text("Added to cart", "कार्टमा थपियो")
                : text("Add to cart", "कार्टमा थप्नुहोस्")}
          </button>

          <button
            type="button"
            aria-label={
              wished
                ? text("Remove from wishlist", "मनपर्नेबाट हटाउनुहोस्")
                : text("Add to wishlist", "मनपर्नेमा राख्नुहोस्")
            }
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
            onClick={() => trackContact("whatsapp")}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[#25D366] px-6 text-sm font-bold text-white transition hover:brightness-95"
          >
            {outOfStock
              ? text("Ask on WhatsApp", "WhatsApp मा सोध्नुहोस्")
              : text("Order on WhatsApp", "WhatsApp बाट अर्डर")}
          </a>
          <a
            href={viberOrderUrl(orderMessage)}
            onClick={() => trackContact("viber")}
            className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[#7360F2] px-6 text-sm font-bold text-white transition hover:brightness-95"
          >
            {outOfStock
              ? text("Ask on Viber", "Viber मा सोध्नुहोस्")
              : text("Order on Viber", "Viber बाट अर्डर")}
          </a>
        </div>

        <ul className="mt-5 space-y-2 border-t border-black/10 pt-4 text-sm text-brand-muted">
          {trustItems.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <CheckIcon className="h-4 w-4 shrink-0 text-brand-green" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 px-4 py-3 shadow-[0_-16px_40px_rgba(16,35,29,0.14)] backdrop-blur md:hidden">
        {/* On the phone, the impulse zone. Buy Now leads; Add and WhatsApp stay
            within reach for the shopper who wants a cart or a chat first. */}
        <div className="mx-auto grid max-w-md grid-cols-[1.4fr_auto_auto] gap-2">
          <button
            type="button"
            onClick={buyNow}
            disabled={outOfStock}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand-green px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-brand-muted-soft"
          >
            {outOfStock
              ? text("Sold out", `बिक्री ${goods.soldOut.ne}`)
              : text("Buy now", "अहिले किन्ने")}
          </button>
          <button
            type="button"
            onClick={addSelectedItem}
            disabled={outOfStock}
            aria-label={text("Add to cart", "कार्टमा थप्नुहोस्")}
            className="inline-flex h-12 items-center justify-center gap-1 rounded-full border-2 border-brand-green bg-transparent px-3 text-sm font-bold text-brand-green disabled:cursor-not-allowed disabled:border-brand-muted-soft disabled:text-brand-muted-soft"
          >
            <ShoppingBagIcon className="h-4 w-4" />
            {added ? text("Added", "थपियो") : text("Add", "थप्नुहोस्")}
          </button>
          <a
            href={whatsappOrderUrl(orderMessage)}
            onClick={() => trackContact("whatsapp")}
            target="_blank"
            rel="noreferrer"
            aria-label={text("Order on WhatsApp", "WhatsApp बाट अर्डर")}
            className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-sm font-bold text-white"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91C21.95 6.45 17.5 2 12.04 2Zm5.8 14.16c-.24.68-1.42 1.31-1.95 1.36-.5.05-.97.24-3.27-.68-2.76-1.09-4.5-3.9-4.64-4.08-.14-.18-1.11-1.48-1.11-2.82 0-1.34.7-2 .95-2.28.24-.27.53-.34.71-.34.18 0 .36 0 .51.01.16.01.39-.06.6.46.24.57.79 1.96.86 2.1.07.14.12.31.02.49-.09.18-.14.29-.28.45-.14.16-.29.36-.42.48-.14.14-.28.28-.12.55.16.27.72 1.18 1.54 1.91 1.06.94 1.95 1.24 2.22 1.38.27.14.43.12.59-.07.16-.18.68-.79.86-1.06.18-.27.36-.23.6-.14.24.09 1.55.73 1.82.86.27.14.45.2.51.31.07.12.07.66-.17 1.34Z"/></svg>
          </a>
        </div>
      </div>
    </>
  );
}
