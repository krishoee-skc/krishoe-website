"use client";

import Link from "next/link";

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
  return (
    <section className="mx-auto max-w-2xl px-5 py-20 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">KRISHOE</p>
      <h1 className="mt-4 text-2xl font-black text-brand-green-ink">{title}</h1>
      <p className="mt-3 text-sm leading-7 text-brand-muted">{message}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="h-11 rounded-full bg-brand-green px-6 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink"
        >
          Try again
        </button>
        <Link
          href="/shop"
          className="inline-flex h-11 items-center rounded-full border border-brand-green px-6 text-sm font-bold text-brand-green transition hover:bg-brand-mist"
        >
          Shop collection
        </Link>
      </div>
    </section>
  );
}
