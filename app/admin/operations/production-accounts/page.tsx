import type { Metadata } from "next";
import Link from "next/link";
import ExportButton from "@/components/admin/ExportButton";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import OfflineProductionWorkForm from "@/components/admin/OfflineProductionWorkForm";
import {
  createProductionItemAction,
  createWorkEntryAction,
  createWorkerPaymentAction,
  mapProductionItemAction,
  approvePackingQcAction,
  approveCostCardAction,
  saveItemMaterialAction,
  createWorkOrderAction,
  createHandoverAction,
  saveStageRateAction,
  saveWorkerStageRateAction,
} from "./actions";
import {
  getProductionAccountingSnapshot,
  getProductionAcceptanceAudit,
  getProductionControlSummary,
  getWeeklyWorkerSettlements,
} from "@/lib/production-accounting";
import {
  productionStages,
  saturdayToFridayPeriod,
  workerPaymentTypes,
} from "@/lib/production-accounting-rules";

export const metadata: Metadata = { title: "Production Accounts | KRISHOE Admin" };
export const dynamic = "force-dynamic";

const input =
  "min-h-12 w-full rounded-xl border border-brand-green-line bg-brand-paper px-3 text-sm text-brand-green-ink outline-none focus:border-brand-green";
const card = "rounded-2xl border border-brand-green-line bg-brand-paper p-4 shadow-sm sm:p-5";
const button =
  "min-h-12 rounded-xl bg-brand-green px-5 text-sm font-black text-white transition hover:bg-brand-green-ink";

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(new Date());
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function money(value: number) {
  return `Rs. ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default async function ProductionAccountsPage({
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
  const [data, control, weeklySettlements, acceptance] = await Promise.all([
    getProductionAccountingSnapshot(),
    getProductionControlSummary(),
    getWeeklyWorkerSettlements(weeklyPeriod),
    getProductionAcceptanceAudit(),
  ]);
  const activeItems = data.items.filter((item) => item.status === "Active");
  const weeklyPayable = weeklySettlements.reduce((total, row) => total + row.payable, 0);

  return (
    <section className="mx-auto max-w-7xl space-y-5 p-4 pb-28 sm:p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green">Factory accounts</p>
        <h1 className="mt-1 text-2xl font-black text-brand-green-ink">Production, wages & kharcha</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-muted">
          Owner-approved work, item/stage wage, midweek advance and Saturday kharcha—without mixing work earned with cash paid.
        </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            ["work-orders", "Work Orders"],
            ["work-entries", "Work & wage"],
            ["worker-payments", "Kharcha"],
            ["handovers", "Handovers"],
            ["qc-stock", "QC & stock"],
            ["cost-cards", "Cost cards"],
          ].map(([type, label], index) => (
            <ExportButton
              key={type}
              href={`/api/admin/operations/production-export?type=${type}`}
              className={index === 0
                ? "min-h-10 rounded-full bg-brand-green px-4 text-xs font-black text-white"
                : "min-h-10 rounded-full border border-brand-green-line bg-brand-paper px-4 text-xs font-black text-brand-green-ink"}
            >
              {label} CSV
            </ExportButton>
          ))}
        </div>
      </header>

      <div className="rounded-2xl border border-brand-green-line bg-brand-green-wash p-4">
        <p className="font-black text-brand-green">Friday statement workflow</p>
        <p className="mt-1 text-sm leading-6 text-brand-green">
          Download <strong>Work & wage</strong> and <strong>Kharcha</strong>. Filter dates from Saturday to Friday,
          then compare earned wage, cash paid and remaining worker balance before Saturday payment.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Active Work Orders", control.activeWorkOrders, `${control.overdueWorkOrders} overdue`],
          ["Today good output", `${control.todayGoodPairs} pairs`, `${control.todayRejectedPairs} rejected`],
          ["Ready for QC", control.readyForQc, `${control.todayStockPairs} pairs posted today`],
          ["Worker balance due", money(control.workerBalanceDue), `${money(control.todayEarnedWage)} earned today`],
        ].map(([label, value, detail]) => (
          <div key={label} className={card}>
            <p className="text-xs font-bold uppercase tracking-wider text-brand-muted">{label}</p>
            <p className="mt-2 text-2xl font-black text-brand-green-ink">{value}</p>
            <p className="mt-2 text-xs font-bold text-brand-muted">{detail}</p>
          </div>
        ))}
      </div>

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
        <h2 className="text-lg font-black text-brand-green-ink">Stage-wise pending Work Orders</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {["Upper", "Fiber Preparation", "Fiber Silai", "Bottom Final", "Packing / QC"].map((stage) => (
            <div key={stage} className="rounded-xl bg-brand-paper-deep p-3">
              <p className="text-xs font-bold text-brand-muted">{stage}</p>
              <p className="mt-1 text-xl font-black text-brand-green-ink">{control.stagePending[stage] ?? 0}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <form action={createProductionItemAction} className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">1. Production item</h2>
          <p className="mt-1 text-sm text-brand-muted">Create the factory item once; wages can then vary by stage.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input name="name" className={input} placeholder="Item name, e.g. Ladies Sandal" required />
            <input name="category" className={input} placeholder="Category, e.g. Sandal" />
            <select name="productionType" className={input} defaultValue="Manufactured">
              <option>Manufactured</option><option>Resale</option><option>Mixed</option>
            </select>
            <select name="sizeGroup" className={input} defaultValue="Ladies">
              <option>Baby</option><option>Kids</option><option>Ladies</option><option>Gents</option><option>Mixed</option>
            </select>
            <select name="catalogProductId" className={`${input} sm:col-span-2`} defaultValue="">
              <option value="">No catalog/stock link yet</option>
              {data.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} · {product.sku || product.id}
                </option>
              ))}
            </select>
          </div>
          <FormSubmitButton className={`${button} mt-4`} pendingLabel="Saving item…">Save item</FormSubmitButton>
        </form>

        <form action={saveStageRateAction} className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">2. Item-stage wage</h2>
          <p className="mt-1 text-sm text-brand-muted">Old entries keep their saved rate even after a future rate change.</p>
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
          <select name="employeeId" className={input} required defaultValue="">
            <option value="" disabled>Select worker</option>
            {data.employees.map((employee) => (
              <option key={employee.id} value={employee.id}>{employee.name} · {employee.department}</option>
            ))}
          </select>
          <select name="itemId" className={input} required defaultValue="">
            <option value="" disabled>Select item</option>
            {activeItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select name="stage" className={input}>
            {productionStages.map((stage) => <option key={stage}>{stage}</option>)}
          </select>
          <input name="ratePerPair" type="number" min="0" step="0.01" className={input} placeholder="Special Rs./pair" required />
          <input name="effectiveFrom" type="date" className={input} defaultValue={date} required />
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

      <form action={mapProductionItemAction} className={card}>
        <h2 className="text-lg font-black text-brand-green-ink">Stock catalog mapping</h2>
        <p className="mt-1 text-sm text-brand-muted">
          Link a factory item to the exact shop/POS product. This prepares safe QC-approved stock posting; it does not change stock yet.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <select name="itemId" className={input} required defaultValue="">
            <option value="" disabled>Select production item</option>
            {activeItems.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <select name="catalogProductId" className={input} defaultValue="">
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
      </form>

      <form action={approvePackingQcAction} className={`${card} border-emerald-200`}>
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
          <select name="workOrderId" className={input} defaultValue="">
            <option value="">No Work Order link (legacy/manual)</option>
            {data.workOrders.filter((order) => order.status === "Ready for QC").map((order) => (
              <option key={order.id} value={order.id}>{order.workOrderNumber} · {order.itemName}</option>
            ))}
          </select>
          <select name="itemId" className={input} required defaultValue="">
            <option value="" disabled>Select mapped manufactured item</option>
            {activeItems
              .filter((item) => item.productionType !== "Resale" && item.catalogProductId)
              .map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select name="packingEmployeeId" className={input} defaultValue="">
            <option value="">Packing checker not selected</option>
            {data.employees.map((employee) => (
              <option key={employee.id} value={employee.id}>{employee.name} · {employee.department}</option>
            ))}
          </select>
          <input name="qcDate" type="date" className={input} defaultValue={date} required />
          <input name="totalPairs" type="number" min="1" className={input} placeholder="Good packed pairs" required />
          <input name="sizeBreakdown" className={input} placeholder="Optional good sizes: 36:10, 37:15" />
          <input name="rejectedPairs" type="number" min="0" className={input} placeholder="QC rejected pairs" defaultValue="0" />
          <input name="note" className={`${input} sm:col-span-2`} placeholder="QC / packing remark" />
          <FormSubmitButton className={button} pendingLabel="Posting stock…">
            Approve & post stock
          </FormSubmitButton>
        </div>
      </form>

      <div className={card}>
        <h2 className="text-lg font-black text-brand-green-ink">Recent Packing/QC stock postings</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {data.qcPostings.map((posting) => (
            <article key={posting.id} className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-emerald-950">{posting.itemName} → {posting.catalogProductName}</p>
                  <p className="mt-1 text-emerald-800">{posting.qcDate} · {posting.approvalReference}</p>
                  {posting.workOrderId ? <p className="mt-1 text-xs font-bold text-emerald-800">Work Order linked</p> : null}
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
        <form action={saveItemMaterialAction} className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">3. Material recipe per pair</h2>
          <p className="mt-1 text-sm text-brand-muted">
            Quantity uses the material&apos;s purchase unit. Example: Rexine 0.40 meter or Buckle 2 pieces per pair.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select name="itemId" className={input} required defaultValue="">
              <option value="" disabled>Select manufactured item</option>
              {activeItems.filter((item) => item.productionType !== "Resale").map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <select name="materialId" className={input} required defaultValue="">
              <option value="" disabled>Select raw material</option>
              {data.materials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name} · {material.unit} · {money(material.averageUnitCost)}/{material.unit}
                </option>
              ))}
            </select>
            <input name="quantityPerPair" type="number" min="0.0001" step="0.0001" className={input} placeholder="Quantity per pair" required />
            <input name="wastagePercent" type="number" min="0" step="0.01" className={input} placeholder="Wastage % (optional)" defaultValue="0" />
            <input name="note" className={`${input} sm:col-span-2`} placeholder="Recipe note" />
          </div>
          <FormSubmitButton className={`${button} mt-4`} pendingLabel="Saving material…">Save material recipe</FormSubmitButton>
        </form>

        <form action={approveCostCardAction} className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">4. Owner-approved price card</h2>
          <p className="mt-1 text-sm text-brand-muted">
            Material cost + four stage wages + direct cost. Rent, electricity and salary are excluded.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select name="itemId" className={input} required defaultValue="">
              <option value="" disabled>Select manufactured item</option>
              {activeItems.filter((item) => item.productionType !== "Resale").map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <input name="effectiveFrom" type="date" className={input} defaultValue={date} required />
            <input name="otherDirectCostPerPair" type="number" min="0" step="0.01" className={input} placeholder="Other direct cost/pair" defaultValue="0" />
            <input name="wholesaleProfitPercent" type="number" min="0" step="0.01" className={input} placeholder="Wholesale profit %" required />
            <input name="retailExtraAmount" type="number" min="0" step="0.01" className={input} placeholder="Retail extra Rs." required />
            <input name="note" className={input} placeholder="Approval note" />
          </div>
          <FormSubmitButton className={`${button} mt-4`} pendingLabel="Calculating…">Calculate & approve cost</FormSubmitButton>
        </form>
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

      <div className="grid gap-5 xl:grid-cols-2">
        <form action={createWorkOrderAction} className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">5. New Work Order / Lot</h2>
          <p className="mt-1 text-sm text-brand-muted">Plan colour, mixed sizes, total pairs and due date before production starts.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select name="itemId" className={input} required defaultValue="">
              <option value="" disabled>Select manufactured item</option>
              {activeItems.filter((item) => item.productionType !== "Resale").map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <input name="colour" className={input} placeholder="Colour, e.g. Black" required />
            <input name="plannedPairs" type="number" min="1" className={input} placeholder="Planned total pairs" required />
            <input name="sizeBreakdown" className={input} placeholder="Sizes: 36:10, 37:15, 38:20" required />
            <input name="dueDate" type="date" className={input} />
            <select name="priority" className={input} defaultValue="Normal">
              <option>Normal</option><option>High</option><option>Urgent</option>
            </select>
            <input name="note" className={`${input} sm:col-span-2`} placeholder="Work Order remark" />
          </div>
          <FormSubmitButton className={`${button} mt-4`} pendingLabel="Creating Work Order…">Create Work Order</FormSubmitButton>
        </form>

        <div className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">Active Work Orders</h2>
          <div className="mt-4 space-y-3">
            {data.workOrders.filter((order) => !["Completed", "Cancelled"].includes(order.status)).map((order) => (
              <Link
                key={order.id}
                href={`/admin/operations/production-accounts/work-order/${encodeURIComponent(order.id)}`}
                className="block rounded-xl border border-brand-green-line bg-brand-paper-deep p-3 text-sm transition hover:border-brand-green"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-brand-green-ink">{order.workOrderNumber} · {order.itemName}</p>
                    <p className="mt-1 text-brand-muted">{order.colour} · {order.plannedPairs} pairs · due {order.dueDate || "not set"}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-black ${
                    order.priority === "Urgent" ? "bg-red-50 text-red-800" :
                    order.priority === "High" ? "bg-amber-50 text-amber-800" : "bg-brand-paper text-brand-muted-deep"
                  }`}>{order.priority}</span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="font-bold text-brand-green">Current: {order.currentStage}</p>
                  <p className="text-xs font-bold text-brand-muted">{order.status}</p>
                </div>
                <p className="mt-3 text-xs font-black text-brand-green">Open lot history & QR →</p>
              </Link>
            ))}
            {data.workOrders.length === 0 ? <p className="text-sm text-brand-muted">No Work Order yet.</p> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <form action={createHandoverAction} className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">Stage handover</h2>
          <p className="mt-1 text-sm text-brand-muted">Record who sent, who received and any quantity difference.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select name="workOrderId" className={`${input} sm:col-span-2`} required defaultValue="">
              <option value="" disabled>Select active Work Order</option>
              {data.workOrders.filter((order) => !["Completed", "Cancelled"].includes(order.status)).map((order) => (
                <option key={order.id} value={order.id}>{order.workOrderNumber} · {order.itemName}</option>
              ))}
            </select>
            <select name="fromStage" className={input}>
              {productionStages.map((stage) => <option key={stage}>{stage}</option>)}
            </select>
            <input name="handoverDate" type="date" className={input} defaultValue={date} required />
            <select name="fromEmployeeId" className={input} defaultValue="">
              <option value="">Sender not selected</option>
              {data.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </select>
            <select name="toEmployeeId" className={input} defaultValue="">
              <option value="">Receiver not selected</option>
              {data.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </select>
            <input name="sentPairs" type="number" min="1" className={input} placeholder="Sent pairs" required />
            <input name="receivedPairs" type="number" min="0" className={input} placeholder="Received pairs" required />
            <input
              name="receivedSizeBreakdown"
              className={`${input} sm:col-span-2`}
              placeholder="Received sizes: 36:10, 37:15"
            />
            <input name="note" className={`${input} sm:col-span-2`} placeholder="Difference/reason note" />
          </div>
          <FormSubmitButton className={`${button} mt-4`} pendingLabel="Saving handover…">Save handover</FormSubmitButton>
        </form>

        <div className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">Recent handovers</h2>
          <div className="mt-4 space-y-3">
            {data.handovers.map((handover) => (
              <article key={handover.id} className="rounded-xl border border-brand-green-line bg-brand-paper-deep p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-brand-green-ink">{handover.workOrderNumber}</p>
                    <p className="mt-1 text-brand-muted">{handover.fromStage} → {handover.toStage}</p>
                    <p className="mt-1 text-xs text-brand-muted">
                      {handover.fromEmployeeName || "Sender"} → {handover.toEmployeeName || "Receiver"} · {handover.handoverDate}
                    </p>
                    {Object.keys(handover.receivedSizeBreakdown).length ? (
                      <p className="mt-1 text-xs text-brand-muted">
                        Sizes: {Object.entries(handover.receivedSizeBreakdown).map(([size, pairs]) => `${size}:${pairs}`).join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="font-black">{handover.sentPairs} → {handover.receivedPairs}</p>
                    <p className={`mt-1 text-xs font-black ${handover.signal === "Matched" ? "text-brand-green" : "text-brand-clay"}`}>
                      {handover.signal}{handover.difference ? ` ${handover.difference}` : ""}
                    </p>
                  </div>
                </div>
              </article>
            ))}
            {data.handovers.length === 0 ? <p className="text-sm text-brand-muted">No stage handover yet.</p> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <OfflineProductionWorkForm
          action={createWorkEntryAction}
          className={card}
          today={date}
          stages={[...productionStages]}
          workOrders={data.workOrders
            .filter((order) => !["Completed", "Cancelled"].includes(order.status))
            .map((order) => ({
              id: order.id,
              label: `${order.workOrderNumber} · ${order.itemName} · ${order.colour} · current ${order.currentStage}`,
            }))}
          employees={data.employees.map((employee) => ({
            id: employee.id,
            label: `${employee.name} · ${employee.id}`,
          }))}
          items={activeItems
            .filter((item) => item.productionType !== "Resale")
            .map((item) => ({ id: item.id, label: item.name }))}
        />

        <form action={createWorkerPaymentAction} className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">7. Worker cash</h2>
          <p className="mt-1 text-sm text-brand-muted">Cash paid is separate from work earned and automatically reduces the balance.</p>
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
              <input
                name="settlementDate"
                type="date"
                defaultValue={reportDate}
                className="min-h-11 rounded-xl border border-brand-green-line bg-brand-paper px-3 text-xs font-bold"
              />
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
              className="rounded-xl border border-brand-green-line bg-brand-paper-deep p-4 transition hover:border-brand-green"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-black text-brand-green-ink">{row.employeeName}</p>
                <p className={`text-sm font-black ${row.closingBalance >= 0 ? "text-brand-green" : "text-brand-clay"}`}>
                  {row.closingBalance >= 0 ? money(row.payable) : `Advance ${money(row.advanceBalance)}`}
                </p>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
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

      <div className={card}>
        <h2 className="text-lg font-black text-brand-green-ink">Worker balance</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.balances.map((row) => (
            <Link
              key={row.employeeId}
              href={`/admin/operations/production-accounts/worker/${encodeURIComponent(row.employeeId)}`}
              className="rounded-xl border border-brand-green-line bg-brand-paper-deep p-4 transition hover:border-brand-green"
            >
              <p className="font-black text-brand-green-ink">{row.employeeName}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
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

      <div className="grid gap-5 xl:grid-cols-2">
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
    </section>
  );
}
