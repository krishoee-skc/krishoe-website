import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductionWorkOrderDetail } from "@/lib/production-accounting";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Work Order Tracking | KRISHOE Admin" };

function money(value: number) {
  return `Rs. ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
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
          <p className="mt-2 text-sm text-gray-500">{order.itemName} · {order.colour} · {order.plannedPairs} pairs</p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
          <Image
            src={`/api/admin/operations/work-order/${encodeURIComponent(order.id)}/qr`}
            alt={`${order.workOrderNumber} QR`}
            width={104}
            height={104}
            unoptimized
          />
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-gray-500">Scan lot</p>
            <p className="mt-1 text-sm font-black text-brand-green-ink">{order.status}</p>
            <p className="mt-1 text-xs text-gray-500">Current: {order.currentStage}</p>
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Priority", order.priority],
          ["Due date", order.dueDate || "Not set"],
          ["Created by", order.createdBy],
          ["QC good", `${detail.qcSummary.goodPairs} pairs`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{label}</p>
            <p className="mt-2 font-black text-brand-green-ink">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-black text-brand-green-ink">Size plan</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(order.sizeBreakdown).map(([size, pairs]) => (
            <span key={size} className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm font-bold">
              {size}: {pairs}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-black text-brand-green-ink">Stage progress</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {detail.stageProgress.map((row) => (
            <article key={row.stage} className={`rounded-xl border p-4 ${
              row.complete ? "border-emerald-200 bg-emerald-50" : "border-gray-100 bg-gray-50"
            }`}>
              <p className="font-black text-brand-green-ink">{row.stage}</p>
              <p className="mt-3 text-xl font-black text-brand-green">{row.goodPairs}/{order.plannedPairs}</p>
              <p className="mt-1 text-xs text-gray-500">Reject {row.rejectedPairs} · Wage {money(row.wage)}</p>
              <p className="mt-2 text-xs font-black uppercase tracking-wider">{row.complete ? "Complete" : "Pending"}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-black text-brand-green-ink">Worker output history</h2>
          <div className="mt-4 space-y-3">
            {detail.work.map((row) => (
              <article key={row.id} className="rounded-xl bg-gray-50 p-3 text-sm">
                <div className="flex justify-between gap-3">
                  <div><p className="font-black">{row.employeeName} · {row.stage}</p><p className="mt-1 text-gray-500">{row.workDate} · {row.totalPairs} pairs · reject {row.rejectedPairs}</p></div>
                  <p className="font-black text-brand-green">{money(row.earnedWage)}</p>
                </div>
              </article>
            ))}
            {detail.work.length === 0 ? <p className="text-sm text-gray-500">No worker output yet.</p> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-black text-brand-green-ink">Handover timeline</h2>
          <div className="mt-4 space-y-3">
            {detail.handovers.map((row) => (
              <article key={row.id} className="rounded-xl bg-gray-50 p-3 text-sm">
                <div className="flex justify-between gap-3">
                  <div><p className="font-black">{row.fromStage} → {row.toStage}</p><p className="mt-1 text-gray-500">{row.fromEmployeeName || "Sender"} → {row.toEmployeeName || "Receiver"} · {row.handoverDate}</p></div>
                  <div className="text-right"><p className="font-black">{row.sentPairs} → {row.receivedPairs}</p><p className={row.signal === "Matched" ? "text-xs font-black text-brand-green" : "text-xs font-black text-brand-clay"}>{row.signal}</p></div>
                </div>
              </article>
            ))}
            {detail.handovers.length === 0 ? <p className="text-sm text-gray-500">No handover yet.</p> : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-black text-emerald-950">Packing/QC & stock history</h2>
        <div className="mt-4 space-y-3">
          {detail.qcPostings.map((row) => (
            <article key={row.id} className="rounded-xl bg-white p-3 text-sm">
              <p className="font-black text-brand-green-ink">{row.approvalReference} · +{row.totalPairs} good pairs</p>
              <p className="mt-1 text-gray-500">{row.qcDate} · reject {row.rejectedPairs} · {row.packingEmployeeName || "Owner verified"} · stock movement {row.stockMovementId}</p>
            </article>
          ))}
          {detail.qcPostings.length === 0 ? <p className="text-sm text-emerald-800">Not posted to finished stock yet.</p> : null}
        </div>
      </div>
    </section>
  );
}
