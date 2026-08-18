"use client";

import { useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/products";
import { whatsappOrderUrl, viberOrderUrl } from "@/lib/commerce";
import { CheckIcon, HeartIcon, ShoppingBagIcon } from "@/components/Icons";
import { useCommerce } from "@/components/commerce/CommerceProvider";
import ProductOptionSelector from "@/components/ProductOptionSelector";
import QuantitySelector from "@/components/QuantitySelector";
import { stockLevel } from "@/lib/stock-thresholds";
import { useLanguage } from "@/components/LanguageProvider";
import SizeGuide from "@/components/SizeGuide";
import { trackCommerceEvent, trackContact } from "@/lib/analytics-events";

type ProductDetailActionsProps = {
  product: Product;
};

export default function ProductDetailActions({ product }: ProductDetailActionsProps) {
  const { text } = useLanguage();
  const { addToCart, toggleWishlist, isWishlisted } = useCommerce();
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
  }, [product.id, product.name, product.priceValue]);

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

  function setClampedQuantity(update: (current: number) => number) {
    setQuantity((current) => Math.min(maxQuantity, Math.max(1, update(Math.min(current, maxQuantity)))));
  }

  return (
    <>
      <div className="rounded-lg border border-black/10 bg-white p-5 shadow-[0_24px_70px_rgba(16,35,29,0.10)]">
        {outOfStock ? (
          <p className="mb-4 inline-flex items-center rounded-full bg-[#FBE9E7] px-3 py-1 text-sm font-bold text-brand-danger">
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

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <QuantitySelector quantity={selectedQuantity} setQuantity={setClampedQuantity} maxQuantity={maxQuantity} />

          <button
            type="button"
            onClick={addSelectedItem}
            disabled={outOfStock}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-brand-green px-6 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink disabled:cursor-not-allowed disabled:bg-[#9AA6A1] disabled:hover:text-white"
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
        <div className="mx-auto grid max-w-md grid-cols-[1fr_auto] gap-3">
          <button
            type="button"
            onClick={addSelectedItem}
            disabled={outOfStock}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand-green px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[#9AA6A1]"
          >
            <ShoppingBagIcon className="h-4 w-4" />
            {outOfStock
              ? text("Sold out", "सकियो")
              : added
                ? text("Added", "थपियो")
                : text("Add", "थप्नुहोस्")}
          </button>
          <a
            href={whatsappOrderUrl(orderMessage)}
            onClick={() => trackContact("whatsapp")}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 items-center justify-center rounded-full bg-[#25D366] px-5 text-sm font-bold text-white"
          >
            WhatsApp
          </a>
        </div>
      </div>
    </>
  );
}
