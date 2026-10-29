"use client";

import { useLanguage } from "@/components/LanguageProvider";
import { CashIcon, FactoryIcon, ReturnIcon, TruckIcon } from "@/components/Icons";

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
      Icon: FactoryIcon,
      value: text("Hand-made", "हातले बनेको"),
      label: text("in our Narayangadh workshop", "नारायणगढकै कारखानामा"),
    },
    {
      Icon: TruckIcon,
      value: text("1-2 days", "१–२ दिन"),
      label: text("local · 3-5 elsewhere", "स्थानीय · अन्यत्र ३–५"),
    },
    {
      Icon: CashIcon,
      value: text("Pay on delivery", "पाएपछि तिर्ने"),
      label: text("nothing in advance", "अग्रिम केही पठाउनु पर्दैन"),
    },
    {
      Icon: ReturnIcon,
      value: text("7 days", "७ दिन"),
      label: text("to exchange or return", "साट्न वा फिर्ता गर्न"),
    },
  ];

  return (
    // Four in one row on a phone too, smaller (owner's shop sample, 2026-10-26):
    // two by two they were taller than the buying box.
    <ul className="mt-5 grid grid-cols-4 gap-1.5 sm:mt-6 sm:gap-2">
      {items.map((item) => (
        <li
          key={item.value}
          className="rounded-xl border border-brand-green-line bg-brand-mist px-1 py-2 text-center sm:px-3 sm:py-3"
        >
          <span aria-hidden="true" className="mx-auto grid h-7 w-7 place-items-center rounded-lg bg-brand-green-wash text-brand-green sm:h-9 sm:w-9 sm:rounded-xl">
            <item.Icon className="h-5 w-5" />
          </span>
          <p className="mt-1 text-[13px] font-black leading-tight text-brand-green-ink sm:mt-1.5 sm:text-sm">{item.value}</p>
          <p className="mt-0.5 text-xs leading-4 text-brand-muted sm:text-[13px] sm:leading-[1.15rem]">{item.label}</p>
        </li>
      ))}
    </ul>
  );
}
