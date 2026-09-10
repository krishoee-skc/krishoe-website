import type { Metadata } from "next";
import { money } from "@/lib/format-money";
import Link from "next/link";
import ExportButton from "@/components/admin/ExportButton";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import NepaliDateFieldUncontrolled from "@/components/admin/NepaliDateFieldUncontrolled";
import { createWorkerPaymentAction } from "../actions";
import {
  getProductionAccountingSnapshot,
  getWeeklyWorkerSettlements,
} from "@/lib/production-accounting";
import { saturdayToFridayPeriod, workerPaymentTypes } from "@/lib/production-accounting-rules";
import WagesNav from "../_components/wages-nav";

export const metadata: Metadata = { title: "Payments | KRISHOE Admin" };
export const dynamic = "force-dynamic";

const input =
  "min-h-12 w-full rounded-xl border border-brand-green-line bg-brand-paper px-3 text-sm text-brand-green-ink outline-none focus:border-brand-green";
const card = "rounded-2xl border border-brand-green-line bg-brand-paper p-4 shadow-sm sm:p-5";
const button =
  "min-h-12 rounded-xl bg-brand-green px-5 text-sm font-black text-white transition hover:bg-brand-green-ink";

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(new Date());
}

// The previous and next settlement week, for the arrows on the payment centre.
function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Saturday, which is when this shop actually hands money over.
 *
 * The payment centre used to sit at the bottom of an eighteen-section page,
 * below five forms that have never been used once. Paying ten workers meant
 * scrolling past all of them, every week.
 */
