"use client";

import Link from "next/link";

// The shop's error page is written for a customer: it reassures and offers a
// way back, and deliberately says nothing technical. Behind the admin login the
// reader is the owner, and reassurance is not what they need — they need to
// know which part failed so it can be fixed or reported.
//
// Without this, an admin failure showed the customer page: the same screen
// whether the database blinked or a page was genuinely broken, with nothing to
// tell them apart. Three separate reports of "it says quick retry again" could
// not be diagnosed because the error was caught and discarded here.
//
// Next replaces server error messages with a digest in production, so the
// digest is the thing worth showing — it is what ties this screen to the entry
// in the server log.
export default function AdminErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-16">
      <section className="w-full max-w-2xl rounded-2xl border border-black/10 bg-white p-8 shadow-[0_24px_70px_rgba(16,35,29,0.08)]">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
          KRISHOE Admin
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-brand-green-ink">
          This page did not load.
        </h1>
        <p className="mt-3 text-sm leading-7 text-gray-600">
          Nothing was saved or changed. Press Try again — a dropped database
          connection clears on the next attempt.
        </p>

        <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-500">
            What failed
          </p>
          <p className="mt-2 break-words font-mono text-xs leading-5 text-gray-700">
            {error.message || "No message was reported."}
          </p>
          {error.digest ? (
            <p className="mt-3 break-all font-mono text-xs text-gray-500">
              Reference: {error.digest}
            </p>
          ) : null}
          <p className="mt-3 text-xs leading-5 text-gray-500">
            If this keeps happening, send the lines above — they say exactly
            which part failed.
          </p>
        </div>

        <div className="mt-7 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="h-12 rounded-full bg-brand-green px-6 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink"
          >
            Try again
          </button>
          <Link
            href="/admin"
            className="inline-flex h-12 items-center rounded-full border border-black/10 px-6 text-sm font-bold text-brand-green transition hover:bg-brand-mist"
          >
            Admin home
          </Link>
        </div>
      </section>
    </main>
  );
}
