import type { Metadata } from "next";
import { money } from "@/lib/format-money";
import Link from "next/link";
import T from "@/components/T";
import ExportButton from "@/components/admin/ExportButton";
import { PageHead, StatStrip } from "@/components/admin/PageKit";
import {
  getProductionAccountingSnapshot,
  getProductionAcceptanceAudit,
  getProductionControlSummary,
  getWeeklyWorkerSettlements,
} from "@/lib/production-accounting";
import { saturdayToFridayPeriod } from "@/lib/production-accounting-rules";
import WagesNav from "./_components/wages-nav";

export const metadata: Metadata = { title: "Wages & kharcha | KRISHOE Admin" };
export const dynamic = "force-dynamic";

const card = "rounded-2xl border border-brand-green-line bg-brand-paper p-4 shadow-sm sm:p-5";

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(new Date());
}

/**
 * The week's wages (owner, 2026-10-12: the page was English only, every word,
 * and opened with a developer's "Production chain audit"). Now in both
 * languages: what is due on Saturday first, the button that pays it, the
 * week's work, and the books check folded into one line that opens when
 * something needs a look.
 */
export default async function WagesWeekPage() {
  const date = today();
  const weeklyPeriod = saturdayToFridayPeriod(date);
  const [data, control, weeklySettlements, acceptance] = await Promise.all([
    getProductionAccountingSnapshot(),
    getProductionControlSummary(),
    getWeeklyWorkerSettlements(weeklyPeriod),
    getProductionAcceptanceAudit(),
  ]);

  // Saturday to Friday, which is how this shop pays. The settlement rows
  // already carry the week's pairs and wage per worker, so the totals come from
  // what the payment centre will show rather than from a second query that
  // could drift from it.
  const weekPairs = weeklySettlements.reduce((total, row) => total + row.completedPairs, 0);
  const weekEarned = weeklySettlements.reduce((total, row) => total + row.earned, 0);
  const weekPayable = weeklySettlements.reduce((total, row) => total + row.payable, 0);
  const workedThisWeek = weeklySettlements.filter((row) => row.completedPairs > 0).length;
  const itemsToFinish = acceptance.itemsMissingRates + acceptance.itemsMissingBom + acceptance.itemsMissingCatalog;

  const checks: Array<{ en: string; ne: string; value: number }> = [
    { en: "Work with no worker", ne: "कामदार नजोडिएको काम", value: acceptance.orphanWorkEntries },
    { en: "Packing not in stock", ne: "Packing भयो, स्टकमा चढेन", value: acceptance.qcWithoutStockMovement },
    { en: "Sent twice", ne: "दुई पटक पठाइएको", value: acceptance.duplicateSubmissionKeys },
    { en: "Workers whose two ledgers disagree", ne: "दुई खाता नमिलेका कामदार", value: acceptance.ledgerMismatchWorkers },
  ];

  return (
    <section className="mx-auto max-w-7xl space-y-5 p-4 pb-28 sm:p-6">
      <header className="flex flex-col gap-3">
        <PageHead eyebrow={<T en="Factory accounts" ne="कारखानाको हिसाब" />} title={<T en="Wages & kharcha" ne="ज्याला र खर्च" />} />
        <WagesNav />
      </header>

      {/* What is due on Saturday leads, because that is what gets paid. */}
      <StatStrip
        items={[
          { en: "due on Saturday", ne: "शनिबार तिर्ने", value: weekPayable, money: true },
          { en: "workers this week", ne: "यो हप्ता काम गरेका", value: workedThisWeek },
          {
            en: "to put right",
            ne: "मिलाउनुपर्ने",
            value: acceptance.integrityIssues,
            tone: acceptance.integrityIssues > 0 ? "warn" : "good",
          },
        ]}
      />

      <div className="grid gap-2 sm:grid-cols-2">
        <Link
          href="/admin/operations/production-accounts/payments"
          className="flex min-h-14 items-center justify-center rounded-2xl bg-brand-green px-5 text-base font-black text-white transition hover:bg-brand-green-ink"
        >
          💵 <T en="Pay wages →" ne="ज्याला तिर्ने →" />
        </Link>
        <Link
          href="/admin/factory/add-work"
          className="flex min-h-14 items-center justify-center rounded-2xl border border-brand-green bg-brand-paper px-5 text-base font-black text-brand-green transition hover:bg-brand-green-wash"
        >
          ＋ <T en="Enter today's work" ne="आजको काम टिप्ने" />
        </Link>
      </div>

      {/* The week, which decides Saturday's payment. Today sits under it in
          one line: on most mornings nobody has posted work yet. */}
      <div className={card}>
        <p className="text-xs font-bold uppercase tracking-wider text-brand-muted">
          <T
            en={`This week's wage · ${weeklyPeriod.start} to ${weeklyPeriod.end}`}
            ne={`यो हप्ताको ज्याला · ${weeklyPeriod.start} देखि ${weeklyPeriod.end}`}
          />
        </p>
        <p className="mt-2 text-3xl font-black text-brand-green-ink">{money(weekEarned)}</p>
        <p className="mt-1 text-sm text-brand-muted">
          <T
            en={`${weekPairs} pairs · ${workedThisWeek} worker(s) · today ${control.todayGoodPairs} pairs`}
            ne={`${weekPairs} जोडी · ${workedThisWeek} कामदार · आज ${control.todayGoodPairs} जोडी`}
          />
        </p>
      </div>

      {/* The books check, in one line (owner, 2026-10-12): it read
          "Production chain audit" with SAFE / REVIEW. Read-only — it never
          creates, changes or deletes a factory transaction. */}
      <details
        className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${
          acceptance.integrityIssues === 0 ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30" : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
        }`}
        open={acceptance.integrityIssues > 0}
      >
        <summary className="cursor-pointer text-base font-black text-brand-green-ink">
          ⚙️{" "}
          {acceptance.integrityIssues === 0 ? (
            <T en="Books check: all right ✓" ne="हिसाबको जाँच: सबै ठीक ✓" />
          ) : (
            <T
              en={`Books check: ${acceptance.integrityIssues} thing(s) to put right`}
              ne={`हिसाबको जाँच: ${acceptance.integrityIssues} कुरा मिलाउनुपर्ने`}
            />
          )}
          {itemsToFinish > 0 ? (
            <span className="ml-2 text-sm font-bold text-brand-gold-ink">
              <T en={`· ${itemsToFinish} item setting(s) missing`} ne={`· ${itemsToFinish} सामानको सेटिङ बाँकी`} />
            </span>
          ) : null}
        </summary>
        <p className="mt-2 text-sm text-brand-muted">
          <T
            en="A check only: it never creates, changes or deletes anything."
            ne="जाँच मात्र: यसले केही बनाउँदैन, बदल्दैन, मेट्दैन।"
          />
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {checks.map((check) => (
            <div key={check.en} className="rounded-xl bg-brand-paper p-3 text-sm">
              <p className="text-xs font-bold text-brand-muted">
                <T en={check.en} ne={check.ne} />
              </p>
              <p className={`mt-1 text-xl font-black ${check.value === 0 ? "text-emerald-700" : "text-red-700"}`}>{check.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-brand-paper px-3 py-1">
            <T en={`Items needing 4 wage rates: ${acceptance.itemsMissingRates}`} ne={`४ ज्याला दर बाँकी सामान: ${acceptance.itemsMissingRates}`} />
          </span>
          <span className="rounded-full bg-brand-paper px-3 py-1">
            <T en={`Items needing materials (BOM): ${acceptance.itemsMissingBom}`} ne={`कच्चा माल (BOM) बाँकी सामान: ${acceptance.itemsMissingBom}`} />
          </span>
          <span className="rounded-full bg-brand-paper px-3 py-1">
            <T en={`Items needing a stock link: ${acceptance.itemsMissingCatalog}`} ne={`स्टकसँग नजोडिएका सामान: ${acceptance.itemsMissingCatalog}`} />
          </span>
        </div>
      </details>

      <div className={card}>
        <h2 className="text-lg font-black text-brand-green-ink">
          <T en="Recent approved work" ne="हालै स्वीकृत काम" />
        </h2>
        <div className="mt-4 space-y-3">
          {data.workEntries.map((row) => (
            <article key={row.id} className="grid gap-2 rounded-xl border border-brand-green-line p-3 text-sm sm:grid-cols-[1fr_auto]">
              <div>
                <p className="font-black text-brand-green-ink">
                  {row.employeeName} · {row.itemName}
                </p>
                <p className="mt-1 text-brand-muted">
                  <T
                    en={`${row.workDate} · ${row.stage} · ${row.totalPairs} pairs · Reject ${row.rejectedPairs}`}
                    ne={`${row.workDate} · ${row.stage} · ${row.totalPairs} जोडी · बिग्रेको ${row.rejectedPairs}`}
                  />
                </p>
              </div>
              <p className="font-black text-brand-green">{money(row.earnedWage)}</p>
            </article>
          ))}
          {data.workEntries.length === 0 ? (
            <p className="text-sm text-brand-muted">
              <T en="No completed work entered yet." ne="अहिलेसम्म पूरा भएको काम चढेको छैन।" />
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <ExportButton href="/api/admin/operations/production-export?type=work-entries" className="min-h-10 rounded-full border border-brand-green-line bg-brand-paper px-4 text-xs font-black text-brand-green-ink">
          ⬇ <T en="Work & wage CSV" ne="काम र ज्याला CSV" />
        </ExportButton>
        <ExportButton href="/api/admin/operations/production-export?type=worker-payments" className="min-h-10 rounded-full border border-brand-green-line bg-brand-paper px-4 text-xs font-black text-brand-green-ink">
          ⬇ <T en="Kharcha CSV" ne="खर्च CSV" />
        </ExportButton>
      </div>
    </section>
  );
}
