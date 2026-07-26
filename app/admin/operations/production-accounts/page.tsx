import type { Metadata } from "next";
import Link from "next/link";
import ExportButton from "@/components/admin/ExportButton";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
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
} from "./actions";
import { getProductionAccountingSnapshot, getProductionControlSummary } from "@/lib/production-accounting";
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
  const [data, control] = await Promise.all([
    getProductionAccountingSnapshot(),
    getProductionControlSummary(),
  ]);
  const activeItems = data.items.filter((item) => item.status === "Active");
  const date = today();

  return (
    <section className="mx-auto max-w-7xl space-y-5 p-4 pb-28 sm:p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green">Factory accounts</p>
        <h1 className="mt-1 text-2xl font-black text-brand-green-ink">Production, wages & kharcha</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
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
                : "min-h-10 rounded-full border border-gray-200 bg-white px-4 text-xs font-black text-brand-green-ink"}
            >
              {label} CSV
            </ExportButton>
          ))}
        </div>
      </header>

      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <p className="font-black text-blue-950">Friday statement workflow</p>
        <p className="mt-1 text-sm leading-6 text-blue-800">
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
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-black text-brand-green-ink">{value}</p>
            <p className="mt-2 text-xs font-bold text-gray-500">{detail}</p>
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

      <div className={card}>
        <h2 className="text-lg font-black text-brand-green-ink">Stage-wise pending Work Orders</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {["Upper", "Fiber Preparation", "Fiber Silai", "Bottom Final", "Packing / QC"].map((stage) => (
            <div key={stage} className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs font-bold text-gray-500">{stage}</p>
              <p className="mt-1 text-xl font-black text-brand-green-ink">{control.stagePending[stage] ?? 0}</p>
            </div>
          ))}
        </div>
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

      <form action={mapProductionItemAction} className={card}>
        <h2 className="text-lg font-black text-brand-green-ink">Stock catalog mapping</h2>
        <p className="mt-1 text-sm text-gray-500">
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
            <p className="mt-1 max-w-3xl text-sm text-gray-500">
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
                  <p className="mt-1 text-xs text-gray-500">
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
            <p className="text-sm text-gray-500">No Packing/QC stock posting yet.</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <form action={saveItemMaterialAction} className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">3. Material recipe per pair</h2>
          <p className="mt-1 text-sm text-gray-500">
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
          <p className="mt-1 text-sm text-gray-500">
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
            <article key={cost.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-brand-green-ink">{cost.itemName}</p>
                  <p className="mt-1 text-xs text-gray-500">Effective {cost.effectiveFrom} · Owner {cost.approvedBy}</p>
                </div>
                <p className="text-lg font-black text-brand-green">{money(cost.makingCostPerPair)}</p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div><span className="text-gray-500">Material</span><p className="font-black">{money(cost.materialCostPerPair)}</p></div>
                <div><span className="text-gray-500">Wages</span><p className="font-black">{money(cost.laborCostPerPair)}</p></div>
                <div><span className="text-gray-500">Wholesale</span><p className="font-black">{money(cost.wholesalePrice)}</p></div>
                <div><span className="text-gray-500">Retail</span><p className="font-black">{money(cost.retailPrice)}</p></div>
              </div>
            </article>
          ))}
          {data.costCards.length === 0 ? <p className="text-sm text-gray-500">No approved product cost sheet yet.</p> : null}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <form action={createWorkOrderAction} className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">5. New Work Order / Lot</h2>
          <p className="mt-1 text-sm text-gray-500">Plan colour, mixed sizes, total pairs and due date before production starts.</p>
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
                className="block rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm transition hover:border-brand-green"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-brand-green-ink">{order.workOrderNumber} · {order.itemName}</p>
                    <p className="mt-1 text-gray-500">{order.colour} · {order.plannedPairs} pairs · due {order.dueDate || "not set"}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-black ${
                    order.priority === "Urgent" ? "bg-red-50 text-red-800" :
                    order.priority === "High" ? "bg-amber-50 text-amber-800" : "bg-white text-gray-700"
                  }`}>{order.priority}</span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="font-bold text-brand-green">Current: {order.currentStage}</p>
                  <p className="text-xs font-bold text-gray-500">{order.status}</p>
                </div>
                <p className="mt-3 text-xs font-black text-brand-green">Open lot history & QR →</p>
              </Link>
            ))}
            {data.workOrders.length === 0 ? <p className="text-sm text-gray-500">No Work Order yet.</p> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <form action={createHandoverAction} className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">Stage handover</h2>
          <p className="mt-1 text-sm text-gray-500">Record who sent, who received and any quantity difference.</p>
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
            <input name="note" className={`${input} sm:col-span-2`} placeholder="Difference/reason note" />
          </div>
          <FormSubmitButton className={`${button} mt-4`} pendingLabel="Saving handover…">Save handover</FormSubmitButton>
        </form>

        <div className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">Recent handovers</h2>
          <div className="mt-4 space-y-3">
            {data.handovers.map((handover) => (
              <article key={handover.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-brand-green-ink">{handover.workOrderNumber}</p>
                    <p className="mt-1 text-gray-500">{handover.fromStage} → {handover.toStage}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {handover.fromEmployeeName || "Sender"} → {handover.toEmployeeName || "Receiver"} · {handover.handoverDate}
                    </p>
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
            {data.handovers.length === 0 ? <p className="text-sm text-gray-500">No stage handover yet.</p> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <form action={createWorkEntryAction} className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">6. Completed work</h2>
          <p className="mt-1 text-sm text-gray-500">Enter only when the worker hands over completed work. Owner approval is immediate.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select name="workOrderId" className={`${input} sm:col-span-2`} defaultValue="">
              <option value="">No Work Order link (legacy/manual)</option>
              {data.workOrders.filter((order) => !["Completed", "Cancelled"].includes(order.status)).map((order) => (
                <option key={order.id} value={order.id}>
                  {order.workOrderNumber} · {order.itemName} · {order.colour} · current {order.currentStage}
                </option>
              ))}
            </select>
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
          <h2 className="text-lg font-black text-brand-green-ink">7. Worker cash</h2>
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
