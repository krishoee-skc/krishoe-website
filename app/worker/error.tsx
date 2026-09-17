"use client";

import Link from "next/link";

/**
 * When the worker portal breaks, it must not talk to the worker like a shopper.
 *
 * Without this file these five screens fell through to app/error.tsx, which is
 * written for a customer: it reassures that "your cart and browsing session are
 * kept safe" and offers the shop collection. A worker checking a payslip on a
 * factory phone has no cart, is not browsing, and does not want the shop. They
 * want their wages, and if that screen failed they need to know who to ask.
 *
 * So this says the three things that are actually useful to them: that their
 * work and wages are recorded and nothing was lost, that they should try again,
 * and — if it keeps failing — that the owner or HR is who can look into it,
 * which is the same instruction the dashboard already gives about a wage that
 * looks wrong.
 *
 * Nepali only, like the rest of the portal: the workers never touch the
 * English/Nepali switch, so the five screens carry Nepali directly and this
 * matches them rather than importing the customer pages' bilingual helper.
 */
export default function WorkerErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-16">
      <section className="w-full max-w-xl rounded-lg border border-brand-green-line bg-brand-paper p-7 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-gold-deep">
          KRISHOE
        </p>

        <h1 className="mt-3 text-3xl font-black tracking-tight text-brand-green-ink">
          केही अड्कियो
        </h1>

        {/* The first thing a worker will wonder is whether the day's work — or
            the wage on it — has gone. It has not: this screen is a failure to
            show, never a failure to record. */}
        <p className="mt-4 text-sm leading-7 text-brand-muted">
          तपाईंको काम र ज्याला सुरक्षित छ — केही हराएको छैन। यो पर्दा देखाउन
          मात्र अड्किएको हो। फेरि प्रयास गर्नुहोस्।
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="h-12 rounded-full bg-brand-green px-6 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink"
          >
            फेरि प्रयास
          </button>
          <Link
            href="/worker/dashboard"
            className="inline-flex h-12 items-center rounded-full border border-brand-green px-6 text-sm font-bold text-brand-green transition hover:bg-brand-mist"
          >
            मेरो पाना
          </Link>
        </div>

        {/* The same route the dashboard gives for a wage that looks wrong, so
            the worker is not sent somewhere new on the day something breaks. */}
        <p className="mt-6 border-t border-brand-green-line pt-5 text-xs leading-6 text-brand-muted-soft">
          फेरि पनि अड्कियो भने मालिक वा HR लाई भन्नुहोस्।
          {error.digest ? (
            <>
              {" "}
              तल देखिने नम्बर पनि सुनाउनुहोस् —{" "}
              <span className="font-bold text-brand-green-ink">{error.digest}</span>
            </>
          ) : null}
        </p>
      </section>
    </main>
  );
}
