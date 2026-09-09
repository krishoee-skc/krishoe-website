import type { Metadata } from "next";
import { money } from "@/lib/format-money";
import Link from "next/link";
import ExportButton from "@/components/admin/ExportButton";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import NepaliDateFieldUncontrolled from "@/components/admin/NepaliDateFieldUncontrolled";
import {
  approveCostCardAction,
  approvePackingQcAction,
  createHandoverAction,
  createProductionItemAction,
  createWorkOrderAction,
  mapProductionItemAction,
  saveItemMaterialAction,
} from "../actions";
import {
  getProductionAccountingSnapshot,
  getProductionControlSummary,
} from "@/lib/production-accounting";
import { productionStages } from "@/lib/production-accounting-rules";
import WagesNav from "../_components/wages-nav";

export const metadata: Metadata = { title: "Lots and cost | KRISHOE Admin" };
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
 * Work Orders, handovers, QC into stock, and what a pair costs to make.
 *
 * None of this has been used yet — every one of these tables is empty — but it
 * is built, and it is where the shop goes next. Together on one page, out of
 * the daily path without being out of reach.
 */
export default async function WagesLotsPage() {
  const date = today();
  const [data, control] = await Promise.all([
    getProductionAccountingSnapshot(),
    getProductionControlSummary(),
  ]);
  const activeItems = data.items.filter((item) => item.status === "Active");

  return (
    <section className="mx-auto max-w-7xl space-y-5 p-4 pb-28 sm:p-6">
      <header className="flex flex-col gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green">Factory accounts</p>
          <h1 className="mt-1 text-2xl font-black text-brand-green-ink">Lots &amp; cost</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-muted">Work Orders, stage handovers, QC into finished stock, and the cost of a pair. Not started yet — ready when the shop is.</p>
        </div>
        <WagesNav />
      </header>

      <div className="flex flex-wrap gap-2">
        <ExportButton href="/api/admin/operations/production-export?type=work-orders" className="min-h-10 rounded-full bg-brand-green px-4 text-xs font-black text-white">Work Orders CSV</ExportButton>
        <ExportButton href="/api/admin/operations/production-export?type=handovers" className="min-h-10 rounded-full border border-brand-green-line bg-brand-paper px-4 text-xs font-black text-brand-green-ink">Handovers CSV</ExportButton>
        <ExportButton href="/api/admin/operations/production-export?type=qc-stock" className="min-h-10 rounded-full border border-brand-green-line bg-brand-paper px-4 text-xs font-black text-brand-green-ink">QC &amp; stock CSV</ExportButton>
        <ExportButton href="/api/admin/operations/production-export?type=cost-cards" className="min-h-10 rounded-full border border-brand-green-line bg-brand-paper px-4 text-xs font-black text-brand-green-ink">Cost cards CSV</ExportButton>
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
        <form action={createWorkOrderAction} className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">5. New Work Order / Lot</h2>
          <p className="mt-1 text-sm text-brand-muted">Plan colour, mixed sizes, total pairs and due date before production starts.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select aria-label="Item" name="itemId" className={input} required defaultValue="">
              <option value="" disabled>Select manufactured item</option>
              {activeItems.filter((item) => item.productionType !== "Resale").map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <input name="colour" className={input} placeholder="Colour, e.g. Black" required />
            <input name="plannedPairs" type="number" min="1" className={input} placeholder="Planned total pairs" required />
            <input name="sizeBreakdown" className={input} placeholder="Sizes: 36:10, 37:15, 38:20" required />
            <NepaliDateFieldUncontrolled name="dueDate" />
            <select aria-label="Priority" name="priority" className={input} defaultValue="Normal">
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
                className="hover-lift block rounded-xl border border-brand-green-line bg-brand-paper-deep p-3 text-sm transition hover:border-brand-green"
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
            <select aria-label="Work order" name="workOrderId" className={`${input} sm:col-span-2`} required defaultValue="">
              <option value="" disabled>Select active Work Order</option>
              {data.workOrders.filter((order) => !["Completed", "Cancelled"].includes(order.status)).map((order) => (
                <option key={order.id} value={order.id}>{order.workOrderNumber} · {order.itemName}</option>
              ))}
            </select>
            <select aria-label="Handover from stage" name="fromStage" className={input}>
              {productionStages.map((stage) => <option key={stage}>{stage}</option>)}
            </select>
            <NepaliDateFieldUncontrolled name="handoverDate" defaultValue={date} required />
            <select aria-label="Handover from worker" name="fromEmployeeId" className={input} defaultValue="">
              <option value="">Sender not selected</option>
              {data.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </select>
            <select aria-label="Handover to worker" name="toEmployeeId" className={input} defaultValue="">
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
          <select aria-label="Work order" name="workOrderId" className={input} defaultValue="">
            <option value="">No Work Order link (legacy/manual)</option>
            {data.workOrders.filter((order) => order.status === "Ready for QC").map((order) => (
              <option key={order.id} value={order.id}>{order.workOrderNumber} · {order.itemName}</option>
            ))}
          </select>
          <select aria-label="Item" name="itemId" className={input} required defaultValue="">
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
        <form action={createProductionItemAction} className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">1. Production item</h2>
          <p className="mt-1 text-sm text-brand-muted">Create the factory item once; wages can then vary by stage.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input name="name" className={input} placeholder="Item name, e.g. Ladies Sandal" required />
            <input name="category" className={input} placeholder="Category, e.g. Sandal" />
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
        </form>
      </div>

      <form action={mapProductionItemAction} className={card}>
        <h2 className="text-lg font-black text-brand-green-ink">Stock catalog mapping</h2>
        <p className="mt-1 text-sm text-brand-muted">
          Link a factory item to the exact shop/POS product. This prepares safe QC-approved stock posting; it does not change stock yet.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <select aria-label="Item" name="itemId" className={input} required defaultValue="">
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
      </form>

      <div className="grid gap-5 xl:grid-cols-2">
        <form action={saveItemMaterialAction} className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">3. Material recipe per pair</h2>
          <p className="mt-1 text-sm text-brand-muted">
            Quantity uses the material&apos;s purchase unit. Example: Rexine 0.40 meter or Buckle 2 pieces per pair.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select aria-label="Item" name="itemId" className={input} required defaultValue="">
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
            <select aria-label="Item" name="itemId" className={input} required defaultValue="">
              <option value="" disabled>Select manufactured item</option>
              {activeItems.filter((item) => item.productionType !== "Resale").map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <NepaliDateFieldUncontrolled name="effectiveFrom" defaultValue={date} required />
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
    </section>
  );
}