export default async function WagesPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ settlementDate?: string }>;
}) {
  const query = await searchParams;
  const date = today();
  const reportDate = /^\d{4}-\d{2}-\d{2}$/.test(query.settlementDate ?? "")
    ? query.settlementDate!
    : date;
  const weeklyPeriod = saturdayToFridayPeriod(reportDate);
  const [data, weeklySettlements] = await Promise.all([
    getProductionAccountingSnapshot(),
    getWeeklyWorkerSettlements(weeklyPeriod),
  ]);
  const weeklyPayable = weeklySettlements.reduce((total, row) => total + row.payable, 0);

  return (
    <section className="mx-auto max-w-7xl space-y-5 p-4 pb-28 sm:p-6">
      <header className="flex flex-col gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green">Factory accounts</p>
          <h1 className="mt-1 text-2xl font-black text-brand-green-ink">Payments</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-muted">Saturday kharcha, midweek advance, and what each worker is owed. Cash paid stays separate from work earned.</p>
        </div>
        <WagesNav />
      </header>

      <div className="flex flex-wrap gap-2">
        <ExportButton href="/api/admin/operations/production-export?type=worker-payments" className="min-h-10 rounded-full bg-brand-green px-4 text-xs font-black text-white">Kharcha CSV</ExportButton>
        <ExportButton href="/api/admin/operations/production-export?type=work-entries" className="min-h-10 rounded-full border border-brand-green-line bg-brand-paper px-4 text-xs font-black text-brand-green-ink">Work &amp; wage CSV</ExportButton>
      </div>

      <div className="rounded-2xl border border-brand-green-line bg-brand-green-wash p-4">
        <p className="font-black text-brand-green">Friday statement workflow</p>
        <p className="mt-1 text-sm leading-6 text-brand-green">
          Download <strong>Work & wage</strong> and <strong>Kharcha</strong>. Filter dates from Saturday to Friday,
          then compare earned wage, cash paid and remaining worker balance before Saturday payment.
        </p>
      </div>

      <div className={card}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-green">Saturday payment center</p>
            <h2 className="mt-1 text-lg font-black text-brand-green-ink">
              {weeklyPeriod.start} to {weeklyPeriod.end}
            </h2>
            <p className="mt-1 text-sm text-brand-muted">
              Total suggested payable: <strong className="text-brand-green-ink">{money(weeklyPayable)}</strong>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form className="flex gap-2">
              <NepaliDateFieldUncontrolled name="settlementDate" defaultValue={reportDate} />
              <button className="min-h-11 rounded-xl border border-brand-green px-3 text-xs font-black text-brand-green">
                View week
              </button>
            </form>
            <ExportButton
              href={`/api/admin/operations/production-export?type=weekly-settlements&date=${reportDate}`}
              className="min-h-11 rounded-full bg-brand-green px-4 text-xs font-black text-white"
            >
              Download payment sheet
            </ExportButton>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`?settlementDate=${shiftDate(reportDate, -7)}`}
            className="rounded-full border border-brand-green-line bg-brand-paper px-3 py-2 text-xs font-black text-brand-green-ink"
          >
            ← Previous week
          </Link>
          {reportDate !== date ? (
            <Link
              href={`?settlementDate=${date}`}
              className="rounded-full border border-brand-green-line bg-brand-paper px-3 py-2 text-xs font-black text-brand-green-ink"
            >
              Current week
            </Link>
          ) : null}
          <Link
            href={`?settlementDate=${shiftDate(reportDate, 7)}`}
            className="rounded-full border border-brand-green-line bg-brand-paper px-3 py-2 text-xs font-black text-brand-green-ink"
          >
            Next week →
          </Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {weeklySettlements.map((row) => (
            <Link
              key={row.employeeId}
              href={`/admin/operations/production-accounts/worker/${encodeURIComponent(row.employeeId)}?date=${reportDate}`}
              className="hover-lift rounded-xl border border-brand-green-line bg-brand-paper-deep p-4 transition hover:border-brand-green"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-black text-brand-green-ink">{row.employeeName}</p>
                <p className={`text-sm font-black ${row.closingBalance >= 0 ? "text-brand-green" : "text-brand-clay"}`}>
                  {row.closingBalance >= 0 ? money(row.payable) : `Advance ${money(row.advanceBalance)}`}
                </p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs tabular-nums sm:grid-cols-3">
                <div><span className="text-brand-muted">Opening</span><p className="mt-1 font-black">{money(row.openingBalance)}</p></div>
                <div><span className="text-brand-muted">Earned</span><p className="mt-1 font-black">{money(row.earned)}</p></div>
                <div><span className="text-brand-muted">Cash</span><p className="mt-1 font-black">{money(row.paid)}</p></div>
              </div>
              <p className="mt-3 text-xs font-bold text-brand-muted">
                {row.completedPairs} pairs · {row.rejectedPairs} rejected
              </p>
            </Link>
          ))}
          {weeklySettlements.length === 0 ? (
            <p className="text-sm text-brand-muted">No piece worker or production ledger yet.</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
      <div className={card}>
        <h2 className="text-lg font-black text-brand-green-ink">Worker balance</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.balances.map((row) => (
            <Link
              key={row.employeeId}
              href={`/admin/operations/production-accounts/worker/${encodeURIComponent(row.employeeId)}`}
              className="hover-lift rounded-xl border border-brand-green-line bg-brand-paper-deep p-4 transition hover:border-brand-green"
            >
              <p className="font-black text-brand-green-ink">{row.employeeName}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs tabular-nums sm:grid-cols-3">
                <div><span className="text-brand-muted">Earned</span><p className="mt-1 font-black">{money(row.earned)}</p></div>
                <div><span className="text-brand-muted">Cash/adjustment</span><p className="mt-1 font-black">{money(row.paid)}</p></div>
                <div><span className="text-brand-muted">Balance</span><p className={`mt-1 font-black ${row.balance < 0 ? "text-brand-clay" : "text-brand-green"}`}>{money(row.balance)}</p></div>
              </div>
              <p className="mt-3 text-xs font-black text-brand-green">Open full ledger →</p>
            </Link>
          ))}
          {data.balances.length === 0 ? <p className="text-sm text-brand-muted">No worker ledger yet. The clean start begins at zero.</p> : null}
        </div>
      </div>
        <div className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">Recent cash & adjustments</h2>
          <div className="mt-4 space-y-2">
            {data.payments.map((payment) => (
              <Link
                key={payment.id}
                href={`/admin/operations/production-accounts/worker/${encodeURIComponent(payment.employeeId)}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-brand-paper-deep p-3 text-sm transition hover:bg-brand-green-wash"
              >
                <div>
                  <p className="font-black text-brand-green-ink">{payment.employeeName} · {payment.paymentType}</p>
                  <p className="text-brand-muted">{payment.paymentDate} · {payment.receiptNumber}</p>
                </div>
                <p className={payment.direction === "Added" ? "font-black text-brand-green" : "font-black text-brand-clay"}>
                  {payment.direction === "Added" ? "+" : "−"}{money(payment.amount)}
                </p>
              </Link>
            ))}
            {data.payments.length === 0 ? <p className="text-sm text-brand-muted">No cash entry yet.</p> : null}
          </div>
        </div>
      </div>

        <form action={createWorkerPaymentAction} className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">7. Worker cash</h2>
          <p className="mt-1 text-sm text-brand-muted">Cash paid is separate from work earned and automatically reduces the balance.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select aria-label="Worker" name="employeeId" className={input} required defaultValue="">
              <option value="" disabled>Select worker/staff</option>
              {data.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </select>
            <select aria-label="Payment type" name="paymentType" className={input} defaultValue="Saturday Kharcha">
              {workerPaymentTypes.filter((type) => type !== "Correction").map((type) => <option key={type}>{type}</option>)}
            </select>
            <input name="amount" type="number" min="0.01" step="0.01" className={input} placeholder="Cash amount" required />
            <NepaliDateFieldUncontrolled name="paymentDate" defaultValue={date} required />
            <input name="note" className={`${input} sm:col-span-2`} placeholder="Reason / note" />
          </div>
          <FormSubmitButton className={`${button} mt-4`} pendingLabel="Approving cash…">Owner approve cash</FormSubmitButton>
        </form>
    </section>
  );
}
