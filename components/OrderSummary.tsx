"use client";

import Image from "next/image";
import { formatPrice } from "@/lib/products";
import { useCommerce } from "@/components/commerce/CommerceProvider";
import { useLanguage } from "@/components/LanguageProvider";

export default function OrderSummary() {
  const { text } = useLanguage();
  const { cartItems, subtotalLabel } = useCommerce();

  return (
    <aside className="h-fit rounded-lg border border-black/10 bg-brand-green-ink p-6 text-white shadow-[0_24px_70px_rgba(16,35,29,0.20)] lg:sticky lg:top-24">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-bright">
        {text("Order review", "अर्डर जाँच्नुहोस्")}
      </p>
      <div className="mt-6 space-y-4">
        {cartItems.map((item) => (
          <div key={item.key} className="grid grid-cols-[72px_1fr] gap-4 border-b border-white/10 pb-4">
            <div className="relative aspect-square overflow-hidden rounded-lg bg-white/10">
              <Image src={item.image} alt={item.name} fill sizes="72px" className="object-cover" />
            </div>
            <div className="min-w-0">
              <p className="break-words font-bold">{item.name}</p>
              <p className="mt-1 text-xs text-white/60">
                {item.size} / {item.color} / Qty {item.quantity}
              </p>
              <p className="mt-2 text-sm font-black text-brand-gold-bright">{formatPrice(item.lineTotal)}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between">
        <span className="text-sm text-white/65">Total</span>
        <span className="text-3xl font-black">{subtotalLabel}</span>
      </div>
      <p className="mt-4 text-xs leading-6 text-white/55">
        Delivery charge and final availability are confirmed by KRISHOE before payment.
      </p>
      <div className="mt-5 grid gap-2 border-t border-white/10 pt-5 text-xs font-semibold text-white/70">
        <p>{text("Stock check before dispatch", "पठाउनुअघि स्टक जाँचिन्छ")}</p>
        <p>{text("Payment matched with order reference", "अर्डर नम्बरसँग भुक्तानी मिलाइन्छ")}</p>
        <p>{text("Private order page after request", "अर्डरपछि आफ्नै पाना पाइन्छ")}</p>
      </div>
    </aside>
  );
}
