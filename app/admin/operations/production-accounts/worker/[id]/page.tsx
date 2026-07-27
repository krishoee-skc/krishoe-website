import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ExportButton from "@/components/admin/ExportButton";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import { getWorkerProductionAccount } from "@/lib/production-accounting";
import { saturdayToFridayPeriod } from "@/lib/production-accounting-rules";
import {
  createWorkerPaymentAction,
  reverseProductionWorkEntryAction,
  reverseWorkerPaymentAction,
} from "../../actions";

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

      <form action={createWorkerPaymentAction} className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-green">Owner cash approval</p>
            <h2 className="mt-1 text-lg font-black text-brand-green-ink">Record Saturday kharcha</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
              Suggested amount is the current payable balance. Edit it to the cash actually handed over;
              the remaining amount automatically stays in the worker ledger.
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">
            Suggested {money(account.statement.payable)}
          </span>
        </div>

        <input type="hidden" name="employeeId" value={account.employee.id} />
        <input type="hidden" name="paymentType" value="Saturday Kharcha" />
        <input type="hidden" name="statementStart" value={period.start} />
        <input type="hidden" name="statementEnd" value={period.end} />

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-bold text-brand-green-ink">
            Cash amount
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={account.statement.payable || ""}
              className="mt-2 min-h-12 w-full rounded-xl border border-gray-200 px-3 text-sm"
              required
            />
          </label>
          <label className="text-sm font-bold text-brand-green-ink">
            Payment date
            <input
              name="paymentDate"
              type="date"
              defaultValue={nepalToday()}
              className="mt-2 min-h-12 w-full rounded-xl border border-gray-200 px-3 text-sm"
              required
            />
          </label>
          <label className="text-sm font-bold text-brand-green-ink sm:col-span-2">
            Note (optional)
            <input
              name="note"
              className="mt-2 min-h-12 w-full rounded-xl border border-gray-200 px-3 text-sm"
              placeholder="Worker request or payment detail"
            />
          </label>
        </div>

        <label className="mt-4 flex min-h-12 items-center gap-3 rounded-xl bg-gray-50 px-3 text-sm font-bold text-brand-green-ink">
          <input name="cashConfirmed" type="checkbox" value="yes" required className="size-5 accent-brand-green" />
          I confirm this cash was handed to the worker.
        </label>

        <FormSubmitButton
          className="mt-4 min-h-12 rounded-xl bg-brand-green px-5 text-sm font-black text-white"
          pendingLabel="Recording cash…"
        >
          Approve & record cash
        </FormSubmitButton>
      </form>

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
                    {Object.keys(row.sizeBreakdown).length ? (
                      <p className="mt-1 text-xs text-gray-500">
                        Sizes: {Object.entries(row.sizeBreakdown).map(([size, pairs]) => `${size}:${pairs}`).join(", ")}
                      </p>
                    ) : null}
                    {row.rejectedPairs ? <p className="mt-1 text-brand-clay">Reject: {row.rejectedPairs} pairs</p> : null}
                  </div>
                  <p className={`font-black ${row.status === "Reversed" ? "text-gray-400 line-through" : "text-brand-green"}`}>
                    {money(row.earnedWage)}
                  </p>
                </div>
                {row.status === "Reversed" ? (
                  <p className="mt-2 rounded-lg bg-gray-100 px-2 py-1 text-xs font-black text-gray-600">
                    Reversed — excluded from wage and production progress
                  </p>
                ) : (
                  <details className="mt-3 border-t border-gray-100 pt-3">
                    <summary className="cursor-pointer text-xs font-black text-brand-clay">
                      Correct a mistaken work entry
                    </summary>
                    <form action={reverseProductionWorkEntryAction} className="mt-3 space-y-3 rounded-xl bg-red-50 p-3">
                      <input type="hidden" name="entryId" value={row.id} />
                      <p className="text-xs leading-5 text-red-900">
                        This removes the wage and recalculates the linked Work Order stage. Finished-stock lots cannot be reversed here.
                      </p>
                      <input
                        name="reason"
                        minLength={5}
                        className="min-h-11 w-full rounded-xl border border-red-200 bg-white px-3 text-sm"
                        placeholder="Reason for work reversal"
                        required
                      />
                      <label className="flex items-center gap-2 text-xs font-bold text-red-900">
                        <input name="reverseConfirmed" type="checkbox" value="yes" required className="size-4 accent-red-700" />
                        I confirm this completed-work entry is incorrect.
                      </label>
                      <FormSubmitButton
                        className="min-h-11 rounded-xl bg-red-700 px-4 text-xs font-black text-white"
                        pendingLabel="Reversing…"
                      >
                        Reverse this work
                      </FormSubmitButton>
                    </form>
                  </details>
                )}
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
                <details className="mt-3 border-t border-gray-100 pt-3">
                  <summary className="cursor-pointer text-xs font-black text-brand-clay">
                    Correct a mistaken cash entry
                  </summary>
                  <form action={reverseWorkerPaymentAction} className="mt-3 space-y-3 rounded-xl bg-red-50 p-3">
                    <input type="hidden" name="paymentId" value={row.id} />
                    <p className="text-xs leading-5 text-red-900">
                      This keeps receipt {row.receiptNumber} in history but removes its effect from the worker balance.
                    </p>
                    <input
                      name="reason"
                      minLength={5}
                      className="min-h-11 w-full rounded-xl border border-red-200 bg-white px-3 text-sm"
                      placeholder="Reason for reversal"
                      required
                    />
                    <label className="flex items-center gap-2 text-xs font-bold text-red-900">
                      <input name="reverseConfirmed" type="checkbox" value="yes" required className="size-4 accent-red-700" />
                      I confirm this receipt is a mistaken entry.
                    </label>
                    <FormSubmitButton
                      className="min-h-11 rounded-xl bg-red-700 px-4 text-xs font-black text-white"
                      pendingLabel="Reversing…"
                    >
                      Reverse this payment
                    </FormSubmitButton>
                  </form>
                </details>
              </article>
            ))}
            {account.payments.length === 0 ? <p className="text-sm text-gray-500">No cash or adjustment entry yet.</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
