import type { Metadata } from "next";
import T from "@/components/T";
import { readSavedMessage } from "@/lib/saved-message";
import { money } from "@/lib/format-money";
import Link from "next/link";
import OperationsOverview from "@/app/admin/operations/_components/OperationsOverview";
import OperationsQuickEntry from "@/app/admin/operations/_components/OperationsQuickEntry";
import OperationsRecords from "@/app/admin/operations/_components/OperationsRecords";
import { getCostingSnapshot } from "@/lib/costing";
import { getOperationsSnapshot } from "@/lib/operations";
import { listFactoryWorkerOptions } from "@/lib/factory-worker-portal";
import { reportError } from "@/lib/report-error";
import {
  getProductionControlSummary,
  getProductionPeriodSummary,
  getWeeklyWorkerSettlements,
} from "@/lib/production-accounting";
import ProfitPerPair, { marginTone, pairProfitRows } from "@/app/admin/operations/_components/ProfitPerPair";
import { saturdayToFridayPeriod } from "@/lib/production-accounting-rules";

export const metadata: Metadata = {
  title: "Operations | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

export default async function AdminOperationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string }>;
}) {
  // The action wrote both languages into the URL; the reader picks one.
  const saved = readSavedMessage((await searchParams)?.saved ?? "");
  // The same Saturday-to-Friday week the wages page pays by, so the two pages
  // never show the owner two different numbers for one week.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(new Date());
  const week = saturdayToFridayPeriod(today);
  // The period summary counts to the day before its end; the week includes
  // its Friday, so the end is moved one day on.
  const weekEndExclusive = new Date(`${week.end}T00:00:00Z`);
  weekEndExclusive.setUTCDate(weekEndExclusive.getUTCDate() + 1);
  const [snapshot, costing, productionControl, weeklySettlements, weekSummary] = await Promise.all([
    getOperationsSnapshot(),
    getCostingSnapshot(),
    getProductionControlSummary(),
    getWeeklyWorkerSettlements(week),
    getProductionPeriodSummary({ start: week.start, end: weekEndExclusive.toISOString().slice(0, 10) }),
  ]);
  const weekEarned = weeklySettlements.reduce((total, row) => total + row.earned, 0);
  // Made this week is what went into stock. The work entries are per stage —
  // sixty pairs through Upper and Fibermen are two entries — and adding them
  // read 420 in a week that put 180 pairs on the shelf (owner, 2026-09-29).
  const weekStockPairs = weekSummary.stockPostedPairs;
  const stageLine = (stages: Array<{ stage: string; pairs: number }>) =>
    stages.filter((entry) => entry.pairs > 0).map((entry) => `${entry.stage} ${entry.pairs}`).join(" · ");
  const weekStages = stageLine(weekSummary.stagePairs);
  const todayStages = stageLine(productionControl.todayStagePairs);

  const profitRows = pairProfitRows(costing);
  const thinShoes = profitRows.filter((row) => marginTone(row) === "bad").map((row) => row.design);
  const readyPairs = (["Factory", "Wholesale", "Retail", "Online"] as const).reduce(
    (total, channel) => total + snapshot.reports.stockByChannel[channel].stockPairs,
    0,
  );

  // The worker-task form picks a name from here instead of typing it. Loaded on
  // its own and guarded, so a hiccup leaves the field typeable rather than
  // taking the operations page down with it.
  let workerNames: string[] = [];
  try {
    const workers = await listFactoryWorkerOptions();
    workerNames = [...new Set(workers.map((worker) => worker.name))].sort((left, right) =>
      left.localeCompare(right),
    );
  } catch (error) {
    reportError("load worker names for the worker task form", error);
  }

  return (
    <section className="p-6">
      {/* Saving used to be silent: the row was written and the page came back
          looking identical, so there was no way to tell it apart from a button
          that did nothing. */}
      {saved.en || saved.ne ? (
        <p
          role="status"
          className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-base font-bold text-emerald-900"
        >
          ✅ <T en={saved.en} ne={saved.ne} />
        </p>
      ) : null}
      <div>
        <p className="text-[13px] font-black uppercase tracking-[0.2em] text-brand-gold-deep">
          <T en="Operations" ne="उत्पादन र स्टक" />
        </p>
        <h1 className="mt-2 font-display text-3xl font-black leading-tight text-brand-green-ink">
          <T en="Production and stock" ne="उत्पादन र स्टक" />
        </h1>
        {/* The day in one sentence, before any tile (owner, 2026-09-29). */}
        <p className="mt-3 max-w-4xl rounded-xl border border-brand-green-line bg-brand-green-wash px-4 py-3 text-lg font-bold leading-8 text-brand-green-ink">
          <T
            en={`Ready stock ${readyPairs} pairs · ${weekStockPairs} pairs into stock this week · ${money(productionControl.workerBalanceDue)} still owed to workers`}
            ne={`तयार स्टक ${readyPairs} जोडी · यो हप्ता ${weekStockPairs} जोडी स्टकमा चढे · कामदारलाई ${money(productionControl.workerBalanceDue)} तिर्न बाँकी`}
          />
          {thinShoes.length > 0 ? (
            <span className="text-brand-clay">
              {" · "}
              <T en={`⚠ almost no profit on ${thinShoes.join(", ")}`} ne={`⚠ ${thinShoes.join(", ")} मा नाफा झन्डै छैन`} />
            </span>
          ) : null}
        </p>
        <Link
          href="/admin/operations/production-accounts"
          className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-brand-green px-5 text-base font-black text-white transition hover:bg-brand-green-ink"
        >
          Open production wages & kharcha
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            // Was "active factory lots", a count of Work Orders; those were
            // taken out, so this shows the week that is actually being paid.
            id: "week",
            label: <T en="Into stock this week" ne="यो हप्ता स्टकमा चढेको" />,
            value: <T en={`${weekStockPairs} pairs`} ne={`${weekStockPairs} जोडी`} />,
            detail: (
              <T
                en={`${weekStages ? `Work: ${weekStages} · ` : ""}${money(weekEarned)} wage`}
                ne={`${weekStages ? `काम: ${weekStages} · ` : ""}ज्याला ${money(weekEarned)}`}
              />
            ),
          },
          {
            id: "output",
            // Every stage's entries together — one pair through two stages
            // counts twice here. What was made is the "Into stock today" card.
            label: <T en="Work today, by stage" ne="आजको काम, चरण अनुसार" />,
            value: todayStages ? todayStages : <T en="None yet" ne="अहिलेसम्म छैन" />,
            detail: <T en={`${productionControl.todayRejectedPairs} rejected`} ne={`${productionControl.todayRejectedPairs} बिग्रेको`} />,
          },
          {
            id: "stock",
            label: <T en="Into stock today" ne="आज स्टकमा चढेको" />,
            value: <T en={`${productionControl.todayStockPairs} pairs`} ne={`${productionControl.todayStockPairs} जोडी`} />,
            detail: <T en="From the factory" ne="कारखानाबाट" />,
          },
          {
            id: "wages",
            label: <T en="Worker balance due" ne="कामदारलाई तिर्न बाँकी" />,
            value: money(productionControl.workerBalanceDue),
            detail: <T en="All workers together" ne="सबै कामदारको जम्मा" />,
          },
        ].map(({ id, label, value, detail }) => (
          <div key={id} className="rounded-xl border border-brand-green-line bg-brand-paper p-4 shadow-sm">
            <p className="text-sm font-black uppercase tracking-wider text-brand-muted">{label}</p>
            <p className="mt-2 text-xl font-black text-brand-green-ink">{value}</p>
            <p className="mt-2 text-sm font-bold text-brand-muted">{detail}</p>
          </div>
        ))}
      </div>

      <ProfitPerPair rows={profitRows} />
      <OperationsOverview snapshot={snapshot} costing={costing} />
      <OperationsQuickEntry snapshot={snapshot} workerNames={workerNames} />
      <OperationsRecords snapshot={snapshot} costing={costing} />
    </section>
  );
}
