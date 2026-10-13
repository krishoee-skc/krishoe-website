import EnterWalkForm from "@/components/admin/EnterWalkForm";
import type { Metadata } from "next";
import T from "@/components/T";
import { money } from "@/lib/format-money";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import NepaliDateFieldUncontrolled from "@/components/admin/NepaliDateFieldUncontrolled";
import { PageTabs } from "@/components/admin/PageKit";
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
const label = "grid gap-1 text-sm font-bold text-brand-green-ink";

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(new Date());
}

/**
 * What a pair pays, by item and stage.
 *
 * Changed rarely, but it is the figure every wage is worked out from, so it is
 * worth a page of its own rather than a form buried mid-scroll.
 *
 * As the owner's sample 7ग (2026-10-13): the rates in force first, then the
 * two forms, behind three tabs on a phone; both languages; no left-over "2."
 * numbering.
 */
export default async function WagesRatesPage() {
  const date = today();
  const data = await getProductionAccountingSnapshot();
  const activeItems = data.items.filter((item) => item.status === "Active");

  return (
    <section className="mx-auto max-w-7xl space-y-5 p-4 pb-28 sm:p-6">
      <header className="flex flex-col gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green"><T en="Factory accounts" ne="कारखानाको हिसाब" /></p>
          <h1 className="mt-1 text-2xl font-black text-brand-green-ink"><T en="Wage rates" ne="ज्यालाको दर" /></h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-muted">
            <T
              en="The rate a pair pays, by item and stage. Work already saved keeps the rate it was saved with."
              ne="एक जोडीको ज्याला, जुत्ता र चरण अनुसार। पहिले टिपेको कामले टिप्दाकै दर राख्छ।"
            />
          </p>
        </div>
        <WagesNav />
      </header>

      <PageTabs
        id="wage-rates"
        openOnWide
        wideGridClassName="grid gap-5 xl:grid-cols-2"
        tabs={[
          {
            key: "current",
            en: "📋 Rates now",
            ne: "📋 अहिलेका दर",
            content: (
              <div className={card}>
                <h2 className="text-lg font-black text-brand-green-ink"><T en="Current item-stage rates" ne="अहिलेका दर" /></h2>
                <div className="mt-4 space-y-2">
                  {data.rates.map((rate) => {
                    const item = data.items.find((row) => row.id === rate.itemId);
                    return (
                      <div key={rate.id} className="flex items-center justify-between gap-3 rounded-xl bg-brand-paper-deep p-3 text-sm">
                        <div className="min-w-0">
                          <p className="break-words font-black text-brand-green-ink">{item?.name ?? <T en="Unknown item" ne="नचिनिएको जुत्ता" />} · {rate.stage}</p>
                          <p className="text-brand-muted"><T en="from" ne="देखि" /> {rate.effectiveFrom}</p>
                        </div>
                        <p className="shrink-0 font-black text-brand-green">{money(rate.ratePerPair)} <T en="/pair" ne="/जोडी" /></p>
                      </div>
                    );
                  })}
                  {data.rates.length === 0 ? <p className="text-sm text-brand-muted"><T en="No stage wage rate yet." ne="अझै कुनै दर राखिएको छैन।" /></p> : null}
                </div>
                {data.workerRates.length > 0 ? (
                  <>
                    <h3 className="mt-5 text-sm font-black text-amber-800"><T en="⭐ One worker's own rate" ne="⭐ एक कामदारको छुट्टै दर" /></h3>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {data.workerRates.map((rate) => {
                        const item = data.items.find((row) => row.id === rate.itemId);
                        return (
                          <div key={rate.id} className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-sm">
                            <p className="break-words font-black text-brand-green-ink">{rate.employeeName} · {item?.name ?? "—"}</p>
                            <p className="mt-1 text-brand-muted">{rate.stage} · <T en="from" ne="देखि" /> {rate.effectiveFrom}</p>
                            <p className="mt-1 font-black text-amber-800">{money(rate.ratePerPair)} <T en="/pair" ne="/जोडी" /></p>
                            {rate.note ? <p className="mt-1 text-xs text-brand-muted">{rate.note}</p> : null}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : null}
              </div>
            ),
          },
          {
            key: "add",
            en: "＋ Set a rate",
            ne: "＋ दर राख्ने",
            content: (
              <EnterWalkForm action={saveStageRateAction} className={card}>
                <h2 className="text-lg font-black text-brand-green-ink"><T en="Item-stage wage" ne="जुत्ता र चरणको दर" /></h2>
                <p className="mt-1 text-sm text-brand-muted">
                  <T en="Old entries keep their saved rate even after a future rate change." ne="दर फेरे पनि पुराना कामले आफ्नै दर राख्छन्।" />
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className={label}>
                    <T en="Shoe" ne="जुत्ता" />
                    <select aria-label="Item" name="itemId" data-summary="text" className={input} required defaultValue="">
                      <option value="" disabled>—</option>
                      {activeItems.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.sizeGroup}</option>)}
                    </select>
                  </label>
                  <label className={label}>
                    <T en="Stage" ne="चरण" />
                    <select aria-label="Production stage" name="stage" data-summary="text" className={input}>{productionStages.map((stage) => <option key={stage}>{stage}</option>)}</select>
                  </label>
                  <label className={label}>
                    <T en="Rs. per pair" ne="प्रति जोडी रुपैयाँ" />
                    <input aria-label="Rs. per pair" name="ratePerPair" data-summary="money" type="number" min="0" step="0.01" className={input} placeholder="Rs." required />
                  </label>
                  <label className={label}>
                    <T en="From" ne="कहिलेदेखि" />
                    <NepaliDateFieldUncontrolled name="effectiveFrom" defaultValue={date} required />
                  </label>
                </div>
                <FormSubmitButton className={`${button} mt-4`} pendingLabel="Saving rate…"><T en="Save wage rate" ne="दर राख्ने" /></FormSubmitButton>
              </EnterWalkForm>
            ),
          },
          {
            key: "special",
            en: "⭐ One worker's rate",
            ne: "⭐ एक कामदारको दर",
            wideClassName: "xl:col-span-2",
            content: (
              <EnterWalkForm action={saveWorkerStageRateAction} className={`${card} border-amber-200`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-black text-brand-green-ink"><T en="Special worker wage override" ne="एक कामदारको छुट्टै दर" /></h2>
                    <p className="mt-1 text-sm text-brand-muted">
                      <T
                        en="Use only when one worker has a different item-stage rate. Otherwise the normal rate above applies."
                        ne="एउटा कामदारको दर फरक भए मात्र। नत्र सामान्य दर नै लाग्छ।"
                      />
                    </p>
                  </div>
                  <span className="w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800">
                    <T en="Owner only" ne="मालिक मात्र" />
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <label className={label}>
                    <T en="Worker" ne="कामदार" />
                    <select aria-label="Worker" name="employeeId" data-summary="text" className={input} required defaultValue="">
                      <option value="" disabled>—</option>
                      {data.employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>{employee.name} · {employee.department}</option>
                      ))}
                    </select>
                  </label>
                  <label className={label}>
                    <T en="Shoe" ne="जुत्ता" />
                    <select aria-label="Item" name="itemId" data-summary="text" className={input} required defaultValue="">
                      <option value="" disabled>—</option>
                      {activeItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </label>
                  <label className={label}>
                    <T en="Stage" ne="चरण" />
                    <select aria-label="Production stage" name="stage" data-summary="text" className={input}>
                      {productionStages.map((stage) => <option key={stage}>{stage}</option>)}
                    </select>
                  </label>
                  <label className={label}>
                    <T en="Special Rs./pair" ne="छुट्टै दर (प्रति जोडी)" />
                    <input aria-label="Special Rs./pair" name="ratePerPair" data-summary="money" type="number" min="0" step="0.01" className={input} placeholder="Rs." required />
                  </label>
                  <label className={label}>
                    <T en="From" ne="कहिलेदेखि" />
                    <NepaliDateFieldUncontrolled name="effectiveFrom" defaultValue={date} required />
                  </label>
                  <label className={`${label} sm:col-span-2`}>
                    <T en="Reason / agreement note (optional)" ne="कारण वा सम्झौता (नलेखे पनि हुन्छ)" />
                    <input aria-label="Reason / agreement note (optional)" name="note" className={input} />
                  </label>
                  <FormSubmitButton className={`${button} self-end`} pendingLabel="Saving override…"><T en="Save special rate" ne="छुट्टै दर राख्ने" /></FormSubmitButton>
                </div>
              </EnterWalkForm>
            ),
          },
        ]}
      />
    </section>
  );
}
