import Link from "next/link";
import type { Metadata } from "next";
import LoadFailure from "@/components/admin/LoadFailure";
import { ArrowRightIcon } from "@/components/Icons";
import { buildInsight, getReportIndex, type ReportCard } from "@/lib/reports";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";

export const metadata: Metadata = { title: "हिसाब · Report | KRISHOE Admin" };

export const dynamic = "force-dynamic";

/**
 * Every way this shop can look at itself, on one screen.
 *
 * Eleven analysis screens had been built and six were hard to reach: four were
 * in no menu at all, and two — monitoring and the activity log — lived only
 * inside Settings, where a shopkeeper looks once and never again. A report
 * nobody can find is a report nobody reads.
 *
 * The page is honest about which ones are empty. A card with nothing in it does
 * not say "No data" — that tells the reader their app is broken. It says what
 * would fill it and offers the button that starts, so an empty screen becomes
 * the next thing to do rather than a dead end.
 */
function money(value: number) {
  return `रु. ${Math.round(value).toLocaleString("en-IN")}`;
}

function Card({ card }: { card: ReportCard }) {
  const shown = card.id === "dues" ? money(card.value) : card.value.toLocaleString("en-IN");

  if (!card.ready) {
    return (
      <div className="flex flex-col rounded-2xl border border-dashed border-brand-gold bg-brand-mist p-5">
        <p className="text-sm font-black text-brand-muted-deep">{card.titleNe}</p>
        <p className="mt-2 flex-grow text-[13px] leading-6 text-brand-muted">{card.emptyNe}</p>
        <Link
          href={card.actionHref}
          className="mt-4 inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-brand-green px-4 text-[13px] font-black text-white transition hover:bg-brand-green-ink"
        >
          {card.actionNe}
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <Link
      href={card.href}
      className="group flex flex-col rounded-2xl border border-brand-green-line bg-brand-paper p-5 transition hover:border-brand-gold"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-black text-brand-green-ink">{card.titleNe}</p>
        <ArrowRightIcon className="h-4 w-4 shrink-0 text-brand-muted-soft transition group-hover:text-brand-gold-deep" />
      </div>
      <p className="mt-3 font-display text-3xl font-black leading-none text-brand-green-ink">
        {shown}
        {card.id === "dues" ? null : (
          <span className="ml-1.5 text-sm font-bold text-brand-muted">{card.unitNe}</span>
        )}
      </p>
      <p className="mt-2 text-[13px] leading-5 text-brand-muted">{card.detailNe}</p>
    </Link>
  );
}

export default async function ReportsPage() {
  let index;
  try {
    index = await getReportIndex();
  } catch (error) {
    reportError("load the report index", error);
    return (
      <LoadFailure
        what="हिसाब"
        message={saveFailureMessage(error, "हिसाब लोड गर्न सकिएन।")}
        retryHref="/admin/reports"
      />
    );
  }

  const { cards, counts } = index;
  const insight = buildInsight(counts);
  const ready = cards.filter((card) => card.ready);
  const waiting = cards.filter((card) => !card.ready);

  return (
    <section className="p-4 sm:p-6">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-gold-deep">
        हिसाब · Report
      </p>
      <h1 className="mt-2 font-display text-3xl font-black leading-tight text-brand-green-ink">
        पसलले के भन्दैछ
      </h1>
      <p className="mt-2 text-sm text-brand-muted">
        {cards.length} वटा हिसाब, एउटै ठाउँमा। भरिएको कुन, खाली कुन — छर्लङ्ग।
      </p>

      {/* What the app worked out by joining two things the owner would
          otherwise have to notice separately. Purple is used here and nowhere
          else in the admin, so the colour itself says "we noticed this for
          you" rather than "you must do this", which is what gold means. */}
      {insight ? (
        <div className="mt-6 rounded-2xl border border-[#5B3A6E] bg-[#F2ECF6] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <SparkIcon />
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5B3A6E]">
                app ले भेटेको
              </p>
              <p className="mt-2 text-lg font-black leading-snug text-[#3F2750]">
                {insight.titleNe}
              </p>
              <p className="mt-2 text-sm leading-6 text-brand-green-ink">{insight.detailNe}</p>
              <Link
                href={insight.href}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#5B3A6E] px-5 text-sm font-black text-white transition hover:bg-[#3F2750]"
              >
                {insight.actionNe}
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <p className="mt-8 text-xs font-black uppercase tracking-[0.14em] text-brand-muted">
        अहिले पढ्न मिल्ने
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ready.map((card) => (
          <Card key={card.id} card={card} />
        ))}
      </div>

      {waiting.length > 0 ? (
        <>
          <p className="mt-8 text-xs font-black uppercase tracking-[0.14em] text-brand-muted">
            डाटा पर्खिरहेका — के चाहिन्छ भनेर भन्छन्
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {waiting.map((card) => (
              <Card key={card.id} card={card} />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

/** Marks the one thing on this page the app worked out rather than counted. */
function SparkIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="#5B3A6E"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 h-5 w-5 shrink-0"
    >
      <path d="M12 3v3M5.6 5.6l2.1 2.1M3 12h3M5.6 18.4l2.1-2.1M12 18v3M18.4 18.4l-2.1-2.1M21 12h-3M18.4 5.6l-2.1 2.1" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  );
}
