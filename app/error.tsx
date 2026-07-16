"use client";

import Link from "next/link";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-mist px-5 py-16">
      <section className="w-full max-w-2xl rounded-lg border border-black/10 bg-white p-8 text-center shadow-[0_24px_70px_rgba(16,35,29,0.08)]">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
          KRISHOE
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-brand-green-ink">
          Something needs a quick retry.
        </h1>
        <p className="mt-4 text-sm leading-7 text-brand-muted">
          Your cart and browsing session are kept safe. Please retry, or return to the shop.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="h-12 rounded-full bg-brand-green px-6 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink"
          >
            Try again
          </button>
          <Link
            href="/shop"
            className="inline-flex h-12 items-center rounded-full border border-brand-green px-6 text-sm font-bold text-brand-green transition hover:bg-brand-mist"
          >
            Shop collection
          </Link>
        </div>
      </section>
    </main>
  );
}
