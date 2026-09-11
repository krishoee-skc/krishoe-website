"use client";

import { useLanguage } from "@/components/LanguageProvider";

/**
 * Four small reassurances, under the price, on every shoe.
 *
 * A first-time shopper on a shop they have not bought from before is asking
 * four quiet questions — who made this, when will it come, do I have to pay
 * before I see it, and what if it does not fit. The answers were already on the
 * site, spread across the FAQ, the return policy and the checkout page, which
 * is to say they were answered everywhere except the moment the question is
 * actually asked.
 *
 * Every figure here is taken from what the shop already promises in writing,
 * not written fresh:
 *
 *   1-2 / 3-5 days  app/faq/page.tsx, the delivery answer
 *   cash on delivery  lib/commerce.ts paymentOptions, and the FAQ
 *   7 days            app/return-policy/page.tsx
 *   Narayangadh       lib/seo.ts businessContact
 *
 * If one of those promises changes, this has to change with it — which is why
 * the numbers are stated once here and a test holds them to the policy page.
 */
export default function TrustStrip() {
  const { text } = useLanguage();

  const items = [
    {
      icon: "👟",
      value: text("Hand-made", "हातले बनेको"),
      label: text("in our Narayangadh workshop", "नारायणगढकै कारखानामा"),
    },
    {
      icon: "🚚",
      value: text("1-2 days", "१–२ दिन"),
      label: text("local · 3-5 elsewhere", "स्थानीय · अन्यत्र ३–५"),
    },
    {
      icon: "💵",
      value: text("Pay on delivery", "पाएपछि तिर्ने"),
      label: text("nothing in advance", "अग्रिम केही पठाउनु पर्दैन"),
    },
    {
      icon: "↩️",
      value: text("7 days", "७ दिन"),
      label: text("to exchange or return", "साट्न वा फिर्ता गर्न"),
    },
  ];

  return (
    <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((item) => (
        <li
          key={item.value}
          className="rounded-xl border border-brand-green-line bg-brand-mist px-3 py-3 text-center"
        >
          <span aria-hidden="true" className="text-lg leading-none">
            {item.icon}
          </span>
          <p className="mt-1.5 text-sm font-black leading-tight text-brand-green-ink">{item.value}</p>
          <p className="mt-0.5 text-[11px] leading-4 text-brand-muted">{item.label}</p>
        </li>
      ))}
    </ul>
  );
}
