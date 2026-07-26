import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ExportButton from "@/components/admin/ExportButton";
import { getWorkerProductionAccount } from "@/lib/production-accounting";
import { saturdayToFridayPeriod } from "@/lib/production-accounting-rules";

export const metadata: Metadata = { title: "Worker Ledger | KRISHOE Admin" };
export const dynamic = "force-dynamic";

function nepalToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(new Date());
}

function money(value: number) {
  return `Rs. ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function tone(value: number) {
  return value < 0 ? "text-brand-clay" : "text-brand-green";
}

export default async function WorkerProductionLedgerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(query.date ?? "") ? query.date! : nepalToday();
  const period = saturdayToFridayPeriod(selectedDate);
  const account = await getWorkerProductionAccount(id, period);
  if (!account) notFound();

  return (
    <section className="mx-auto max-w-6xl space-y-5 p-4 pb-28 sm:p-6">
      <header>
        <Link href="/admin/operations/production-accounts" className="text-sm font-bold text-brand-green underline underline-offset-4">
          ← Production accounts
        </Link>
        <h1 className="mt-3 text-2xl font-black text-brand-green-ink">{account.employee.name}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {account.employee.id} · {account.employee.department} · {account.employee.salaryType}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Total earned", money(account.lifetime.earned), "text-brand-green"],
          ["Cash / adjustments", money(account.lifetime.paid), "text-brand-green-ink"],
          ["Current balance", money(account.lifetime.balance), tone(account.lifetime.balance)],
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{label}</p>
            <p className={`mt-2 text-xl font-black ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-green">Friday hisab</p>
            <h2 className="mt-1 text-lg font-black text-brand-green-ink">
              {period.start} to {period.end}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <form className="flex gap-2">
              <input
                name="date"
                type="date"
                defaultValue={selectedDate}
                className="min-h-12 rounded-xl border border-gray-200 px-3 text-sm"
              />
              <button className="min-h-12 rounded-xl border border-brand-green px-4 text-sm font-black text-brand-green">
                View week
              </button>
            </form>
            <ExportButton
              href={`/api/admin/operations/production-export?type=worker-statement&employeeId=${encodeURIComponent(id)}&date=${selectedDate}`}
              className="min-h-12 rounded-xl bg-brand-green px-4 text-sm font-black text-white"
            >
              Download statement
            </ExportButton>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {[
            ["Opening balance", money(account.statement.openingBalance)],
            ["Completed", `${account.statement.pairs} pairs`],
            ["Rejected", `${account.statement.rejectedPairs} pairs`],
            ["Earned", money(account.statement.earned)],
            ["Cash/adjustment", money(account.statement.paid)],
            ["Closing balance", money(account.statement.closingBalance)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs font-bold text-gray-500">{label}</p>
              <p className="mt-1 font-black text-brand-green-ink">{value}</p>
            </div>
          ))}
        </div>

        <div className={`mt-4 rounded-xl p-4 ${
          account.statement.closingBalance >= 0
            ? "border border-emerald-200 bg-emerald-50 text-emerald-950"
            : "border border-amber-200 bg-amber-50 text-amber-950"
        }`}>
          <p className="text-xs font-black uppercase tracking-wider">
            {account.statement.closingBalance >= 0 ? "Saturday payable" : "Advance remaining"}
          </p>
          <p className="mt-1 text-2xl font-black">
            {money(account.statement.closingBalance >= 0
              ? account.statement.payable
              : account.statement.advanceBalance)}
          </p>
          <p className="mt-1 text-xs font-bold opacity-75">
            Opening balance + this week earned − cash/adjustments
          </p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-black text-brand-green-ink">Work ledger</h2>
          <div className="mt-4 space-y-3">
            {account.work.map((row) => (
              <article key={row.id} className="rounded-xl border border-gray-100 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-brand-green-ink">{row.itemName} · {row.stage}</p>
                    <p className="mt-1 text-gray-500">{row.workDate} · {row.totalPairs} pairs · rate {money(row.ratePerPair)}</p>
                    {row.rejectedPairs ? <p className="mt-1 text-brand-clay">Reject: {row.rejectedPairs} pairs</p> : null}
                  </div>
                  <p className="font-black text-brand-green">{money(row.earnedWage)}</p>
                </div>
              </article>
            ))}
            {account.work.length === 0 ? <p className="text-sm text-gray-500">No work entry yet.</p> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-black text-brand-green-ink">Cash & adjustment ledger</h2>
          <div className="mt-4 space-y-3">
            {account.payments.map((row) => (
              <article key={row.id} className="rounded-xl border border-gray-100 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-brand-green-ink">{row.paymentType}</p>
                    <p className="mt-1 text-gray-500">{row.paymentDate} · Cash · {row.receiptNumber}</p>
                    <p className="mt-1 text-xs text-gray-500">Approved by {row.approvedBy}{row.note ? ` · ${row.note}` : ""}</p>
                  </div>
                  <p className={`font-black ${row.direction === "Added" ? "text-brand-green" : "text-brand-clay"}`}>
                    {row.direction === "Added" ? "+" : "−"}{money(row.amount)}
                  </p>
                </div>
              </article>
            ))}
            {account.payments.length === 0 ? <p className="text-sm text-gray-500">No cash or adjustment entry yet.</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
