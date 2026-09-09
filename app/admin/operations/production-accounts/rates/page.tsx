import type { Metadata } from "next";
import { money } from "@/lib/format-money";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import NepaliDateFieldUncontrolled from "@/components/admin/NepaliDateFieldUncontrolled";
import { saveStageRateAction, saveWorkerStageRateAction } from "../actions";
import { getProductionAccountingSnapshot } from "@/lib/production-accounting";
import { productionStages } from "@/lib/production-accounting-rules";
import WagesNav from "../_components/wages-nav";

export const metadata: Metadata = { title: "Wage rates | KRISHOE Admin" };
export const dynamic = "force-dynamic";

const input =
  "min-h-12 w-full rounded-xl border border-brand-green-line bg-brand-paper px-3 text-sm text-brand-green-ink outline-none focus:border-brand-green";
const card = "rounded-2xl border border-brand-green-line bg-brand-paper p-4 shadow-sm sm:p-5";
const button =
  "min-h-12 rounded-xl bg-brand-green px-5 text-sm font-black text-white transition hover:bg-brand-green-ink";

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(new Date());
}

/**
 * What a pair pays, by item and stage.
 *
 * Changed rarely, but it is the figure every wage is worked out from, so it is
 * worth a page of its own rather than a form buried mid-scroll.
 */
export default async function WagesRatesPage() {
  const date = today();
  const data = await getProductionAccountingSnapshot();
  const activeItems = data.items.filter((item) => item.status === "Active");

  return (
    <section className="mx-auto max-w-7xl space-y-5 p-4 pb-28 sm:p-6">
      <header className="flex flex-col gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green">Factory accounts</p>
          <h1 className="mt-1 text-2xl font-black text-brand-green-ink">Wage rates</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-muted">The rate a pair pays, by item and stage. Work already saved keeps the rate it was saved with.</p>
        </div>
        <WagesNav />
      </header>

      <div className="grid gap-5 xl:grid-cols-2">
        <form action={saveStageRateAction} className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">2. Item-stage wage</h2>
          <p className="mt-1 text-sm text-brand-muted">Old entries keep their saved rate even after a future rate change.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select aria-label="Item" name="itemId" className={input} required defaultValue="">
              <option value="" disabled>Select item</option>
              {activeItems.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.sizeGroup}</option>)}
            </select>
            <select aria-label="Production stage" name="stage" className={input}>{productionStages.map((stage) => <option key={stage}>{stage}</option>)}</select>
            <input name="ratePerPair" type="number" min="0" step="0.01" className={input} placeholder="Rs. per pair" required />
            <NepaliDateFieldUncontrolled name="effectiveFrom" defaultValue={date} required />
          </div>
          <FormSubmitButton className={`${button} mt-4`} pendingLabel="Saving rate…">Save wage rate</FormSubmitButton>
        </form>
        <div className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">Current item-stage rates</h2>
          <div className="mt-4 space-y-2">
            {data.rates.map((rate) => {
              const item = data.items.find((row) => row.id === rate.itemId);
              return (
                <div key={rate.id} className="flex items-center justify-between gap-3 rounded-xl bg-brand-paper-deep p-3 text-sm">
                  <div>
                    <p className="font-black text-brand-green-ink">{item?.name ?? "Unknown item"}</p>
                    <p className="text-brand-muted">{rate.stage} · from {rate.effectiveFrom}</p>
                  </div>
                  <p className="font-black text-brand-green">{money(rate.ratePerPair)}/pair</p>
                </div>
              );
            })}
            {data.rates.length === 0 ? <p className="text-sm text-brand-muted">No stage wage rate yet.</p> : null}
          </div>
        </div>
      </div>

      <form action={saveWorkerStageRateAction} className={`${card} border-amber-200`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-brand-green-ink">Special worker wage override</h2>
            <p className="mt-1 text-sm text-brand-muted">
              Use only when one worker has a different item-stage rate. Otherwise the normal rate above applies.
            </p>
          </div>
          <span className="w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800">
            Owner only
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <select aria-label="Worker" name="employeeId" className={input} required defaultValue="">
            <option value="" disabled>Select worker</option>
            {data.employees.map((employee) => (
              <option key={employee.id} value={employee.id}>{employee.name} · {employee.department}</option>
            ))}
          </select>
          <select aria-label="Item" name="itemId" className={input} required defaultValue="">
            <option value="" disabled>Select item</option>
            {activeItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select aria-label="Production stage" name="stage" className={input}>
            {productionStages.map((stage) => <option key={stage}>{stage}</option>)}
          </select>
          <input name="ratePerPair" type="number" min="0" step="0.01" className={input} placeholder="Special Rs./pair" required />
          <NepaliDateFieldUncontrolled name="effectiveFrom" defaultValue={date} required />
          <input name="note" className={`${input} sm:col-span-2`} placeholder="Reason / agreement note (optional)" />
          <FormSubmitButton className={button} pendingLabel="Saving override…">Save special rate</FormSubmitButton>
        </div>
        {data.workerRates.length > 0 ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {data.workerRates.map((rate) => {
              const item = data.items.find((row) => row.id === rate.itemId);
              return (
                <div key={rate.id} className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-sm">
                  <p className="font-black text-brand-green-ink">{rate.employeeName} · {item?.name ?? "Item"}</p>
                  <p className="mt-1 text-brand-muted">{rate.stage} · from {rate.effectiveFrom}</p>
                  <p className="mt-1 font-black text-amber-800">{money(rate.ratePerPair)}/pair</p>
                  {rate.note ? <p className="mt-1 text-xs text-brand-muted">{rate.note}</p> : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </form>
    </section>
  );
}
