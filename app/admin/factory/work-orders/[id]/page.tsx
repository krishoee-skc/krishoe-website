import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import CctvReferenceForm from "@/app/admin/factory/work-orders/[id]/CctvReferenceForm";
import { requireAdminPermission } from "@/lib/admin-permissions";
import {
  factoryStages,
  factoryWorkOrderWorksheetPath,
  getFactoryData,
  getFactoryWorkOrderCosting,
} from "@/lib/factory";

export const metadata: Metadata = { title: "Lot Trace | KRISHOE Factory" };
export const dynamic = "force-dynamic";

function stageName(code: string) {
  return factoryStages.find((stage) => stage.code === code)?.name ?? code;
}

function dateTime(value: string) {
  return value ? new Date(value).toLocaleString("en-NP") : "Pending";
}

export default async function FactoryWorkOrderTracePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ cctvSaved?: string }>;
}) {
  await requireAdminPermission("factory:write");
  const { id } = await params;
  const pageParams = await searchParams;
  const factory = await getFactoryData();
  const order = factory.workOrders.find((entry) => entry.id === id);
  if (!order) notFound();

  const sizes = factory.workOrderSizes.filter((entry) => entry.workOrderId === id);
  const assignments = factory.stageAssignments
    .filter((entry) => entry.workOrderId === id)
    .sort((a, b) => a.sequence - b.sequence);
  const entries = factory.productionEntries.filter((entry) => entry.workOrderId === id);
  const handovers = factory.stageHandovers.filter((entry) => entry.workOrderId === id);
  const issues = factory.materialIssues.filter(
    (entry) => entry.workOrderId === id && entry.status !== "Cancelled",
  );
  const packing = factory.packingApprovals.find((entry) => entry.workOrderId === id);
  const verifiedEntries = entries.filter((entry) => entry.status === "Verified");
  const goodPairs = verifiedEntries.reduce((sum, entry) => sum + entry.goodPairs, 0);
  const rejectedPairs = verifiedEntries.reduce((sum, entry) => sum + entry.rejectPairs, 0);
  const reworkPairs = verifiedEntries.reduce((sum, entry) => sum + entry.reworkPairs, 0);
  const wages = verifiedEntries.reduce((sum, entry) => sum + entry.calculatedWage, 0);
  const materialCost = issues.reduce((sum, entry) => sum + entry.totalCost, 0);
  const costing = getFactoryWorkOrderCosting(factory, order);
  const productionItem = factory.items.find((entry) => entry.id === order.itemId);
  const cctvStages =
    assignments.length > 0
      ? assignments.map((assignment) => ({
          code: assignment.stageCode,
          name: stageName(assignment.stageCode),
          cameraZone: assignment.cameraZone,
        }))
      : (productionItem?.stageCodes ?? []).map((code) => ({
          code,
          name: stageName(code),
          cameraZone: "",
        }));
  const cctvReferences = factory.cctvReferences.filter(
    (entry) => entry.workOrderId === order.id,
  );

  return (
    <section className="p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <Link href="/admin/factory" className="text-sm font-black text-brand-green">
          ← Factory ERP
        </Link>
        <Link
          href={factoryWorkOrderWorksheetPath(order.id)}
          className="ml-3 inline-flex min-h-10 items-center rounded-xl border border-brand-green px-3 text-xs font-black text-brand-green print:hidden"
        >
          Print worksheet
        </Link>

        <header className="mt-4 overflow-hidden rounded-3xl bg-brand-green-ink p-5 text-white shadow-lg sm:p-8">
          <div className="grid gap-6 md:grid-cols-[1fr_180px] md:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
                KRISHOE lot trace
              </p>
              <h1 className="mt-2 text-3xl font-black">{order.workOrderNumber}</h1>
              <p className="mt-2 text-emerald-50/80">
                {order.lotNumber} · {order.itemCode} · {order.itemName}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-black">
                <span className="rounded-full bg-white/10 px-3 py-1.5">{order.color}</span>
                <span className="rounded-full bg-white/10 px-3 py-1.5">{order.totalPairs} pairs</span>
                <span className="rounded-full bg-amber-300 px-3 py-1.5 text-brand-green-ink">
                  {order.status}
                </span>
              </div>
            </div>
            <div className="rounded-2xl bg-white p-3 text-center">
              <Image
                src={`/api/admin/factory/work-orders/${order.id}/qr`}
                alt={`${order.workOrderNumber} trace QR`}
                width={160}
                height={160}
                unoptimized
                className="mx-auto h-40 w-40"
              />
              <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-gray-600">
                Scan lot history
              </p>
            </div>
          </div>
        </header>
        {pageParams?.cctvSaved ? (
          <p className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-bold text-blue-800">
            CCTV footage lookup reference saved. No video file was uploaded.
          </p>
        ) : null}
        {order.status === "Cancelled" ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <p className="font-black">Work Order cancelled</p>
            <p className="mt-1">{order.cancellationReason || "No reason recorded."}</p>
            <p className="mt-1 text-xs">
              By {order.cancelledBy || "Admin"}
              {order.cancelledAt ? ` at ${dateTime(order.cancelledAt)}` : ""}
            </p>
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Current stage", order.currentStageCode ? stageName(order.currentStageCode) : order.status],
            ["Verified output", `${goodPairs} good · ${rejectedPairs} reject`],
            ["Verified wages", `Rs. ${wages.toLocaleString("en-IN")}`],
            ["Material cost", `Rs. ${materialCost.toLocaleString("en-IN")}`],
          ].map(([label, value]) => (
            <article key={label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wider text-gray-500">{label}</p>
              <p className="mt-2 font-black text-brand-green-ink">{value}</p>
            </article>
          ))}
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black text-brand-green-ink">Production journey</h2>
            <div className="mt-5 space-y-3">
              {assignments.map((assignment, index) => {
                const stageEntries = entries.filter(
                  (entry) => entry.assignmentId === assignment.id,
                );
                const verified = stageEntries.filter((entry) => entry.status === "Verified");
                const stageGood = verified.reduce((sum, entry) => sum + entry.goodPairs, 0);
                const stageReject = verified.reduce((sum, entry) => sum + entry.rejectPairs, 0);
                const incoming = handovers.find(
                  (entry) => entry.toAssignmentId === assignment.id,
                );
                return (
                  <div key={assignment.id} className="grid grid-cols-[2.25rem_1fr] gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-green text-xs font-black text-white">
                      {index + 1}
                    </span>
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="font-black text-brand-green-ink">
                            {stageName(assignment.stageCode)}
                          </h3>
                          <p className="mt-1 text-sm text-gray-600">
                            {assignment.workerName} · ID {assignment.workerId}
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-gray-700">
                          {assignment.status}
                        </span>
                      </div>
                      <p className="mt-3 text-xs font-bold text-gray-600">
                        Target {assignment.targetPairs} · verified good {stageGood} · reject {stageReject}
                        {" · "}rate Rs. {assignment.ratePerGoodPairSnapshot}/pair
                      </p>
                      {incoming ? (
                        <p className="mt-2 text-xs text-purple-700">
                          Received {incoming.receivedPairs}/{incoming.sentPairs} pairs from{" "}
                          {incoming.fromWorkerName} · {dateTime(incoming.createdAt)}
                        </p>
                      ) : null}
                      {assignment.cameraZone ? (
                        <p className="mt-2 text-xs text-blue-700">
                          Camera zone: {assignment.cameraZone}
                        </p>
                      ) : null}
                      {assignment.status === "Paused" && assignment.pauseReason ? (
                        <p className="mt-2 rounded-lg bg-amber-100 p-2 text-xs font-bold text-amber-900">
                          Paused: {assignment.pauseReason}
                          {assignment.pausedBy ? ` - ${assignment.pausedBy}` : ""}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {assignments.length === 0 ? (
                <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">
                  Stage assignments will appear after this Work Order is released.
                </p>
              ) : null}
            </div>
          </article>

          <div className="space-y-5">
            <article className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="font-black text-brand-green-ink">Size & colour plan</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {sizes.map((entry) => (
                  <span key={entry.id} className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-black">
                    {order.color} · {entry.size}: {entry.plannedPairs}
                  </span>
                ))}
              </div>
            </article>

            <article className="rounded-3xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
              <h2 className="font-black text-orange-950">Material trace</h2>
              <div className="mt-3 space-y-2">
                {issues.map((issue) => (
                  <div key={issue.id} className="rounded-xl bg-white p-3 text-xs text-gray-700">
                    <p className="font-black">{issue.materialName}</p>
                    <p className="mt-1">
                      Issued {issue.quantity} {issue.unit} · returned {issue.returnedQuantity}
                      {" · "}consumed {issue.consumedQuantity} · waste {issue.wastageQuantity}
                    </p>
                    <p className="mt-1 text-gray-500">
                      {issue.status} · cost Rs. {issue.totalCost.toLocaleString("en-IN")}
                    </p>
                  </div>
                ))}
                {issues.length === 0 ? <p className="text-xs text-orange-800">No material issue yet.</p> : null}
              </div>
            </article>

            <article className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
              <h2 className="font-black text-emerald-950">Packing & stock</h2>
              {packing ? (
                <div className="mt-3 text-xs leading-6 text-emerald-900">
                  <p>Approved: {packing.approvedPairs} pairs by {packing.approvedBy}</p>
                  <p>Approved at: {dateTime(packing.createdAt)}</p>
                  <p>
                    Stock: {packing.stockPostedAt
                      ? `Posted by ${packing.stockPostedBy} at ${dateTime(packing.stockPostedAt)}`
                      : "Waiting for Owner posting"}
                  </p>
                  <p>Stock movements: {packing.stockMovementIds.length}</p>
                </div>
              ) : (
                <p className="mt-3 text-xs text-emerald-800">Packing approval pending.</p>
              )}
            </article>

            <article className="rounded-3xl border border-red-100 bg-red-50 p-5 shadow-sm">
              <h2 className="font-black text-red-950">Quality summary</h2>
              <p className="mt-3 text-sm font-black text-red-900">
                {rejectedPairs} rejected · {reworkPairs} rework
              </p>
              <div className="mt-2 space-y-1 text-xs text-red-800">
                {verifiedEntries
                  .filter((entry) => entry.rejectPairs > 0 || entry.reworkPairs > 0)
                  .map((entry) => (
                    <p key={entry.id}>
                      {stageName(entry.stageCode)} · {entry.workerName}: {entry.rejectReason || "Rework"}{" "}
                      ({entry.rejectPairs + entry.reworkPairs})
                    </p>
                  ))}
              </div>
            </article>
          </div>
        </div>

        <article className="mt-6 rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-amber-700">
                Snapshot-safe actual costing
              </p>
              <h2 className="mt-1 text-xl font-black text-amber-950">
                Planned vs actual cost
              </h2>
            </div>
            <p className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-amber-900">
              {costing.outputPairs} output pairs
            </p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Planned material", costing.plannedMaterialCost],
              ["Actual material", costing.actualMaterialCost],
              ["Planned labour", costing.plannedLabourCost],
              ["Verified labour", costing.actualLabourCost],
              ["Planned total", costing.plannedTotalCost],
              ["Actual total", costing.actualTotalCost],
              ["Planned / pair", costing.plannedCostPerPair],
              ["Actual / pair", costing.actualCostPerPair],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-amber-100 bg-white p-3">
                <p className="text-[11px] font-black uppercase tracking-wider text-gray-500">
                  {label}
                </p>
                <p className="mt-2 font-black text-brand-green-ink">
                  Rs. {Number(value).toLocaleString("en-IN")}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <p className={`rounded-xl p-3 text-xs font-black ${
              costing.totalVariance > 0
                ? "bg-red-50 text-red-800"
                : "bg-emerald-50 text-emerald-800"
            }`}>
              Total variance: Rs. {costing.totalVariance.toLocaleString("en-IN")}
            </p>
            <p className="rounded-xl bg-orange-50 p-3 text-xs font-black text-orange-800">
              Wastage cost: Rs. {costing.wastageCost.toLocaleString("en-IN")}
            </p>
            <p className="rounded-xl bg-gray-100 p-3 text-xs font-black text-gray-700">
              Reject {costing.rejectPairs} · rework {costing.reworkPairs}
            </p>
          </div>
          {costing.missingMaterialRates > 0 ? (
            <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-800">
              {costing.missingMaterialRates} BOM material rates are missing; planned cost is incomplete.
            </p>
          ) : null}
        </article>

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <CctvReferenceForm
            workOrderId={order.id}
            stages={cctvStages}
          />
          <article className="rounded-3xl border border-blue-200 bg-white p-5 shadow-sm">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-blue-700">
                  Investigation support
                </p>
                <h2 className="mt-1 text-lg font-black text-blue-950">
                  CCTV reference timeline
                </h2>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-800">
                {cctvReferences.length} records
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {cctvReferences.map((reference) => (
                <div key={reference.id} className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-black text-blue-950">{reference.incidentType}</p>
                      <p className="mt-1 text-blue-800">
                        {stageName(reference.stageCode)} · {reference.cameraZone}
                      </p>
                    </div>
                    {reference.referenceUrl ? (
                      <a
                        href={reference.referenceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-white px-3 py-2 font-black text-blue-800 underline underline-offset-4"
                      >
                        Open footage reference
                      </a>
                    ) : null}
                  </div>
                  <p className="mt-3 font-semibold text-gray-700">
                    {dateTime(reference.startedAt)} → {dateTime(reference.endedAt)}
                  </p>
                  <p className="mt-2 text-gray-600">{reference.note || "No additional note."}</p>
                  <p className="mt-2 text-[11px] text-gray-500">
                    Saved by {reference.createdBy} · {dateTime(reference.createdAt)}
                  </p>
                </div>
              ))}
              {cctvReferences.length === 0 ? (
                <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                  No CCTV reference saved for this lot.
                </p>
              ) : null}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
