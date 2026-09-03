import Link from "next/link";
import { ArrowRightIcon, PlusIcon } from "@/components/Icons";
import T from "@/components/T";

/**
 * The one number the owner opens this app to see.
 *
 * The dashboard led with today's PRODUCTION — pairs made — which is the
 * factory's question, not the shop's. What the owner actually wants on waking is
 * whether money came in yesterday and whether it is coming in today, and that
 * figure was somewhere below a wall of tiles, if it was on the page at all.
 *
 * So one number, larger than anything else on the screen, with the day's shape
 * under it in small type: how many bills, how many pairs, and how much of it is
 * still owed. A single number with no context invites the wrong conclusion — a
 * good day of credit sales is not a good day — so the credit sits beside it
 * rather than being folded in.
 *
 * Dark ground, because it is the one thing on the page that should stop the eye,
 * and because the rest of the screen is now paper. Gold is spent once, on the
 * action.
 */
export default function TodaySales({
  netSales,
  collected,
  billCount,
  pairsSold,
}: {
  netSales: number;
  collected: number;
  billCount: number;
  pairsSold: number;
}) {
  const money = (value: number) => `Rs. ${Math.round(value).toLocaleString("en-IN")}`;
  const owed = Math.max(0, Math.round(netSales - collected));

  return (
    <section className="krishoe-rise rounded-2xl bg-brand-green-ink p-6 text-white sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">
            <T en="Sold today" ne="आज बिक्री भयो" />
          </p>
          <p className="mt-2 font-display text-[2.75rem] font-black leading-none sm:text-6xl">
            {money(netSales)}
          </p>

          {billCount > 0 ? (
            <p className="mt-4 text-sm text-white/70">
              <T en={`${billCount} bill(s)`} ne={`${billCount} बिल`} />
              {pairsSold > 0 ? <T en={` · ${pairsSold} pairs`} ne={` · ${pairsSold} जोडी`} /> : ""}
              {owed > 0 ? (
                <>
                  {" · "}
                  <Link href="/admin/dues" className="font-bold text-brand-gold-bright hover:underline">
                    <T en={`${money(owed)} credit due`} ne={`${money(owed)} उधारो बाँकी`} />
                  </Link>
                </>
              ) : (
                <T en=" · all paid" ne=" · सबै तिरेको" />
              )}
            </p>
          ) : (
            /* An empty day says so plainly. A zero with no sentence beside it
               reads as a broken screen rather than as a quiet morning. */
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">
              <T
                en="No bill cut yet today. If you sold at the shop, record it from here — stock and books settle themselves."
                ne="आज अझै बिल काटिएको छैन। पसलमा बेच्नुभयो भने यहीँबाट टिप्नुहोस् — स्टक र हिसाब आफैँ मिल्छ।"
              />
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/pos"
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-gold-bright px-6 text-sm font-black text-brand-green-ink transition hover:bg-brand-paper"
          >
            <PlusIcon className="h-4 w-4" />
            <T en="Cut a bill" ne="बिल काट्ने" />
          </Link>
          <Link
            href="/admin/analytics"
            className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/25 px-5 text-sm font-bold text-white/85 transition hover:border-white/60 hover:text-white"
          >
            <T en="Accounts" ne="हिसाब" />
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
