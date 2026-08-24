"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";

// Shared body for the storefront's per-route error boundaries. A failure in one
// area (checkout, a product, the shop grid) shows this in place instead of
// taking down the whole site through the single global boundary.
export default function RouteError({
  reset,
  title = "Something needs a quick retry.",
  message = "Your cart and browsing are kept safe. Please retry, or return to the shop.",
}: {
  reset: () => void;
  title?: string;
  message?: string;
}) {
  const { text } = useLanguage();
  return (
    <main className="min-h-screen bg-brand-mist px-5 py-16">
      <div className="mx-auto max-w-2xl rounded-lg border border-black/10 bg-brand-paper p-8 text-center shadow-[0_24px_70px_rgba(16,35,29,0.10)] md:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">KRISHOE</p>
        <h1 className="mt-4 text-2xl font-black text-brand-green-ink md:text-3xl">{title}</h1>
        <p className="mt-3 text-sm leading-7 text-brand-muted">{message}</p>
        <div className="mt-5 grid gap-2 text-left sm:grid-cols-3">
          {["Cart safe", "No duplicate charge", "Quick retry"].map((item) => (
            <div key={item} className="rounded-lg bg-brand-mist px-3 py-2 text-xs font-black text-brand-green-ink">
              {item}
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="h-11 rounded-full bg-brand-green px-6 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink"
          >
            {text("Try again", "फेरि प्रयास")}
          </button>
          <Link
            href="/shop"
            className="inline-flex h-11 items-center rounded-full border border-brand-green px-6 text-sm font-bold text-brand-green transition hover:bg-brand-mist"
          >
            {text("Shop collection", "पसल हेर्ने")}
          </Link>
        </div>
      </div>
    </main>
  );
}
