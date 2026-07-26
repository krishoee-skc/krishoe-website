import type { Metadata } from "next";
import Link from "next/link";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import {
  createProductionItemAction,
  createWorkEntryAction,
  createWorkerPaymentAction,
  saveStageRateAction,
} from "./actions";
import { getProductionAccountingSnapshot } from "@/lib/production-accounting";
import { productionStages, workerPaymentTypes } from "@/lib/production-accounting-rules";

export const metadata: Metadata = { title: "Production Accounts | KRISHOE Admin" };
export const dynamic = "force-dynamic";

const input =
  "min-h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-brand-green-ink outline-none focus:border-brand-green";
const card = "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5";
const button =
  "min-h-12 rounded-xl bg-brand-green px-5 text-sm font-black text-white transition hover:bg-brand-green-ink";

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(new Date());
}

function money(value: number) {
  return `Rs. ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default async function ProductionAccountsPage() {
  const data = await getProductionAccountingSnapshot();
  const activeItems = data.items.filter((item) => item.status === "Active");
  const date = today();

  return (
    <section className="mx-auto max-w-7xl space-y-5 p-4 pb-28 sm:p-6">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green">Factory accounts</p>
        <h1 className="mt-1 text-2xl font-black text-brand-green-ink">Production, wages & kharcha</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
          Owner-approved work, item/stage wage, midweek advance and Saturday kharcha—without mixing work earned with cash paid.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Active items", activeItems.length],
          ["Approved work entries", data.workEntries.filter((row) => row.status === "Approved").length],
          ["Worker balances", data.balances.length],
        ].map(([label, value]) => (
          <div key={label} className={card}>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-black text-brand-green-ink">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <form action={createProductionItemAction} className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">1. Production item</h2>
          <p className="mt-1 text-sm text-gray-500">Create the factory item once; wages can then vary by stage.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input name="name" className={input} placeholder="Item name, e.g. Ladies Sandal" required />
            <input name="category" className={input} placeholder="Category, e.g. Sandal" />
            <select name="productionType" className={input} defaultValue="Manufactured">
              <option>Manufactured</option><option>Resale</option><option>Mixed</option>
            </select>
            <select name="sizeGroup" className={input} defaultValue="Ladies">
              <option>Baby</option><option>Kids</option><option>Ladies</option><option>Gents</option><option>Mixed</option>
            </select>
          </div>
          <FormSubmitButton className={`${button} mt-4`} pendingLabel="Saving item…">Save item</FormSubmitButton>
        </form>

        <form action={saveStageRateAction} className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">2. Item-stage wage</h2>
          <p className="mt-1 text-sm text-gray-500">Old entries keep their saved rate even after a future rate change.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select name="itemId" className={input} required defaultValue="">
              <option value="" disabled>Select item</option>
              {activeItems.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.sizeGroup}</option>)}
            </select>
            <select name="stage" className={input}>{productionStages.map((stage) => <option key={stage}>{stage}</option>)}</select>
            <input name="ratePerPair" type="number" min="0" step="0.01" className={input} placeholder="Rs. per pair" required />
            <input name="effectiveFrom" type="date" className={input} defaultValue={date} required />
          </div>
          <FormSubmitButton className={`${button} mt-4`} pendingLabel="Saving rate…">Save wage rate</FormSubmitButton>
        </form>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <form action={createWorkEntryAction} className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">3. Completed work</h2>
          <p className="mt-1 text-sm text-gray-500">Enter only when the worker hands over completed work. Owner approval is immediate.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select name="employeeId" className={input} required defaultValue="">
              <option value="" disabled>Select worker</option>
              {data.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.id}</option>)}
            </select>
            <select name="itemId" className={input} required defaultValue="">
              <option value="" disabled>Select item</option>
              {activeItems.filter((item) => item.productionType !== "Resale").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select name="stage" className={input}>{productionStages.map((stage) => <option key={stage}>{stage}</option>)}</select>
            <input name="workDate" type="date" className={input} defaultValue={date} required />
            <input name="totalPairs" type="number" min="1" className={input} placeholder="Total completed pairs" required />
            <input name="sizeBreakdown" className={input} placeholder="Optional: 36:10, 37:15" />
            <input name="rejectedPairs" type="number" min="0" className={input} placeholder="Rejected pairs" defaultValue="0" />
            <input name="reworkPairs" type="number" min="0" className={input} placeholder="Rework pairs" defaultValue="0" />
            <input name="note" className={`${input} sm:col-span-2`} placeholder="Remark (optional)" />
          </div>
          <FormSubmitButton className={`${button} mt-4`} pendingLabel="Approving work…">Approve completed work</FormSubmitButton>
        </form>

        <form action={createWorkerPaymentAction} className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">4. Worker cash</h2>
          <p className="mt-1 text-sm text-gray-500">Cash paid is separate from work earned and automatically reduces the balance.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select name="employeeId" className={input} required defaultValue="">
              <option value="" disabled>Select worker/staff</option>
              {data.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </select>
            <select name="paymentType" className={input} defaultValue="Saturday Kharcha">
              {workerPaymentTypes.filter((type) => type !== "Correction").map((type) => <option key={type}>{type}</option>)}
            </select>
            <input name="amount" type="number" min="0.01" step="0.01" className={input} placeholder="Cash amount" required />
            <input name="paymentDate" type="date" className={input} defaultValue={date} required />
            <input name="note" className={`${input} sm:col-span-2`} placeholder="Reason / note" />
          </div>
          <FormSubmitButton className={`${button} mt-4`} pendingLabel="Approving cash…">Owner approve cash</FormSubmitButton>
        </form>
      </div>

      <div className={card}>
        <h2 className="text-lg font-black text-brand-green-ink">Worker balance</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.balances.map((row) => (
            <Link
              key={row.employeeId}
              href={`/admin/operations/production-accounts/worker/${encodeURIComponent(row.employeeId)}`}
              className="rounded-xl border border-gray-100 bg-gray-50 p-4 transition hover:border-brand-green"
            >
              <p className="font-black text-brand-green-ink">{row.employeeName}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div><span className="text-gray-500">Earned</span><p className="mt-1 font-black">{money(row.earned)}</p></div>
                <div><span className="text-gray-500">Cash/adjustment</span><p className="mt-1 font-black">{money(row.paid)}</p></div>
                <div><span className="text-gray-500">Balance</span><p className={`mt-1 font-black ${row.balance < 0 ? "text-brand-clay" : "text-brand-green"}`}>{money(row.balance)}</p></div>
              </div>
              <p className="mt-3 text-xs font-black text-brand-green">Open full ledger →</p>
            </Link>
          ))}
          {data.balances.length === 0 ? <p className="text-sm text-gray-500">No worker ledger yet. The clean start begins at zero.</p> : null}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">Current item-stage rates</h2>
          <div className="mt-4 space-y-2">
            {data.rates.map((rate) => {
              const item = data.items.find((row) => row.id === rate.itemId);
              return (
                <div key={rate.id} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3 text-sm">
                  <div>
                    <p className="font-black text-brand-green-ink">{item?.name ?? "Unknown item"}</p>
                    <p className="text-gray-500">{rate.stage} · from {rate.effectiveFrom}</p>
                  </div>
                  <p className="font-black text-brand-green">{money(rate.ratePerPair)}/pair</p>
                </div>
              );
            })}
            {data.rates.length === 0 ? <p className="text-sm text-gray-500">No stage wage rate yet.</p> : null}
          </div>
        </div>

        <div className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">Recent cash & adjustments</h2>
          <div className="mt-4 space-y-2">
            {data.payments.map((payment) => (
              <Link
                key={payment.id}
                href={`/admin/operations/production-accounts/worker/${encodeURIComponent(payment.employeeId)}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3 text-sm transition hover:bg-brand-green-wash"
              >
                <div>
                  <p className="font-black text-brand-green-ink">{payment.employeeName} · {payment.paymentType}</p>
                  <p className="text-gray-500">{payment.paymentDate} · {payment.receiptNumber}</p>
                </div>
                <p className={payment.direction === "Added" ? "font-black text-brand-green" : "font-black text-brand-clay"}>
                  {payment.direction === "Added" ? "+" : "−"}{money(payment.amount)}
                </p>
              </Link>
            ))}
            {data.payments.length === 0 ? <p className="text-sm text-gray-500">No cash entry yet.</p> : null}
          </div>
        </div>
      </div>

      <div className={card}>
        <h2 className="text-lg font-black text-brand-green-ink">Recent approved work</h2>
        <div className="mt-4 space-y-3">
          {data.workEntries.map((row) => (
            <article key={row.id} className="grid gap-2 rounded-xl border border-gray-100 p-3 text-sm sm:grid-cols-[1fr_auto]">
              <div>
                <p className="font-black text-brand-green-ink">{row.employeeName} · {row.itemName}</p>
                <p className="mt-1 text-gray-500">{row.workDate} · {row.stage} · {row.totalPairs} pairs · Reject {row.rejectedPairs}</p>
              </div>
              <p className="font-black text-brand-green">{money(row.earnedWage)}</p>
            </article>
          ))}
          {data.workEntries.length === 0 ? <p className="text-sm text-gray-500">No completed work entered yet.</p> : null}
        </div>
      </div>
    </section>
  );
}
