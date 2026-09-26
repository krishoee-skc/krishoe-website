import EnterWalkForm from "@/components/admin/EnterWalkForm";
import type { Metadata } from "next";
import { money } from "@/lib/format-money";
import ExportButton from "@/components/admin/ExportButton";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import NepaliDateFieldUncontrolled from "@/components/admin/NepaliDateFieldUncontrolled";
import {
  approveCostCardAction,
  approvePackingQcAction,
  createProductionItemAction,
  mapProductionItemAction,
  saveItemMaterialAction,
} from "../actions";
import { getProductionAccountingSnapshot } from "@/lib/production-accounting";
import T from "@/components/T";
import WagesNav from "../_components/wages-nav";

export const metadata: Metadata = { title: "Stock and cost | KRISHOE Admin" };
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
 * Finished pairs into stock (Packing/QC), and what a pair costs to make.
 *
 * Work Orders, lots and stage handovers used to live here too. None was ever
 * used, and the owner took them out; the shop records work in Factory Entry and
 * posts finished pairs from here. The tables stay in the database, untouched.
 */
export default async function WagesLotsPage() {
  const date = today();
  const data = await getProductionAccountingSnapshot();
  const activeItems = data.items.filter((item) => item.status === "Active");

  return (
    <section className="mx-auto max-w-7xl space-y-5 p-4 pb-28 sm:p-6">
      <header className="flex flex-col gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green">Factory accounts</p>
          <h1 className="mt-1 text-2xl font-black text-brand-green-ink"><T en="Stock & cost" ne="स्टक र लागत" /></h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-muted"><T en="Packed pairs into finished stock, and the cost of a pair." ne="प्याक भएका जोडी तयारी स्टकमा, र एक जोडी बनाउन लाग्ने लागत।" /></p>
        </div>
        <WagesNav />
      </header>

      <div className="flex flex-wrap gap-2">
        <ExportButton href="/api/admin/operations/production-export?type=qc-stock" className="min-h-10 rounded-full border border-brand-green-line bg-brand-paper px-4 text-xs font-black text-brand-green-ink">QC &amp; stock CSV</ExportButton>
        <ExportButton href="/api/admin/operations/production-export?type=cost-cards" className="min-h-10 rounded-full border border-brand-green-line bg-brand-paper px-4 text-xs font-black text-brand-green-ink">Cost cards CSV</ExportButton>
      </div>

      <EnterWalkForm action={approvePackingQcAction} className={`${card} border-emerald-200`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-green">Final gate</p>
            <h2 className="mt-1 text-lg font-black text-brand-green-ink">Packing/QC → Finished stock</h2>
            <p className="mt-1 max-w-3xl text-sm text-brand-muted">
              Only good packed pairs are posted. Saving creates one Production In movement and updates the linked shop/POS stock.
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">
            Owner approval required
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <select aria-label="Item" name="itemId" data-summary="text" className={input} required defaultValue="">
            <option value="" disabled>Select mapped manufactured item</option>
            {activeItems
              .filter((item) => item.productionType !== "Resale" && item.catalogProductId)
              .map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select aria-label="Packing worker" name="packingEmployeeId" className={input} defaultValue="">
            <option value="">Packing checker not selected</option>
            {data.employees.map((employee) => (
              <option key={employee.id} value={employee.id}>{employee.name} · {employee.department}</option>
            ))}
          </select>
          <NepaliDateFieldUncontrolled name="qcDate" defaultValue={date} required />
          <input aria-label="Good packed pairs" name="totalPairs" data-summary="pairs" type="number" min="1" className={input} placeholder="Good packed pairs" required />
          <input aria-label="Good sizes" name="sizeBreakdown" className={input} placeholder="Optional good sizes: 36:10, 37:15" />
          <input aria-label="QC rejected pairs" name="rejectedPairs" type="number" min="0" className={input} placeholder="QC rejected pairs" defaultValue="0" />
          <input aria-label="QC / packing remark" name="note" className={`${input} sm:col-span-2`} placeholder="QC / packing remark" />
          <FormSubmitButton className={button} pendingLabel="Posting stock…">
            Approve & post stock
          </FormSubmitButton>
        </div>
      </EnterWalkForm>

      <div className={card}>
        <h2 className="text-lg font-black text-brand-green-ink">Recent Packing/QC stock postings</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {data.qcPostings.map((posting) => (
            <article key={posting.id} className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-emerald-950">{posting.itemName} → {posting.catalogProductName}</p>
                  <p className="mt-1 text-emerald-800">{posting.qcDate} · {posting.approvalReference}</p>
                  <p className="mt-1 text-xs text-brand-muted">
                    Packing/QC: {posting.packingEmployeeName || "Owner verified"} · Approved by {posting.approvedBy}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-black text-brand-green">+{posting.totalPairs} pairs</p>
                  {posting.rejectedPairs ? <p className="mt-1 text-xs font-bold text-brand-clay">Reject {posting.rejectedPairs}</p> : null}
                </div>
              </div>
            </article>
          ))}
          {data.qcPostings.length === 0 ? (
            <p className="text-sm text-brand-muted">No Packing/QC stock posting yet.</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <EnterWalkForm action={createProductionItemAction} className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">1. Production item</h2>
          <p className="mt-1 text-sm text-brand-muted">Create the factory item once; wages can then vary by stage.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input aria-label="Item name, e.g. Ladies Sandal" name="name" className={input} placeholder="Item name, e.g. Ladies Sandal" required />
            <input aria-label="Category, e.g. Sandal" name="category" className={input} placeholder="Category, e.g. Sandal" />
            <select aria-label="Production type" name="productionType" className={input} defaultValue="Manufactured">
              <option>Manufactured</option><option>Resale</option><option>Mixed</option>
            </select>
            <select aria-label="Size group" name="sizeGroup" className={input} defaultValue="Ladies">
              <option>Baby</option><option>Kids</option><option>Ladies</option><option>Gents</option><option>Mixed</option>
            </select>
            <select aria-label="Catalog product to link" name="catalogProductId" className={`${input} sm:col-span-2`} defaultValue="">
              <option value="">No catalog/stock link yet</option>
              {data.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} · {product.sku || product.id}
                </option>
              ))}
            </select>
          </div>
          <FormSubmitButton className={`${button} mt-4`} pendingLabel="Saving item…">Save item</FormSubmitButton>
        </EnterWalkForm>
      </div>

      <EnterWalkForm action={mapProductionItemAction} className={card}>
        <h2 className="text-lg font-black text-brand-green-ink">Stock catalog mapping</h2>
        <p className="mt-1 text-sm text-brand-muted">
          Link a factory item to the exact shop/POS product. This prepares safe QC-approved stock posting; it does not change stock yet.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <select aria-label="Item" name="itemId" data-summary="text" className={input} required defaultValue="">
            <option value="" disabled>Select production item</option>
            {activeItems.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <select aria-label="Catalog product to link" name="catalogProductId" className={input} defaultValue="">
            <option value="">Remove catalog link</option>
            {data.products.map((product) => (
              <option key={product.id} value={product.id}>{product.name} · {product.sku || product.id}</option>
            ))}
          </select>
          <FormSubmitButton className={button} pendingLabel="Linking…">Save link</FormSubmitButton>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {activeItems.map((item) => {
            const product = data.products.find((row) => row.id === item.catalogProductId);
            return (
              <span key={item.id} className={`rounded-full border px-3 py-1 text-xs font-bold ${
                product ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"
              }`}>
                {item.name}: {product ? product.name : "stock link pending"}
              </span>
            );
          })}
        </div>
      </EnterWalkForm>

      <div className="grid gap-5 xl:grid-cols-2">
        <EnterWalkForm action={saveItemMaterialAction} className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">3. Material recipe per pair</h2>
          <p className="mt-1 text-sm text-brand-muted">
            Quantity uses the material&apos;s purchase unit. Example: Rexine 0.40 meter or Buckle 2 pieces per pair.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select aria-label="Item" name="itemId" data-summary="text" className={input} required defaultValue="">
              <option value="" disabled>Select manufactured item</option>
              {activeItems.filter((item) => item.productionType !== "Resale").map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <select aria-label="Material" name="materialId" className={input} required defaultValue="">
              <option value="" disabled>Select raw material</option>
              {data.materials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name} · {material.unit} · {money(material.averageUnitCost)}/{material.unit}
                </option>
              ))}
            </select>
            <input aria-label="Quantity per pair" name="quantityPerPair" type="number" min="0.0001" step="0.0001" className={input} placeholder="Quantity per pair" required />
            <input aria-label="Wastage % (optional)" name="wastagePercent" type="number" min="0" step="0.01" className={input} placeholder="Wastage % (optional)" defaultValue="0" />
            <input aria-label="Recipe note" name="note" className={`${input} sm:col-span-2`} placeholder="Recipe note" />
          </div>
          <FormSubmitButton className={`${button} mt-4`} pendingLabel="Saving material…">Save material recipe</FormSubmitButton>
        </EnterWalkForm>

        <EnterWalkForm action={approveCostCardAction} className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">4. Owner-approved price card</h2>
          <p className="mt-1 text-sm text-brand-muted">
            Material cost + four stage wages + direct cost. Rent, electricity and salary are excluded.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select aria-label="Item" name="itemId" data-summary="text" className={input} required defaultValue="">
              <option value="" disabled>Select manufactured item</option>
              {activeItems.filter((item) => item.productionType !== "Resale").map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <NepaliDateFieldUncontrolled name="effectiveFrom" defaultValue={date} required />
            <input aria-label="Other direct cost/pair" name="otherDirectCostPerPair" type="number" min="0" step="0.01" className={input} placeholder="Other direct cost/pair" defaultValue="0" />
            <input aria-label="Wholesale profit %" name="wholesaleProfitPercent" type="number" min="0" step="0.01" className={input} placeholder="Wholesale profit %" required />
            <input aria-label="Retail extra Rs." name="retailExtraAmount" type="number" min="0" step="0.01" className={input} placeholder="Retail extra Rs." required />
            <input aria-label="Approval note" name="note" className={input} placeholder="Approval note" />
          </div>
          <FormSubmitButton className={`${button} mt-4`} pendingLabel="Calculating…">Calculate & approve cost</FormSubmitButton>
        </EnterWalkForm>
      </div>

      <div className={card}>
        <h2 className="text-lg font-black text-brand-green-ink">Current product cost sheets</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {data.costCards.map((cost) => (
            <article key={cost.id} className="rounded-xl border border-brand-green-line bg-brand-paper-deep p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-brand-green-ink">{cost.itemName}</p>
                  <p className="mt-1 text-xs text-brand-muted">Effective {cost.effectiveFrom} · Owner {cost.approvedBy}</p>
                </div>
                <p className="text-lg font-black text-brand-green">{money(cost.makingCostPerPair)}</p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div><span className="text-brand-muted">Material</span><p className="font-black">{money(cost.materialCostPerPair)}</p></div>
                <div><span className="text-brand-muted">Wages</span><p className="font-black">{money(cost.laborCostPerPair)}</p></div>
                <div><span className="text-brand-muted">Wholesale</span><p className="font-black">{money(cost.wholesalePrice)}</p></div>
                <div><span className="text-brand-muted">Retail</span><p className="font-black">{money(cost.retailPrice)}</p></div>
              </div>
            </article>
          ))}
          {data.costCards.length === 0 ? <p className="text-sm text-brand-muted">No approved product cost sheet yet.</p> : null}
        </div>
      </div>
    </section>
  );
}
