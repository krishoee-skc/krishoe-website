"use client";

import Link from "next/link";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F7F4] px-5 py-16">
      <section className="w-full max-w-2xl rounded-lg border border-black/10 bg-white p-8 text-center shadow-[0_24px_70px_rgba(16,35,29,0.08)]">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#B98A2E]">
          KRISHOE
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-[#10231D]">
          Something needs a quick retry.
        </h1>
        <p className="mt-4 text-sm leading-7 text-[#5F6B66]">
          Your cart and browsing session are kept safe. Please retry, or return to the shop.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="h-12 rounded-full bg-[#0B4D3B] px-6 text-sm font-bold text-white transition hover:bg-[#D4AF37] hover:text-[#10231D]"
          >
            Try again
          </button>
          <Link
            href="/shop"
            className="inline-flex h-12 items-center rounded-full border border-[#0B4D3B] px-6 text-sm font-bold text-[#0B4D3B] transition hover:bg-[#F5F7F4]"
          >
            Shop collection
          </Link>
        </div>
      </section>
    </main>
  );
}
