import type { Metadata } from "next";
import { PageHead, PageTabs, StatStrip } from "@/components/admin/PageKit";
import T from "@/components/T";
import { readSavedMessage } from "@/lib/saved-message";
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
    <section className="p-4 sm:p-6">
      {/* Saving used to be silent: the row was written and the page came back
          looking identical, so there was no way to tell it apart from a button
          that did nothing. */}
      {saved.en || saved.ne ? (
        // A ⚠ message is a refusal (more paid than owed), not a save: it reads as one.
        <p
          role={saved.en.startsWith("⚠") ? "alert" : "status"}
          className={`mb-5 rounded-xl border px-4 py-3 text-base font-bold ${
            saved.en.startsWith("⚠") ? "border-brand-clay/40 bg-brand-clay-tint text-brand-clay" : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          {saved.en.startsWith("⚠") ? null : "✅ "}
          <T en={saved.en} ne={saved.ne} />
        </p>
      ) : null}
      <PageHead
        eyebrow={<T en="Factory" ne="कारखाना" />}
        title={<T en="Operations" ne="उत्पादन र स्टक" />}
        actions={
          <Link
            href="/admin/operations/production-accounts"
            className="inline-flex min-h-11 items-center rounded-full border border-brand-green bg-brand-paper px-4 text-sm font-black text-brand-green"
          >
            <T en="Wages & kharcha →" ne="ज्याला र खर्च →" />
          </Link>
        }
      />

      {/* The week in three figures (owner, 2026-10-12); what is owed to the
          workers behind the eye, as on the dashboard. */}
      <div className="mt-4">
        <StatStrip
          items={[
            { en: "into stock this week", ne: "यो हप्ता स्टकमा चढेको", value: weekStockPairs },
            { en: "into stock today", ne: "आज स्टकमा चढेको", value: productionControl.todayStockPairs },
            { en: "wage this week", ne: "यो हप्ताको ज्याला", value: weekEarned, money: true },
            { en: "still owed to workers", ne: "कामदारलाई तिर्न बाँकी", value: productionControl.workerBalanceDue, money: true },
          ]}
        />
      </div>
      <p className="mt-2 text-sm font-bold text-brand-muted">
        <T
          en={`Ready stock ${readyPairs} pairs${weekStages ? ` · this week: ${weekStages}` : ""}${todayStages ? ` · today: ${todayStages}` : ""} · ${productionControl.todayRejectedPairs} rejected today`}
          ne={`तयार स्टक ${readyPairs} जोडी${weekStages ? ` · यो हप्ता: ${weekStages}` : ""}${todayStages ? ` · आज: ${todayStages}` : ""} · आज ${productionControl.todayRejectedPairs} बिग्रेको`}
        />
        {thinShoes.length > 0 ? (
          <span className="text-brand-clay">
            {" · "}
            <T en={`⚠ almost no profit on ${thinShoes.join(", ")}`} ne={`⚠ ${thinShoes.join(", ")} मा नाफा झन्डै छैन`} />
          </span>
        ) : null}
      </p>

      {/* One part at a time (owner, 2026-10-12): the forms, the flow figures,
          profit per pair and the records stood one under another. */}
      <div className="mt-5">
        <PageTabs
          id="operations"
          tabs={[
            { key: "enter", en: "➕ Enter", ne: "➕ टिप्ने", content: <OperationsQuickEntry snapshot={snapshot} workerNames={workerNames} /> },
            { key: "flow", en: "📈 Flow", ne: "📈 चलखेल", content: <OperationsOverview snapshot={snapshot} costing={costing} /> },
            { key: "profit", en: "💹 Profit", ne: "💹 नाफा", content: <ProfitPerPair rows={profitRows} /> },
            { key: "records", en: "📒 Records", ne: "📒 रेकर्ड", content: <OperationsRecords snapshot={snapshot} costing={costing} /> },
          ]}
        />
      </div>
    </section>
  );
}
