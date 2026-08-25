import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import { getProductionWorkOrderDetail } from "@/lib/production-accounting";
import {
  cancelWorkOrderAction,
  createCctvReferenceAction,
  createMaterialConsumptionAction,
  reverseHandoverAction,
  reverseMaterialConsumptionAction,
  reversePackingQcAction,
  updateWorkOrderScheduleAction,
} from "../../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Work Order Tracking | KRISHOE Admin" };

function money(value: number) {
  return `Rs. ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function nepalToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(new Date());
}

function nepalDateTime(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((row) => row.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function nepalDisplay(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kathmandu",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getProductionWorkOrderDetail(id);
  if (!detail) notFound();
  const { order } = detail;

  return (
    <section className="mx-auto max-w-6xl space-y-5 p-4 pb-28 sm:p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/admin/operations/production-accounts" className="text-sm font-bold text-brand-green underline underline-offset-4">
            ← Production accounts
          </Link>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-brand-green">Work Order / Lot</p>
          <h1 className="mt-1 text-2xl font-black text-brand-green-ink">{order.workOrderNumber}</h1>
          <p className="mt-2 text-sm text-brand-muted">{order.itemName} · {order.colour} · {order.plannedPairs} pairs</p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-brand-green-line bg-brand-paper p-3 shadow-sm">
          <Image
            src={`/api/admin/operations/work-order/${encodeURIComponent(order.id)}/qr`}
            alt={`${order.workOrderNumber} QR`}
            width={104}
            height={104}
            unoptimized
          />
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-brand-muted">Scan lot</p>
            <p className="mt-1 text-sm font-black text-brand-green-ink">{order.status}</p>
            <p className="mt-1 text-xs text-brand-muted">Current: {order.currentStage}</p>
          </div>
        </div>
      </header>

      {!["Completed", "Cancelled"].includes(order.status) ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <form action={updateWorkOrderScheduleAction} className="rounded-2xl border border-brand-green-line bg-brand-paper p-4 shadow-sm">
            <h2 className="font-black text-brand-green-ink">Schedule control</h2>
            <p className="mt-1 text-xs leading-5 text-brand-muted">Update planning details without changing item, sizes or production history.</p>
            <input type="hidden" name="workOrderId" value={order.id} />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input name="dueDate" type="date" defaultValue={order.dueDate} className="min-h-11 rounded-xl border border-brand-green-line px-3 text-sm" />
              <select name="priority" defaultValue={order.priority} className="min-h-11 rounded-xl border border-brand-green-line bg-brand-paper px-3 text-sm">
                <option>Normal</option><option>High</option><option>Urgent</option>
              </select>
            </div>
            <FormSubmitButton className="mt-3 min-h-11 rounded-xl bg-brand-green px-4 text-xs font-black text-white" pendingLabel="Updating schedule…">
              Update schedule
            </FormSubmitButton>
          </form>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <h2 className="font-black text-red-950">Stop this Work Order</h2>
            <p className="mt-1 text-xs leading-5 text-red-900">
              Work, wage, handover and material history remain. Active QC/stock must be reversed first.
            </p>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-black text-red-800">Open cancellation control</summary>
              <form action={cancelWorkOrderAction} className="mt-3 space-y-3">
                <input type="hidden" name="workOrderId" value={order.id} />
                <input name="reason" minLength={5} className="min-h-11 w-full rounded-xl border border-red-200 bg-brand-paper px-3 text-sm" placeholder="Reason for cancellation" required />
                <label className="flex items-center gap-2 text-xs font-bold text-red-900">
                  <input name="cancelConfirmed" type="checkbox" value="yes" required className="size-4 accent-red-700" />
                  I confirm production on this lot must stop.
                </label>
                <FormSubmitButton className="min-h-11 rounded-xl bg-red-700 px-4 text-xs font-black text-white" pendingLabel="Cancelling Work Order…">
                  Cancel Work Order
                </FormSubmitButton>
              </form>
            </details>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Priority", order.priority],
          ["Due date", order.dueDate || "Not set"],
          ["Created by", order.createdBy],
          ["QC good", `${detail.qcSummary.goodPairs} pairs`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-brand-green-line bg-brand-paper p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-muted">{label}</p>
            <p className="mt-2 font-black text-brand-green-ink">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-brand-green-line bg-brand-paper p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-black text-brand-green-ink">Size plan</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(order.sizeBreakdown).map(([size, pairs]) => (
            <span key={size} className="rounded-full border border-brand-green-line bg-brand-paper-deep px-3 py-1 text-sm font-bold">
              {size}: {pairs}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-800">CCTV trace</p>
            <h2 className="mt-1 text-lg font-black text-brand-green-ink">Camera time reference</h2>
            <p className="mt-1 text-sm leading-6 text-brand-muted">
              Save only the camera zone and time window. Footage remains in the camera system.
            </p>
          </div>
          <Link href="/admin/security" className="w-fit text-xs font-black text-sky-800 underline underline-offset-4">
            Open camera apps
          </Link>
        </div>
        <form action={createCctvReferenceAction} className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <input type="hidden" name="workOrderId" value={order.id} />
          <select name="stage" defaultValue={order.currentStage} className="min-h-11 rounded-xl border border-sky-200 bg-brand-paper px-3 text-sm">
            {["Upper", "Fiber Preparation", "Fiber Silai", "Bottom Final", "Packing / QC"].map((stage) => (
              <option key={stage}>{stage}</option>
            ))}
          </select>
          <input name="cameraZone" className="min-h-11 rounded-xl border border-sky-200 bg-brand-paper px-3 text-sm" placeholder="Camera zone, e.g. Fiber Silai table" required />
          <input name="cctvReference" className="min-h-11 rounded-xl border border-sky-200 bg-brand-paper px-3 text-sm" placeholder="Camera/DVR reference (optional)" />
          <label className="text-xs font-bold text-brand-green-ink">
            Start time
            <input name="windowStart" type="datetime-local" defaultValue={nepalDateTime()} className="mt-1 min-h-11 w-full rounded-xl border border-sky-200 bg-brand-paper px-3 text-sm" required />
          </label>
          <label className="text-xs font-bold text-brand-green-ink">
            End time
            <input name="windowEnd" type="datetime-local" defaultValue={nepalDateTime()} className="mt-1 min-h-11 w-full rounded-xl border border-sky-200 bg-brand-paper px-3 text-sm" required />
          </label>
          <input name="evidenceReference" className="min-h-11 rounded-xl border border-sky-200 bg-brand-paper px-3 text-sm" placeholder="Evidence link/photo reference (optional)" />
          <input name="note" className="min-h-11 rounded-xl border border-sky-200 bg-brand-paper px-3 text-sm sm:col-span-2" placeholder="Incident / verification note" />
          <FormSubmitButton className="min-h-11 rounded-xl bg-sky-800 px-4 text-xs font-black text-white" pendingLabel="Saving CCTV reference…">
            Save camera reference
          </FormSubmitButton>
        </form>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {detail.cctvReferences.map((row) => (
            <article key={row.id} className="rounded-xl border border-sky-100 bg-brand-paper p-3 text-sm">
              <p className="font-black text-brand-green-ink">{row.stage} · {row.cameraZone}</p>
              <p className="mt-1 text-brand-muted">{nepalDisplay(row.windowStart)} → {nepalDisplay(row.windowEnd)}</p>
              <p className="mt-1 text-xs text-brand-muted">
                {row.cctvReference || "No DVR reference"} · recorded by {row.recordedBy}
              </p>
              {row.evidenceReference ? (
                /^https?:\/\//i.test(row.evidenceReference)
                  ? <a href={row.evidenceReference} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-black text-sky-800 underline">Open evidence</a>
                  : <p className="mt-2 text-xs font-bold text-sky-800">Evidence: {row.evidenceReference}</p>
              ) : null}
              {row.note ? <p className="mt-2 text-xs text-brand-muted">{row.note}</p> : null}
            </article>
          ))}
          {detail.cctvReferences.length === 0 ? (
            <p className="text-sm text-sky-900">No camera reference recorded for this Work Order.</p>
          ) : null}
        </div>
      </div>

      <div className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${
        detail.materialSummary.shortageCount > 0
          ? "border-amber-200 bg-amber-50"
          : "border-emerald-200 bg-emerald-50"
      }`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-green">BOM material plan</p>
            <h2 className="mt-1 text-lg font-black text-brand-green-ink">Required raw materials</h2>
            <p className="mt-1 text-sm text-brand-muted">
              Planned pairs × material per pair + recipe wastage. This is planning only; stock is not consumed yet.
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className={`text-sm font-black ${detail.materialSummary.shortageCount ? "text-amber-900" : "text-emerald-900"}`}>
              {detail.materialSummary.shortageCount
                ? `${detail.materialSummary.shortageCount} shortage warning`
                : "All recipe materials ready"}
            </p>
            <p className="mt-1 text-xs font-bold text-brand-muted">
              Estimated material {money(detail.materialSummary.estimatedCost)}
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {detail.materialPlan.map((row) => (
            <article key={row.materialId} className="rounded-xl border border-white/80 bg-brand-paper p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-brand-green-ink">{row.materialName}</p>
                  <p className="mt-1 text-xs text-brand-muted">
                    {row.quantityPerPair} {row.unit}/pair + {row.wastagePercent}% wastage
                  </p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-black ${
                  row.signal === "Ready"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-900"
                }`}>
                  {row.signal}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div><span className="text-brand-muted">Required</span><p className="mt-1 font-black">{row.requiredQuantity} {row.unit}</p></div>
                <div><span className="text-brand-muted">Available</span><p className="mt-1 font-black">{row.availableQuantity} {row.unit}</p></div>
                <div><span className="text-brand-muted">Short</span><p className={`mt-1 font-black ${row.shortageQuantity ? "text-brand-clay" : "text-brand-green"}`}>{row.shortageQuantity} {row.unit}</p></div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-brand-paper-deep p-2 text-xs">
                <div><span className="text-brand-muted">Actual used</span><p className="mt-1 font-black">{row.actualConsumed} {row.unit}</p></div>
                <div><span className="text-brand-muted">Plan remaining</span><p className="mt-1 font-black">{row.plannedRemaining} {row.unit}</p></div>
              </div>
              <details className="mt-3 border-t border-brand-green-line pt-3">
                <summary className="cursor-pointer text-xs font-black text-brand-green">
                  Record actual consumption
                </summary>
                <form action={createMaterialConsumptionAction} className="mt-3 grid gap-3 rounded-xl bg-emerald-50 p-3 sm:grid-cols-2">
                  <input type="hidden" name="workOrderId" value={order.id} />
                  <input type="hidden" name="materialId" value={row.materialId} />
                  <input
                    type="hidden"
                    name="sourceSubmissionKey"
                    value={`matuse:${order.id}:${row.materialId}:${crypto.randomUUID()}`}
                  />
                  <label className="text-xs font-bold text-brand-green-ink">
                    Used quantity ({row.unit})
                    <input name="quantity" type="number" min="0" step="0.001" className="mt-1 min-h-11 w-full rounded-xl border border-emerald-200 bg-brand-paper px-3" required />
                  </label>
                  <label className="text-xs font-bold text-brand-green-ink">
                    Wastage ({row.unit})
                    <input name="wastage" type="number" min="0" step="0.001" defaultValue="0" className="mt-1 min-h-11 w-full rounded-xl border border-emerald-200 bg-brand-paper px-3" />
                  </label>
                  <input name="consumptionDate" type="date" defaultValue={nepalToday()} className="min-h-11 rounded-xl border border-emerald-200 bg-brand-paper px-3 text-sm" required />
                  <input name="note" className="min-h-11 rounded-xl border border-emerald-200 bg-brand-paper px-3 text-sm" placeholder="Issue/usage note" />
                  <FormSubmitButton className="min-h-11 rounded-xl bg-brand-green px-4 text-xs font-black text-white sm:col-span-2" pendingLabel="Recording material…">
                    Owner approve consumption
                  </FormSubmitButton>
                </form>
              </details>
            </article>
          ))}
          {detail.materialPlan.length === 0 ? (
            <p className="text-sm text-amber-900">
              No material recipe is linked to this item yet. Add its BOM in Production Accounts before issuing materials.
            </p>
          ) : null}
        </div>
      </div>

      {detail.materialConsumptions.length > 0 ? (
        <div className="rounded-2xl border border-brand-green-line bg-brand-paper p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-black text-brand-green-ink">Actual material consumption history</h2>
          <div className="mt-4 space-y-3">
            {detail.materialConsumptions.map((row) => (
              <article key={row.id} className="rounded-xl border border-brand-green-line bg-brand-paper-deep p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-brand-green-ink">{row.materialName}</p>
                    <p className="mt-1 text-brand-muted">
                      {row.consumptionDate} · used {row.quantity} {row.unit} · wastage {row.wastage} {row.unit}
                    </p>
                    <p className="mt-1 text-xs text-brand-muted">Approved by {row.approvedBy}{row.note ? ` · ${row.note}` : ""}</p>
                  </div>
                  <p className="font-black text-brand-clay">−{row.total} {row.unit}</p>
                </div>
                <details className="mt-3 border-t border-brand-green-line pt-3">
                  <summary className="cursor-pointer text-xs font-black text-brand-clay">Correct this material entry</summary>
                  <form action={reverseMaterialConsumptionAction} className="mt-3 space-y-3 rounded-xl bg-red-50 p-3">
                    <input type="hidden" name="consumptionId" value={row.id} />
                    <input name="reason" minLength={5} className="min-h-11 w-full rounded-xl border border-red-200 bg-brand-paper px-3 text-sm" placeholder="Reason for reversal" required />
                    <label className="flex items-center gap-2 text-xs font-bold text-red-900">
                      <input name="reverseConfirmed" type="checkbox" value="yes" required className="size-4 accent-red-700" />
                      I confirm this material usage entry is incorrect.
                    </label>
                    <FormSubmitButton className="min-h-11 rounded-xl bg-red-700 px-4 text-xs font-black text-white" pendingLabel="Reversing material…">
                      Reverse material usage
                    </FormSubmitButton>
                  </form>
                </details>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-brand-green-line bg-brand-paper p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-black text-brand-green-ink">Stage progress</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {detail.stageProgress.map((row) => (
            <article key={row.stage} className={`rounded-xl border p-4 ${
              row.complete ? "border-emerald-200 bg-emerald-50" : "border-brand-green-line bg-brand-paper-deep"
            }`}>
              <p className="font-black text-brand-green-ink">{row.stage}</p>
              <p className="mt-3 text-xl font-black text-brand-green">{row.goodPairs}/{order.plannedPairs}</p>
              <p className="mt-1 text-xs text-brand-muted">Reject {row.rejectedPairs} · Wage {money(row.wage)}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {Object.entries(row.sizeProgress).map(([size, pairs]) => (
                  <span key={size} className="rounded-full bg-brand-paper px-2 py-1 text-[11px] font-bold text-brand-muted">
                    {size}: {pairs}/{order.sizeBreakdown[size]}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs font-black uppercase tracking-wider">{row.complete ? "Complete" : "Pending"}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-brand-green-line bg-brand-paper p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-black text-brand-green-ink">Worker output history</h2>
          <div className="mt-4 space-y-3">
            {detail.work.map((row) => (
              <article key={row.id} className="rounded-xl bg-brand-paper-deep p-3 text-sm">
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-black">{row.employeeName} · {row.stage}</p>
                    <p className="mt-1 text-brand-muted">{row.workDate} · {row.totalPairs} pairs · reject {row.rejectedPairs}</p>
                    <p className="mt-1 text-xs text-brand-muted">
                      {Object.entries(row.sizeBreakdown).map(([size, pairs]) => `${size}:${pairs}`).join(", ")}
                    </p>
                  </div>
                  <p className="font-black text-brand-green">{money(row.earnedWage)}</p>
                </div>
              </article>
            ))}
            {detail.work.length === 0 ? <p className="text-sm text-brand-muted">No worker output yet.</p> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-brand-green-line bg-brand-paper p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-black text-brand-green-ink">Handover timeline</h2>
          <div className="mt-4 space-y-3">
            {detail.handovers.map((row) => (
              <article key={row.id} className="rounded-xl bg-brand-paper-deep p-3 text-sm">
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-black">{row.fromStage} → {row.toStage}</p>
                    <p className="mt-1 text-brand-muted">{row.fromEmployeeName || "Sender"} → {row.toEmployeeName || "Receiver"} · {row.handoverDate}</p>
                    <p className="mt-1 text-xs text-brand-muted">
                      Sizes: {Object.entries(row.receivedSizeBreakdown).map(([size, pairs]) => `${size}:${pairs}`).join(", ") || "Not recorded"}
                    </p>
                  </div>
                  <div className="text-right"><p className="font-black">{row.sentPairs} → {row.receivedPairs}</p><p className={row.signal === "Matched" ? "text-xs font-black text-brand-green" : "text-xs font-black text-brand-clay"}>{row.signal}</p></div>
                </div>
                <details className="mt-3 border-t border-brand-green-line pt-3">
                  <summary className="cursor-pointer text-xs font-black text-brand-clay">
                    Correct this handover
                  </summary>
                  <form action={reverseHandoverAction} className="mt-3 space-y-3 rounded-xl bg-red-50 p-3">
                    <input type="hidden" name="handoverId" value={row.id} />
                    <p className="text-xs leading-5 text-red-900">
                      The record stays in audit history but is removed from active quantity and size calculations.
                    </p>
                    <input
                      name="reason"
                      minLength={5}
                      className="min-h-11 w-full rounded-xl border border-red-200 bg-brand-paper px-3 text-sm"
                      placeholder="Reason for handover reversal"
                      required
                    />
                    <label className="flex items-center gap-2 text-xs font-bold text-red-900">
                      <input name="reverseConfirmed" type="checkbox" value="yes" required className="size-4 accent-red-700" />
                      I confirm this handover is incorrect.
                    </label>
                    <FormSubmitButton className="min-h-11 rounded-xl bg-red-700 px-4 text-xs font-black text-white" pendingLabel="Reversing handover…">
                      Reverse handover
                    </FormSubmitButton>
                  </form>
                </details>
              </article>
            ))}
            {detail.handovers.length === 0 ? <p className="text-sm text-brand-muted">No handover yet.</p> : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-black text-emerald-950">Packing/QC & stock history</h2>
        <div className="mt-4 space-y-3">
          {detail.qcPostings.map((row) => (
            <article key={row.id} className="rounded-xl bg-brand-paper p-3 text-sm">
              <p className="font-black text-brand-green-ink">{row.approvalReference} · +{row.totalPairs} good pairs</p>
              <p className="mt-1 text-brand-muted">{row.qcDate} · reject {row.rejectedPairs} · {row.packingEmployeeName || "Owner verified"} · stock movement {row.stockMovementId}</p>
              <p className="mt-1 text-xs text-brand-muted">
                Sizes: {Object.entries(row.sizeBreakdown).map(([size, pairs]) => `${size}:${pairs}`).join(", ")}
              </p>
              <details className="mt-3 border-t border-brand-green-line pt-3">
                <summary className="cursor-pointer text-xs font-black text-brand-clay">
                  Correct this QC/stock posting
                </summary>
                <form action={reversePackingQcAction} className="mt-3 space-y-3 rounded-xl bg-red-50 p-3">
                  <input type="hidden" name="postingId" value={row.id} />
                  <p className="text-xs leading-5 text-red-900">
                    This removes {row.totalPairs} pairs from finished stock and returns the Work Order to Ready for QC.
                    It is blocked if those pairs have already left available stock.
                  </p>
                  <input
                    name="reason"
                    minLength={5}
                    className="min-h-11 w-full rounded-xl border border-red-200 bg-brand-paper px-3 text-sm"
                    placeholder="Reason for QC/stock reversal"
                    required
                  />
                  <label className="flex items-center gap-2 text-xs font-bold text-red-900">
                    <input name="reverseConfirmed" type="checkbox" value="yes" required className="size-4 accent-red-700" />
                    I confirm this QC and stock posting is incorrect.
                  </label>
                  <FormSubmitButton
                    className="min-h-11 rounded-xl bg-red-700 px-4 text-xs font-black text-white"
                    pendingLabel="Reversing stock…"
                  >
                    Reverse QC & stock
                  </FormSubmitButton>
                </form>
              </details>
            </article>
          ))}
          {detail.qcPostings.length === 0 ? <p className="text-sm text-emerald-800">Not posted to finished stock yet.</p> : null}
        </div>
      </div>
    </section>
  );
}
