import type { Metadata } from "next";
import Link from "next/link";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import {
  approveFactoryWageSettlementAction,
  markFactoryWageSettlementPaidAction,
} from "@/app/admin/factory/actions";
import { requireAdminPermission } from "@/lib/admin-permissions";
import {
  getFactoryData,
  getFactoryPerformanceReport,
  getFactoryWageCandidates,
  type FactoryPerformanceReportRow,
} from "@/lib/factory";

export const metadata: Metadata = { title: "Factory Reports | KRISHOE Admin" };
export const dynamic = "force-dynamic";

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function reportRange(
  period: string,
  customFrom?: string,
  customTo?: string,
) {
  const now = new Date();
  const validDate = (value?: string) =>
    Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
  const to = validDate(customTo) ? customTo! : isoDate(now);
  const start = new Date(`${to}T00:00:00.000Z`);
  if (period === "weekly") start.setUTCDate(start.getUTCDate() - 6);
  if (period === "monthly") start.setUTCDate(1);
  const requestedFrom = validDate(customFrom) ? customFrom! : isoDate(start);
  const from = requestedFrom <= to ? requestedFrom : to;
  return { from, to };
}

function ReportTable({
  title,
  rows,
}: {
  title: string;
  rows: FactoryPerformanceReportRow[];
}) {
  return (
    <article className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-5">
        <h2 className="text-lg font-black text-brand-green-ink">{title}</h2>
      </div>
      <div className="overflow-x-auto p-5">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="pb-3 pr-3">Name</th>
              <th className="pb-3 pr-3">Good</th>
              <th className="pb-3 pr-3">Reject</th>
              <th className="pb-3 pr-3">Rework</th>
              <th className="pb-3 pr-3">Quality</th>
              <th className="pb-3 pr-3">Verified wage</th>
              <th className="pb-3">Entries</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-gray-100">
                <td className="py-3 pr-3 font-black text-brand-green-ink">{row.label}</td>
                <td className="py-3 pr-3">{row.goodPairs}</td>
                <td className="py-3 pr-3 text-red-700">{row.rejectPairs}</td>
                <td className="py-3 pr-3 text-amber-700">{row.reworkPairs}</td>
                <td className="py-3 pr-3 font-bold">{row.qualityRate}%</td>
                <td className="py-3 pr-3">Rs. {row.verifiedWage.toLocaleString("en-IN")}</td>
                <td className="py-3">{row.entryCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            No verified production entries in this period.
          </p>
        ) : null}
      </div>
    </article>
  );
}

