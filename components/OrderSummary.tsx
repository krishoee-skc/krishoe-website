"use client";

import Image from "next/image";
import { formatPrice } from "@/lib/products";
import { useCommerce } from "@/components/commerce/CommerceProvider";
import { useLanguage } from "@/components/LanguageProvider";
import type { DeliveryCharge } from "@/lib/delivery-fee";

type OrderSummaryProps = {
  /** The discount the code in the checkout form is worth, in paisa. */
  discountPaisa: number;
  /** What delivery costs this order, from the owner's settings. */
  deliveryCharge: DeliveryCharge;
  /** Pairs after the discount, plus delivery. */
  totalLabel: string;
};

/**
 * The money, line by line.
 *
 * The big number here was the price of the pairs alone. A customer with a
 * discount code saw one figure in the form and a larger one here, and nobody
 * could see what delivery would add. Now each part is its own line and the
 * total is the one the order will carry.
 */
export default function OrderSummary({ discountPaisa, deliveryCharge, totalLabel }: OrderSummaryProps) {
  const { text } = useLanguage();
  const { cartItems, subtotalLabel } = useCommerce();

  const deliveryValue =
    deliveryCharge.kind === "charged"
      ? formatPrice(deliveryCharge.feePaisa)
      : deliveryCharge.kind === "free"
        ? text("Free", "Free")
        : deliveryCharge.kind === "choose-area"
          ? text("Choose your area", "ठाउँ रोज्नुहोस्")
          : text("Confirmed on the call", "फोनमा पक्का गरिन्छ");

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
              <p className="mt-1 text-xs text-white/80">
                {item.size} / {item.color} / Qty {item.quantity}
              </p>
              <p className="mt-2 text-sm font-black text-brand-gold-bright">{formatPrice(item.lineTotal)}</p>
            </div>
          </div>
        ))}
      </div>
      <dl className="mt-6 grid gap-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-white/85">{text("Pairs", "सामान")}</dt>
          <dd className="font-bold tabular-nums">{subtotalLabel}</dd>
        </div>
        {discountPaisa > 0 ? (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-white/85">{text("Discount", "छुट")}</dt>
            <dd className="font-bold tabular-nums text-brand-gold-bright">− {formatPrice(discountPaisa)}</dd>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <dt className="text-white/85">{text("Delivery", "डेलिभरी")}</dt>
          <dd className="font-bold tabular-nums">{deliveryValue}</dd>
        </div>
      </dl>
      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
        <span className="text-sm text-white/85">{text("Total", "जम्मा")}</span>
        <span className="text-3xl font-black tabular-nums">{totalLabel}</span>
      </div>
      <p className="mt-4 text-xs leading-6 text-white/75">
        {deliveryCharge.kind === "confirm"
          ? text(
              "The delivery charge is added when KRISHOE confirms your order on the call.",
              "अर्डर फोनमा पक्का गर्दा डेलिभरी शुल्क जोडिन्छ।",
            )
          : text(
              "Final availability is confirmed by KRISHOE before payment.",
              "भुक्तानीअघि KRISHOE ले स्टक पक्का गर्छ।",
            )}
      </p>
      <div className="mt-5 grid gap-2 border-t border-white/10 pt-5 text-xs font-semibold text-white/85">
        <p>{text("Stock check before dispatch", "पठाउनुअघि स्टक जाँचिन्छ")}</p>
        <p>{text("Payment matched with order reference", "अर्डर नम्बरसँग भुक्तानी मिलाइन्छ")}</p>
        <p>{text("Private order page after request", "अर्डरपछि आफ्नै पाना पाइन्छ")}</p>
      </div>
    </aside>
  );
}
