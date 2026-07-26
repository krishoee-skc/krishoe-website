import type { Metadata } from "next";
import Link from "next/link";
import ProductionEntryForm from "@/app/admin/factory/ProductionEntryForm";
import StagePauseControls from "@/app/admin/factory/StagePauseControls";
import { requireAdminPermission } from "@/lib/admin-permissions";
import {
  factoryStages,
  factoryWorkOrderTracePath,
  getFactoryAssignmentSizePlan,
  getFactoryData,
  getFactoryStationAssignments,
  isFactoryStageCode,
} from "@/lib/factory";

export const metadata: Metadata = { title: "Station Mode | KRISHOE Factory" };
export const dynamic = "force-dynamic";

export default async function FactoryStationPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; worker?: string; stage?: string }>;
}) {
  await requireAdminPermission("factory:write");
  const params = await searchParams;
  const factory = await getFactoryData();
  const requestedStage = params?.stage ?? "";
  const stageCode = isFactoryStageCode(requestedStage) ? requestedStage : "";
  const activeWorkerIds = new Set(
    factory.stageAssignments
      .filter((entry) => ["Ready", "In Progress", "Paused"].includes(entry.status))
      .map((entry) => entry.workerId),
  );
  const workers = [...new Map(
    factory.stageAssignments
      .filter((entry) => activeWorkerIds.has(entry.workerId))
      .map((entry) => [entry.workerId, entry.workerName]),
  )].map(([id, name]) => ({ id, name }));
  const stationAssignments = getFactoryStationAssignments(factory, {
    query: params?.q,
    workerId: params?.worker,
    stageCode,
  });

  return (
    <section className="p-3 sm:p-6">
      <div className="mx-auto max-w-4xl">
        <header className="rounded-3xl bg-brand-green-ink p-5 text-white shadow-lg">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
            KRISHOE Factory
          </p>
          <h1 className="mt-2 text-3xl font-black">Station Mode</h1>
          <p className="mt-2 text-sm text-emerald-50/80">
            Fast mobile production entry for the active worker and stage.
          </p>
          <Link
            href="/admin/factory"
            className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-white/30 px-4 text-sm font-black"
          >
            Owner dashboard
          </Link>
        </header>

        <form action="/admin/factory/station" className="mt-4 grid gap-2 rounded-2xl border bg-white p-3 sm:grid-cols-2">
          <input
            name="q"
            defaultValue={params?.q}
            placeholder="Search lot, item or colour"
            className="min-h-12 rounded-xl border border-gray-200 px-3 text-base"
          />
          <select name="worker" defaultValue={params?.worker ?? ""} className="min-h-12 rounded-xl border border-gray-200 bg-white px-3">
            <option value="">All active workers</option>
            {workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}
          </select>
          <select name="stage" defaultValue={stageCode} className="min-h-12 rounded-xl border border-gray-200 bg-white px-3">
            <option value="">All active stages</option>
            {factoryStages.map((stage) => <option key={stage.code} value={stage.code}>{stage.name}</option>)}
          </select>
          <div className="flex gap-2">
            <button className="min-h-12 flex-1 rounded-xl bg-brand-green px-4 font-black text-white">Show work</button>
            <Link href="/admin/factory/station" className="inline-flex min-h-12 items-center rounded-xl border px-4 text-sm font-black">Clear</Link>
          </div>
        </form>

        <div className="mt-4 space-y-4">
          {stationAssignments.map(({ assignment, workOrder }) => {
            const assignmentPlan = getFactoryAssignmentSizePlan(factory, assignment);
            const validEntries = factory.productionEntries.filter(
              (entry) => entry.assignmentId === assignment.id && entry.status !== "Rejected",
            );
            const validIds = new Set(validEntries.map((entry) => entry.id));
            const remainingSizes = assignmentPlan.map((size) => ({
              size: size.size,
              remainingPairs: Math.max(
                0,
                size.plannedPairs -
                  factory.productionEntrySizes
                    .filter(
                      (entry) =>
                        validIds.has(entry.productionEntryId) &&
                        entry.size === size.size,
                    )
                    .reduce((sum, entry) => sum + entry.goodPairs, 0),
              ),
            }));
            const stageName =
              factoryStages.find((stage) => stage.code === assignment.stageCode)?.name ??
              assignment.stageCode;
            return (
              <article key={assignment.id} className="rounded-3xl border border-emerald-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-brand-clay">{workOrder.workOrderNumber}</p>
                    <h2 className="mt-1 text-xl font-black text-brand-green-ink">{workOrder.itemName}</h2>
                    <p className="mt-1 text-sm text-gray-600">{workOrder.color} / {workOrder.totalPairs} pairs / Due {workOrder.dueDate}</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-900">{assignment.status}</span>
                </div>
                <div className="mt-3 rounded-xl bg-gray-50 p-3">
                  <p className="font-black text-brand-green-ink">{stageName} - {assignment.workerName}</p>
                  <p className="mt-1 text-xs text-gray-500">Worker ID {assignment.workerId} / Rs. {assignment.ratePerGoodPairSnapshot} per good pair</p>
                </div>
                <StagePauseControls
                  assignmentId={assignment.id}
                  status={assignment.status}
                  pauseReason={assignment.pauseReason}
                  pausedBy={assignment.pausedBy}
                  pausedAt={assignment.pausedAt}
                />
                {["Ready", "In Progress"].includes(assignment.status) &&
                remainingSizes.some((row) => row.remainingPairs > 0) ? (
                  <ProductionEntryForm
                    assignmentId={assignment.id}
                    sizes={remainingSizes}
                    wageRate={assignment.ratePerGoodPairSnapshot}
                  />
                ) : null}
                <Link href={factoryWorkOrderTracePath(workOrder.id)} className="mt-3 inline-flex min-h-11 items-center text-sm font-black text-brand-green">
                  Open full lot trace
                </Link>
              </article>
            );
          })}
          {stationAssignments.length === 0 ? (
            <div className="rounded-3xl border border-dashed bg-white p-10 text-center">
              <p className="font-black text-brand-green-ink">No active station work matches this filter.</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