export default async function FactoryReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    period?: string;
    from?: string;
    to?: string;
    wageApproved?: string;
    wagePaid?: string;
  }>;
}) {
  await requireAdminPermission("factory:write");
  const params = await searchParams;
  const period = ["daily", "weekly", "monthly", "custom"].includes(
    params?.period ?? "",
  )
    ? (params?.period ?? "daily")
    : "daily";
  const range = reportRange(period, params?.from, params?.to);
  const factory = await getFactoryData();
  const report = getFactoryPerformanceReport(factory, range.from, range.to);
  const wageCandidates = getFactoryWageCandidates(factory, range.from, range.to);
  const exportQuery = new URLSearchParams(range).toString();

  return (
    <section className="p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin/factory" className="text-sm font-black text-brand-green">
          ← Factory ERP
        </Link>
        <header className="mt-4 rounded-3xl bg-brand-green-ink p-5 text-white shadow-lg sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
            Verified production analytics
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black">Factory Reports</h1>
              <p className="mt-2 text-sm text-emerald-50/80">
                {report.from} to {report.to} · verified entries only
              </p>
            </div>
            <a
              href={`/api/admin/factory/reports/export?${exportQuery}`}
              className="inline-flex min-h-11 items-center rounded-xl bg-amber-300 px-4 text-sm font-black text-brand-green-ink"
            >
              Export CSV
            </a>
          </div>
        </header>

        {params?.wageApproved ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
            Verified piece wage approved. The linked production entries cannot be settled twice.
          </p>
        ) : null}
        {params?.wagePaid ? (
          <p className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-bold text-blue-800">
            Factory piece-wage settlement marked Paid.
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          {[
            ["daily", "Today"],
            ["weekly", "Last 7 days"],
            ["monthly", "This month"],
          ].map(([value, label]) => (
            <Link
              key={value}
              href={`/admin/factory/reports?period=${value}`}
              className={`rounded-xl px-4 py-2 text-sm font-black ${
                period === value
                  ? "bg-brand-green text-white"
                  : "border border-gray-200 bg-white text-gray-700"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        <form className="mt-3 grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:grid-cols-[1fr_1fr_auto]">
          <input type="hidden" name="period" value="custom" />
          <label className="text-xs font-bold text-gray-600">
            From
            <input
              required
              type="date"
              name="from"
              defaultValue={range.from}
              className="mt-1 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm"
            />
          </label>
          <label className="text-xs font-bold text-gray-600">
            To
            <input
              required
              type="date"
              name="to"
              defaultValue={range.to}
              className="mt-1 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm"
            />
          </label>
          <button className="min-h-11 self-end rounded-xl bg-brand-green-ink px-5 text-sm font-black text-white">
            Apply range
          </button>
        </form>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Good pairs", report.goodPairs],
            ["Reject", report.rejectPairs],
            ["Rework", report.reworkPairs],
            ["Verified wage", `Rs. ${report.verifiedWage.toLocaleString("en-IN")}`],
            ["Completed WOs", report.completedWorkOrders],
          ].map(([label, value]) => (
            <article key={label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wider text-gray-500">{label}</p>
              <p className="mt-2 text-2xl font-black text-brand-green-ink">{value}</p>
            </article>
          ))}
        </div>

        <div className="mt-6 space-y-6">
          <ReportTable title="Worker performance" rows={report.workers} />
          <article className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-amber-700">
                  Parallel to HR monthly payroll
                </p>
                <h2 className="mt-1 text-lg font-black text-amber-950">
                  Factory piece-wage settlements
                </h2>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-amber-800">
                QC verified entries only
              </span>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {wageCandidates.map((candidate) => (
                <form
                  key={candidate.workerId}
                  action={approveFactoryWageSettlementAction}
                  className="rounded-2xl border border-amber-100 bg-white p-4"
                >
                  <input type="hidden" name="workerId" value={candidate.workerId} />
                  <input type="hidden" name="fromDate" value={range.from} />
                  <input type="hidden" name="toDate" value={range.to} />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-brand-green-ink">{candidate.workerName}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {candidate.goodPairs} good pairs · {candidate.entryIds.length} entries
                      </p>
                    </div>
                    <p className="font-black text-amber-900">
                      Rs. {candidate.amount.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <input
                    name="note"
                    placeholder="Approval note (optional)"
                    className="mt-3 h-10 w-full rounded-xl border border-amber-200 px-3 text-xs"
                  />
                  <FormSubmitButton
                    pendingLabel="Approving…"
                    className="mt-2 min-h-10 w-full rounded-xl bg-amber-700 px-4 text-xs font-black text-white"
                  >
                    Approve verified piece wage
                  </FormSubmitButton>
                </form>
              ))}
              {wageCandidates.length === 0 ? (
                <p className="rounded-xl bg-white p-4 text-sm font-bold text-amber-800">
                  No unsettled verified wage in this date range.
                </p>
              ) : null}
            </div>

            <div className="mt-5 space-y-2">
              {factory.wageSettlements.slice(0, 20).map((settlement) => (
                <div
                  key={settlement.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3 text-xs"
                >
                  <div>
                    <p className="font-black text-brand-green-ink">
                      {settlement.workerName} · Rs. {settlement.amount.toLocaleString("en-IN")}
                    </p>
                    <p className="mt-1 text-gray-500">
                      {settlement.fromDate} to {settlement.toDate} · {settlement.goodPairs} pairs · {settlement.status}
                    </p>
                  </div>
                  {settlement.status === "Approved" ? (
                    <form action={markFactoryWageSettlementPaidAction}>
                      <input type="hidden" name="settlementId" value={settlement.id} />
                      <FormSubmitButton
                        pendingLabel="Marking…"
                        className="min-h-10 rounded-xl bg-brand-green px-4 font-black text-white"
                      >
                        Mark Paid
                      </FormSubmitButton>
                    </form>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 font-black text-emerald-800">
                      Paid {settlement.paidAt ? new Date(settlement.paidAt).toLocaleDateString("en-NP") : ""}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </article>
          <div className="grid gap-6 xl:grid-cols-2">
            <ReportTable title="Stage performance" rows={report.stages} />
            <ReportTable title="Item performance" rows={report.items} />
          </div>
        </div>
      </div>
    </section>
  );
}
