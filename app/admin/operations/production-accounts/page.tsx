import type { Metadata } from "next";
import { money } from "@/lib/format-money";
import Link from "next/link";
import ExportButton from "@/components/admin/ExportButton";
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

  return (
    <section className="mx-auto max-w-7xl space-y-5 p-4 pb-28 sm:p-6">
      <header className="flex flex-col gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green">Factory accounts</p>
          <h1 className="mt-1 text-2xl font-black text-brand-green-ink">Wages &amp; kharcha</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-muted">
            This week&rsquo;s work and what it comes to. Wages run Saturday to Friday, so the week is
            the figure that decides Saturday&rsquo;s payment.
          </p>
        </div>
        <WagesNav />
      </header>

      {/* The week leads, because the week is what gets paid. Today sits under
          it in one line: on most mornings nobody has posted work yet, and four
          zeroes at the top of the page said nothing was happening in a month
          that held 240 pairs. */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={`${card} sm:col-span-2`}>
          <p className="text-xs font-bold uppercase tracking-wider text-brand-muted">
            This week&rsquo;s wage · {weeklyPeriod.start} to {weeklyPeriod.end}
          </p>
          <p className="mt-2 text-4xl font-black text-brand-green-ink">{money(weekEarned)}</p>
          <p className="mt-1 text-sm text-brand-muted">
            {weekPairs} pairs · {workedThisWeek} worker(s) · today {control.todayGoodPairs} pairs
          </p>
        </div>
        <div className={card}>
          <p className="text-xs font-bold uppercase tracking-wider text-brand-muted">Due on Saturday</p>
          <p className="mt-2 text-3xl font-black text-brand-green-ink">{money(weekPayable)}</p>
          <Link
            href="/admin/operations/production-accounts/payments"
            className="mt-3 inline-flex min-h-10 items-center rounded-full border border-brand-green px-4 text-xs font-black text-brand-green"
          >
            Open payments →
          </Link>
        </div>
      </div>

      <Link
        href="/admin/factory/add-work"
        className="flex min-h-14 items-center justify-center rounded-2xl bg-brand-green px-5 text-sm font-black text-white transition hover:bg-brand-green-ink"
      >
        Enter today&rsquo;s work →
      </Link>

      {(control.overdueWorkOrders > 0 || control.handoverMismatches > 0) ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {control.overdueWorkOrders > 0 ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-900">
              {control.overdueWorkOrders} Work Order overdue—review due dates and current stage.
            </div>
          ) : null}
          {control.handoverMismatches > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
              {control.handoverMismatches} handover records have Short/Excess quantity.
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${
        acceptance.integrityIssues === 0
          ? "border-emerald-200 bg-emerald-50"
          : "border-red-200 bg-red-50"
      }`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-green">Production chain audit</p>
            <h2 className="mt-1 text-lg font-black text-brand-green-ink">
              {acceptance.integrityIssues === 0 ? "Core data integrity passed" : `${acceptance.integrityIssues} integrity issue(s)`}
            </h2>
            <p className="mt-1 text-sm text-brand-muted">
              Read-only check; it never creates, changes or deletes factory transactions.
            </p>
          </div>
          <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${
            acceptance.integrityIssues === 0 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
          }`}>
            {acceptance.integrityIssues === 0 ? "SAFE" : "REVIEW"}
          </span>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Worker links", acceptance.orphanWorkEntries],
            ["Completed without QC", acceptance.completedWithoutQc],
            ["QC-stock links", acceptance.qcWithoutStockMovement],
            ["Active order links", acceptance.activeOrderItemMismatch],
            ["Duplicate submissions", acceptance.duplicateSubmissionKeys],
            ["Workers whose two ledgers disagree", acceptance.ledgerMismatchWorkers],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-brand-paper p-3 text-sm">
              <p className="text-xs font-bold text-brand-muted">{label}</p>
              <p className={`mt-1 text-xl font-black ${Number(value) === 0 ? "text-emerald-700" : "text-red-700"}`}>{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-brand-paper px-3 py-1">Items needing 4 wage rates: {acceptance.itemsMissingRates}</span>
          <span className="rounded-full bg-brand-paper px-3 py-1">Items needing BOM: {acceptance.itemsMissingBom}</span>
          <span className="rounded-full bg-brand-paper px-3 py-1">Items needing stock link: {acceptance.itemsMissingCatalog}</span>
        </div>
      </div>

      <div className={card}>
        <h2 className="text-lg font-black text-brand-green-ink">Recent approved work</h2>
        <div className="mt-4 space-y-3">
          {data.workEntries.map((row) => (
            <article key={row.id} className="grid gap-2 rounded-xl border border-brand-green-line p-3 text-sm sm:grid-cols-[1fr_auto]">
              <div>
                <p className="font-black text-brand-green-ink">{row.employeeName} · {row.itemName}</p>
                <p className="mt-1 text-brand-muted">{row.workDate} · {row.stage} · {row.totalPairs} pairs · Reject {row.rejectedPairs}</p>
              </div>
              <p className="font-black text-brand-green">{money(row.earnedWage)}</p>
            </article>
          ))}
          {data.workEntries.length === 0 ? <p className="text-sm text-brand-muted">No completed work entered yet.</p> : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <ExportButton href="/api/admin/operations/production-export?type=work-entries" className="min-h-10 rounded-full border border-brand-green-line bg-brand-paper px-4 text-xs font-black text-brand-green-ink">Work &amp; wage CSV</ExportButton>
        <ExportButton href="/api/admin/operations/production-export?type=worker-payments" className="min-h-10 rounded-full border border-brand-green-line bg-brand-paper px-4 text-xs font-black text-brand-green-ink">Kharcha CSV</ExportButton>
      </div>
    </section>
  );
}
