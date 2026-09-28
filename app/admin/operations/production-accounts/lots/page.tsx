import EnterWalkForm from "@/components/admin/EnterWalkForm";
import type { Metadata } from "next";
import { money } from "@/lib/format-money";
import ExportButton from "@/components/admin/ExportButton";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import NepaliDateFieldUncontrolled from "@/components/admin/NepaliDateFieldUncontrolled";
import { approveCostCardAction, createProductionItemAction, saveItemMaterialAction } from "../actions";
import { getProductionAccountingSnapshot } from "@/lib/production-accounting";
import T from "@/components/T";
import WagesNav from "../_components/wages-nav";
import { TInput, TOption } from "@/components/admin/TField";

export const metadata: Metadata = { title: "Cost of a pair | KRISHOE Admin" };
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
 * What a pair costs to make: the shoe, the material in one pair, and the cost
 * card the owner approves.
 *
 * Finished pairs used to be posted to stock from here too (Packing/QC), behind
 * a "stock link" to a shop product that was never made — so the box could not
 * post anything. The owner chose on 2026-09-28 to post stock in one place only:
 * Add work → "post it to stock", which matches the shop's shoe by name. Old
 * Packing/QC postings stay in the database and are listed below, read only.
 */
export default async function WagesLotsPage() {
  const date = today();
  const data = await getProductionAccountingSnapshot();
  const activeItems = data.items.filter((item) => item.status === "Active");
  const madeItems = activeItems.filter((item) => item.productionType !== "Resale");
  const materialsByItem = new Map<string, number>();
  for (const row of data.itemMaterials) materialsByItem.set(row.itemId, (materialsByItem.get(row.itemId) ?? 0) + 1);
  const costedItems = new Set(data.costCards.map((cost) => cost.itemId));

  return (
    <section className="mx-auto max-w-7xl space-y-5 p-4 pb-28 sm:p-6">
      <header className="flex flex-col gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green">
            <T en="Factory accounts" ne="कारखानाको हिसाब" />
          </p>
          <h1 className="mt-1 text-2xl font-black text-brand-green-ink">
            <T en="🧮 Cost of a pair" ne="🧮 एक जोडीको लागत" />
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-muted">
            <T
              en="How much material and wage go into one pair, and what to sell it for. Stock is not posted from here."
              ne="एक जोडी बनाउन कति माल र ज्याला लाग्छ, र कतिमा बेच्ने। यहाँबाट स्टक चढ्दैन।"
            />
          </p>
        </div>
        <WagesNav />
      </header>

      {/* Where each shoe stands, before the forms: material entered? cost approved? */}
      {madeItems.length ? (
        <div className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">
            <T en="Where each shoe stands" ne="कुन जुत्ता कहाँ पुग्यो" />
          </h2>
          <ul className="mt-3 grid list-none gap-2 pl-0 sm:grid-cols-2 xl:grid-cols-3">
            {madeItems.map((item) => {
              const materials = materialsByItem.get(item.id) ?? 0;
              const costed = costedItems.has(item.id);
              return (
                <li key={item.id} className="rounded-xl border border-brand-green-line bg-brand-paper-deep p-3 text-sm">
                  <p className="font-black text-brand-green-ink">{item.name}</p>
                  <p className="mt-1 flex flex-wrap gap-1.5 text-xs font-bold">
                    <span className={`rounded-full px-2 py-0.5 ${materials ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                      {materials ? (
                        <T en={`✓ ${materials} materials`} ne={`✓ ${materials} वटा माल`} />
                      ) : (
                        <T en="No material yet" ne="माल राखिएको छैन" />
                      )}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 ${costed ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                      {costed ? <T en="✓ Cost approved" ne="✓ लागत निकालिएको" /> : <T en="No cost yet" ne="लागत निकालिएको छैन" />}
                    </span>
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <EnterWalkForm action={createProductionItemAction} className={card}>
        <h2 className="text-lg font-black text-brand-green-ink">
          <T en="1. Add a shoe the factory makes" ne="१. जुत्ता दर्ता" />
        </h2>
        <p className="mt-1 text-sm text-brand-muted">
          <T
            en="Once per shoe. Wages can then differ by stage."
            ne="एउटा जुत्ता एक पटक मात्र। त्यसपछि काम अनुसार ज्याला फरक राख्न मिल्छ।"
          />
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <TInput aria-label="Shoe name" name="name" className={input} en="Shoe name, e.g. bantu hill" ne="जुत्ताको नाम, जस्तै bantu hill" required />
          <TInput aria-label="Category" name="category" className={input} en="Category, e.g. Sandal" ne="किसिम, जस्तै Sandal" />
          <select aria-label="Made or bought" name="productionType" className={input} defaultValue="Manufactured">
            <TOption value="Manufactured" en="Made here" ne="यहीँ बनेको" />
            <TOption value="Resale" en="Bought to sell" ne="किनेर बेच्ने" />
            <TOption value="Mixed" en="Both" ne="दुवै" />
          </select>
          <select aria-label="Size group" name="sizeGroup" className={input} defaultValue="Ladies">
            <option>Baby</option><option>Kids</option><option>Ladies</option><option>Gents</option><option>Mixed</option>
          </select>
        </div>
        <FormSubmitButton className={`${button} mt-4`} pendingLabel="Saving…">
          <T en="Save shoe" ne="जुत्ता सेभ गर्ने" />
        </FormSubmitButton>
      </EnterWalkForm>

      <div className="grid gap-5 xl:grid-cols-2">
        <EnterWalkForm action={saveItemMaterialAction} className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">
            <T en="2. Material in one pair" ne="२. एक जोडीमा कति माल" />
          </h2>
          <p className="mt-1 text-sm text-brand-muted">
            <T
              en="In the unit it is bought in. Example: Rexine 0.40 meter, or Buckle 2 pieces, per pair."
              ne="किन्ने एकाइमै लेख्नुहोस्। जस्तै: एक जोडीमा Rexine 0.40 मिटर, वा Buckle 2 वटा।"
            />
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select aria-label="Shoe" name="itemId" data-summary="text" className={input} required defaultValue="">
              <TOption value="" disabled en="Choose the shoe" ne="जुत्ता छान्नुहोस्" />
              {madeItems.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <select aria-label="Material" name="materialId" className={input} required defaultValue="">
              <TOption value="" disabled en="Choose the material" ne="माल छान्नुहोस्" />
              {data.materials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name} · {material.unit} · {money(material.averageUnitCost)}/{material.unit}
                </option>
              ))}
            </select>
            <TInput aria-label="Quantity per pair" name="quantityPerPair" type="number" min="0.0001" step="0.0001" className={input} en="How much in one pair" ne="एक जोडीमा कति" required />
            <TInput aria-label="Wastage % (optional)" name="wastagePercent" type="number" min="0" step="0.01" className={input} en="Wastage % (optional)" ne="खेर जाने % (नभए 0)" defaultValue="0" />
            <TInput aria-label="Note" name="note" className={`${input} sm:col-span-2`} en="Note" ne="टिप्पणी" />
          </div>
          <FormSubmitButton className={`${button} mt-4`} pendingLabel="Saving…">
            <T en="Save material" ne="माल सेभ गर्ने" />
          </FormSubmitButton>
        </EnterWalkForm>

        <EnterWalkForm action={approveCostCardAction} className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">
            <T en="3. Cost of a pair, and the selling rate" ne="३. एक जोडीको लागत र बेच्ने दर" />
          </h2>
          <p className="mt-1 text-sm text-brand-muted">
            <T
              en="Material + the four stage wages + other direct cost. Rent, electricity and salaries are not included."
              ne="माल + चार कामको ज्याला + अरू सिधा खर्च। घरभाडा, बिजुली र तलब यसमा जोडिँदैनन्।"
            />
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select aria-label="Shoe" name="itemId" data-summary="text" className={input} required defaultValue="">
              <TOption value="" disabled en="Choose the shoe" ne="जुत्ता छान्नुहोस्" />
              {madeItems.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <NepaliDateFieldUncontrolled name="effectiveFrom" defaultValue={date} required />
            <TInput aria-label="Other direct cost/pair" name="otherDirectCostPerPair" type="number" min="0" step="0.01" className={input} en="Other direct cost a pair" ne="एक जोडीमा अरू सिधा खर्च" defaultValue="0" />
            <TInput aria-label="Wholesale profit %" name="wholesaleProfitPercent" type="number" min="0" step="0.01" className={input} en="Wholesale profit %" ne="होलसेलमा कति % नाफा" required />
            <TInput aria-label="Retail extra Rs." name="retailExtraAmount" type="number" min="0" step="0.01" className={input} en="Retail extra Rs." ne="खुद्रामा कति रुपैयाँ थप" required />
            <TInput aria-label="Note" name="note" className={input} en="Note" ne="टिप्पणी" />
          </div>
          <FormSubmitButton className={`${button} mt-4`} pendingLabel="Calculating…">
            <T en="Work out and approve the cost" ne="लागत निकाल्ने र पक्का गर्ने" />
          </FormSubmitButton>
        </EnterWalkForm>
      </div>

      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-black text-brand-green-ink">
            <T en="Approved costs" ne="निकालिएको लागत" />
          </h2>
          {data.costCards.length ? (
            <ExportButton href="/api/admin/operations/production-export?type=cost-cards" className="min-h-10 rounded-full border border-brand-green-line bg-brand-paper px-4 text-xs font-black text-brand-green-ink">
              <T en="Costs as CSV" ne="लागत CSV" />
            </ExportButton>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {data.costCards.map((cost) => (
            <article key={cost.id} className="rounded-xl border border-brand-green-line bg-brand-paper-deep p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-brand-green-ink">{cost.itemName}</p>
                  <p className="mt-1 text-xs text-brand-muted">
                    <T en={`From ${cost.effectiveFrom} · approved by ${cost.approvedBy}`} ne={`${cost.effectiveFrom} देखि · पक्का गर्ने ${cost.approvedBy}`} />
                  </p>
                </div>
                <p className="text-lg font-black text-brand-green">{money(cost.makingCostPerPair)}</p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div><span className="text-brand-muted"><T en="Material" ne="माल" /></span><p className="font-black">{money(cost.materialCostPerPair)}</p></div>
                <div><span className="text-brand-muted"><T en="Wages" ne="ज्याला" /></span><p className="font-black">{money(cost.laborCostPerPair)}</p></div>
                <div><span className="text-brand-muted"><T en="Wholesale" ne="होलसेल" /></span><p className="font-black">{money(cost.wholesalePrice)}</p></div>
                <div><span className="text-brand-muted"><T en="Retail" ne="खुद्रा" /></span><p className="font-black">{money(cost.retailPrice)}</p></div>
              </div>
            </article>
          ))}
          {data.costCards.length === 0 ? (
            <p className="text-sm text-brand-muted">
              <T en="No cost approved yet." ne="अहिलेसम्म कुनै लागत निकालिएको छैन।" />
            </p>
          ) : null}
        </div>
      </div>

      {/* Postings made from the old Packing/QC box, kept as a record. */}
      {data.qcPostings.length ? (
        <div className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-black text-brand-green-ink">
              <T en="Stock posted from this page before" ne="पहिले यो पेजबाट चढाएको स्टक" />
            </h2>
            <ExportButton href="/api/admin/operations/production-export?type=qc-stock" className="min-h-10 rounded-full border border-brand-green-line bg-brand-paper px-4 text-xs font-black text-brand-green-ink">
              CSV
            </ExportButton>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {data.qcPostings.map((posting) => (
              <article key={posting.id} className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-emerald-950">{posting.itemName} → {posting.catalogProductName}</p>
                    <p className="mt-1 text-emerald-800">{posting.qcDate} · {posting.approvalReference}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-brand-green">+{posting.totalPairs}</p>
                    {posting.rejectedPairs ? <p className="mt-1 text-xs font-bold text-brand-clay">−{posting.rejectedPairs}</p> : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
