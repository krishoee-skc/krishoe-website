"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { PageHead, PageTabs, StatStrip } from "@/components/admin/PageKit";
import ShareBar from "@/components/admin/ShareBar";
import { ENOUGH, judge } from "@/lib/enough-to-judge";
import NowClock from "@/components/admin/NowClock";
import type {
  FactoryDayStats,
  FactoryProductTotal,
  FactoryStageTotal,
  FactoryWorkerTotal,
} from "@/lib/factory-board";
import type { FactoryOwed } from "@/lib/factory-board-data";
// The shop-wide rupee: "Rs. 420", with paisa only when there are some. This
// board alone printed "Rs. 420.00", which broke onto two lines on a phone.
import { money } from "@/lib/format-money";


/**
 * The factory board, drawn from numbers the server already worked out.
 *
 * This is a client component only because the board is bilingual and the
 * language is a browser choice. Nothing here fetches or counts: the page hands
 * it a finished day, so the workshop's phone renders the real figures on first
 * paint instead of a spinner followed by them.
 */
export default function FactoryBoard({
  stats,
  stockPairs,
  topWorkers,
  products,
  stages,
  owed,
  inbox = { photos: 0, requests: 0 },
}: {
  stats: FactoryDayStats;
  /** Pairs posted to stock today — what was made. */
  stockPairs: number;
  topWorkers: FactoryWorkerTotal[];
  products: FactoryProductTotal[];
  stages: FactoryStageTotal[];
  owed: FactoryOwed;
  /** Workers' photos and questions still to check (owner, 2026-10-03). */
  inbox?: { photos: number; requests: number };
}) {
  const { text } = useLanguage();
  // Every entry made today, whatever its state — the denominator the success
  // rate is a percentage of.
  const entriesToday =
    stats.completedEntries + stats.inProgressEntries + stats.reworkEntries;
  // Today's work stage by stage, for the line under "made". Never summed: the
  // same pairs pass every stage (owner, 2026-09-29).
  // How much of today's work is complete, judged only once enough stands
  // behind it — one entry in progress is not a failed day.
  const completedTone =
    judge(entriesToday, () => (stats.successRate >= 90 ? "good" : stats.successRate >= 70 ? "warn" : "danger")).verdict ?? "default";
  const workToday = stages
    .filter((row) => row.pairs > 0)
    .map((row) => `${row.stage === "Other work" ? text("Other work", "अरू काम") : row.stage} ${row.pairs}`)
    .join(" · ");

  return (
    <div className="flex min-h-dvh flex-col space-y-3 p-3 sm:p-5 lg:p-6">
      <div className="mb-1">
        <PageHead eyebrow={text("Factory · today", "कारखाना · आज")} title={text("Factory today", "कारखाना आज")} />
        {/* The clock, not only the date. Work is entered here against a
            particular hour, and the day is closed here — so the time the shop
            records by should be on the same screen as the wall clock it is
            read against. */}
        <NowClock className="text-xs text-brand-muted sm:text-sm" />
      </div>

      {/* The day's main job, first (owner, 2026-10-12): it sat under eight
          cards at the foot of the board. */}
      <Link
        href="/admin/factory/add-work"
        className="flex min-h-14 items-center justify-center rounded-2xl bg-brand-green px-4 text-lg font-black text-white shadow-[0_8px_20px_rgba(11,77,59,0.18)] transition hover:bg-brand-green-ink"
      >
        ＋ {text("Add work", "काम टिप्ने")}
      </Link>

      {/* Today in three figures; the wage behind the eye, as on the dashboard. */}
      <StatStrip
        items={[
          // Pairs into stock — what was made. "Total pairs" once added every
          // stage, so sixty pairs through Upper and Fibermen read 120.
          { en: "pairs into stock", ne: "स्टकमा चढेको जोडी", value: stockPairs },
          { en: "workers today", ne: "आज काम गर्ने", value: stats.workersActive },
          { en: "wage earned today", ne: "आज कमाएको ज्याला", value: stats.totalAmount, money: true },
        ]}
      />
      {workToday ? (
        <p className="-mt-1 text-xs font-bold text-brand-muted">
          {text("Work", "काम")}: {workToday}
        </p>
      ) : null}

      {/* What workers sent, waiting to be checked — loud while it waits,
          a quiet green line once all is checked. */}
      <Link
        href="/admin/factory/photos"
        className={`flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-2.5 transition ${
          inbox.photos + inbox.requests > 0
            ? "border-brand-clay/40 bg-red-50 text-brand-green-ink hover:border-brand-clay dark:bg-red-950/30"
            : "border-brand-green-line bg-brand-paper text-brand-muted hover:border-brand-green"
        }`}
      >
        <span className={`text-3xl font-black tabular-nums ${inbox.photos + inbox.requests > 0 ? "text-brand-clay" : "text-brand-green"}`}>
          {inbox.photos + inbox.requests}
        </span>
        <span className="grid leading-tight">
          <span className="text-base font-black">
            {inbox.photos + inbox.requests > 0 ? text("Workers' photos to check", "जाँच्न बाँकी कामदारको फोटो") : text("Workers' photos — all checked ✓", "कामदारको फोटो — सबै जाँचियो ✓")}
          </span>
          {inbox.photos + inbox.requests > 0 ? (
            <span className="text-sm text-brand-muted">
              {text(`${inbox.photos} photo(s) · ${inbox.requests} to answer`, `${inbox.photos} फोटो · ${inbox.requests} कुरा`)}
            </span>
          ) : null}
        </span>
        <span aria-hidden="true" className="ml-auto text-lg">→</span>
      </Link>

      {/* Where the pairs have reached.
          A shoe passes four stages, and the number that matters is how many
          have come out of the last one — that is what can actually be sold.
          Every stage is drawn even at zero, because "420 at Upper, nothing
          after it" is the finding, and a chart of only the filled stage would
          have hidden it. */}
      <div className="rounded-2xl border border-brand-green-line bg-brand-paper p-3 shadow-[0_10px_30px_rgba(16,35,29,0.05)] sm:p-4">
        <h2 className="mb-1 text-sm font-bold text-brand-green-ink sm:text-base">
          {text("Where the pairs are", "जोडी कहाँ पुग्यो")}
        </h2>
        <p className="mb-3 text-xs text-brand-muted">
          {text("A shoe is finished only after the last stage.", "अन्तिम चरण सकिएपछि मात्र जुत्ता तयार हुन्छ।")}
        </p>
        <ShareBar
          layout="stack"
          rows={stages.map((row) => ({ label: row.stage === "Other work" ? text("Other work", "अरू काम") : row.stage, value: row.pairs }))}
          emptyLabel={text("No work entered yet", "अहिलेसम्म काम चढेको छैन")}
        />
      </div>

      {/* Rejects today, with how much of today's work is complete — the
          "Success rate" tile said the same in a word the owner did not use
          (owner, 2026-10-12). The figure always shows; its colour waits
          until enough entries stand behind it (lib/enough-to-judge). */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-red-50 px-4 py-2.5 text-sm font-black text-red-800 dark:bg-red-950/30 dark:text-red-200">
        <span>✖ {text("Rejects today", "आजको reject")}</span>
        <span className="tabular-nums">
          {text(`${stats.totalReject} pairs · ${stats.rejectRate}%`, `${stats.totalReject} जोडी · ${stats.rejectRate}%`)}
        </span>
        <span
          className={`ml-auto text-xs font-bold ${
            completedTone === "danger" ? "text-brand-clay" : completedTone === "good" ? "text-brand-green" : "text-brand-muted"
          }`}
        >
          {text("Completed", "पूरा भएको")} <span className="tabular-nums">{`${stats.successRate}%`}</span>
          {entriesToday < ENOUGH ? ` · ${text(`${entriesToday} entries so far`, `अहिलेसम्म ${entriesToday} entry`)}` : ""}
        </span>
      </div>

      {/* Who did what, which shoes, and what is owed — one place, three tabs
          (owner, 2026-10-12): they stood as three cards one under another. */}
      <PageTabs
        id="factory-today"
        tabs={[
          {
            key: "workers",
            en: "Workers",
            ne: "कामदार",
            content: (
              <div className="flex flex-col rounded-2xl border border-brand-green-line bg-brand-paper p-3 shadow-[0_10px_30px_rgba(16,35,29,0.05)] sm:p-4">
                <h2 className="mb-2 text-sm font-bold text-brand-green-ink sm:text-base">
                  {text("Top workers", "अगाडि रहेका")}
                </h2>
                {/* Bars rather than a list, so who did the most is seen before it is
                    read. The wage rides the right-hand end, since that is the figure
                    the counter is actually looking for. */}
                <div className="overflow-y-auto">
                  <ShareBar
                    rows={topWorkers.map((worker) => ({
                      label: worker.name,
                      value: worker.pairs,
                      hint: money(worker.amount),
                    }))}
                    emptyLabel={text("No entries yet", "अहिलेसम्म केही छैन")}
                  />
                </div>
              </div>
            ),
          },
          {
            key: "products",
            en: "Products",
            ne: "सामान",
            content: (
              <div className="flex flex-col rounded-2xl border border-brand-green-line bg-brand-paper p-3 shadow-[0_10px_30px_rgba(16,35,29,0.05)] sm:p-4">
                <h2 className="mb-2 text-sm font-bold text-brand-green-ink sm:text-base">
                  {text("Products today", "आजका सामान")}
                </h2>
                {/* A list of numbers made every shoe look alike; as bars the biggest
                    is obvious without reading. Longest first, name and count on every
                    row, so it is never colour alone. */}
                <div className="overflow-y-auto">
                  <ShareBar
                    rows={products.map((product) => ({
                      label: product.name,
                      value: product.pairs,
                      // Each stage's count, side by side — the same pairs pass them all.
                      hint: product.stages
                        .map((row) => `${row.stage === "Other work" ? text("Other work", "अरू काम") : row.stage} ${row.pairs.toLocaleString("en-IN")}`)
                        .join(" · "),
                    }))}
                    emptyLabel={text("No entries yet", "अहिलेसम्म केही छैन")}
                  />
                </div>
              </div>
            ),
          },
          {
            key: "owed",
            en: "Owed",
            ne: "तिर्न बाँकी",
            // Owed to the team — the "how much is still to pay" glance the
            // counter asked for, so wages are never paid twice or missed.
            content: (
            <Link
              href="/admin/factory/salary"
              className="hover-lift flex items-center justify-between rounded-2xl border border-brand-gold/40 bg-brand-gold/10 p-3 shadow-[0_10px_30px_rgba(16,35,29,0.05)] transition hover:border-brand-gold sm:p-4"
            >
              <div>
                <div className="text-xs font-medium text-brand-muted">
                  {text("Owed to workers", "कामदारलाई तिर्न बाँकी")}
                </div>
                <div className="mt-1 text-xl font-black text-brand-green-ink sm:text-2xl">
                  {money(owed.totalOwed)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-black text-brand-green-ink">{owed.workersOwed}</div>
                <div className="text-xs font-semibold text-brand-gold-deep">
                  {text("workers to pay →", "जनालाई तिर्न →")}
                </div>
              </div>
            </Link>
            ),
          },
        ]}
      />

      <Link href="/admin/factory/reports" className="w-fit text-sm font-black text-brand-green underline underline-offset-4">
        {text("View reports →", "रिपोर्ट हेर्ने →")}
      </Link>
    </div>
  );
}
