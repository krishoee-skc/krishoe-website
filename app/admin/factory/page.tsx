import type { Metadata } from "next";
import Link from "next/link";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import WorkOrderForm from "@/app/admin/factory/WorkOrderForm";
import WorkOrderReleaseForm from "@/app/admin/factory/WorkOrderReleaseForm";
import ProductionEntryForm from "@/app/admin/factory/ProductionEntryForm";
import ProductionVerificationForm from "@/app/admin/factory/ProductionVerificationForm";
import StageHandoverForm from "@/app/admin/factory/StageHandoverForm";
import StageWorkerReassignmentForm from "@/app/admin/factory/StageWorkerReassignmentForm";
import StagePauseControls from "@/app/admin/factory/StagePauseControls";
import PackingApprovalForm from "@/app/admin/factory/PackingApprovalForm";
import MaterialIssueDraftForm from "@/app/admin/factory/MaterialIssueDraftForm";
import MaterialIssuePostingControls from "@/app/admin/factory/MaterialIssuePostingControls";
import FinishedStockPostingForm from "@/app/admin/factory/FinishedStockPostingForm";
import WorkOrderCancellationForm from "@/app/admin/factory/WorkOrderCancellationForm";
import {
  createFactoryItemAction,
  saveFactoryBomLineAction,
  saveFactoryStageRateAction,
  saveFactoryWorkerLinkAction,
} from "@/app/admin/factory/actions";
import {
  auditFactoryFoundation,
  calculateBomRequirement,
  factoryRolloutPhases,
  factoryStages,
  factoryWorkOrderTracePath,
  factoryWorkOrderWorksheetPath,
  filterFactoryWorkOrders,
  getFactoryData,
  getFactoryDashboard,
  getFactoryAssignmentSizePlan,
  getFactoryPackingReadiness,
  getFactoryMaterialPlan,
  getFactoryWorkOrderCancellationBlockers,
} from "@/lib/factory";
import { getHrData } from "@/lib/hr";
import { getOperationsData } from "@/lib/operations";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { getPurchasingData } from "@/lib/purchasing";
import { buildMaterialCostRates } from "@/lib/costing";

export const metadata: Metadata = { title: "Factory ERP | KRISHOE Admin" };
export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: number;
  detail: string;
  tone?: "default" | "good" | "warn";
}) {
  const toneClass = {
    default: "border-gray-200 bg-white text-brand-green-ink",
    good: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
  }[tone];

  return (
    <article className={`rounded-2xl border p-5 shadow-sm ${toneClass}`}>
      <p className="text-xs font-black uppercase tracking-[0.16em] opacity-65">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
      <p className="mt-2 text-sm leading-5 opacity-75">{detail}</p>
    </article>
  );
}

export default async function FactoryErpPage({
  searchParams,
}: {
  searchParams?: Promise<{
    created?: string;
    updated?: string;
    workOrder?: string;
    released?: string;
    entry?: string;
    verified?: string;
    handover?: string;
    packed?: string;
    materialDraft?: string;
    materialPosted?: string;
    materialReturned?: string;
    materialFinalized?: string;
    stockPosted?: string;
    q?: string;
    orderStatus?: string;
    orderPriority?: string;
    orderStage?: string;
  }>;
}) {
  await requireAdminPermission("factory:write");
  const [hr, operations, factory, purchasing, params] = await Promise.all([
    getHrData(),
    getOperationsData(),
    getFactoryData(),
    getPurchasingData(),
    searchParams,
  ]);
  const materialRates = buildMaterialCostRates(purchasing.purchaseInvoices);
  const audit = auditFactoryFoundation({
    employees: hr.employees,
    productionBatches: operations.productionBatches,
    workerTasks: operations.workerTasks,
  });
  const reviewCount = audit.unlinkedLegacyTaskCount + audit.ambiguousLegacyTaskCount;
  const dashboard = getFactoryDashboard(factory);
  const orderStatus = [
    "Draft",
    "Released",
    "In Progress",
    "Ready for Stock",
    "Completed",
    "Cancelled",
  ].includes(params?.orderStatus ?? "")
    ? (params?.orderStatus as (typeof factory.workOrders)[number]["status"])
    : "";
  const orderPriority = ["Normal", "High", "Urgent"].includes(
    params?.orderPriority ?? "",
  )
    ? (params?.orderPriority as (typeof factory.workOrders)[number]["priority"])
    : "";
  const orderStage = factoryStages.some(
    (stage) => stage.code === params?.orderStage,
  )
    ? (params?.orderStage as (typeof factoryStages)[number]["code"])
    : "";
  const filteredWorkOrders = filterFactoryWorkOrders(factory, {
    query: params?.q,
    status: orderStatus,
    priority: orderPriority,
    stageCode: orderStage,
  });

  return (
    <section className="p-4 sm:p-6">
      <header className="overflow-hidden rounded-3xl bg-brand-green-ink px-5 py-7 text-white shadow-lg sm:px-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-300">
          KRISHOE Factory V2
        </p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">Factory ERP</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-50/85 sm:text-base">
          A parallel production system that protects the existing HR, sales, POS,
          purchasing and stock flows. Worker, material, packing and finished-stock
          records now connect through one controlled Work Order chain.
        </p>
        <div className="mt-5 inline-flex rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-amber-200">
          Owner-controlled posting · audit protected
        </div>
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/factory/station"
              className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-sm font-black text-brand-green-ink"
            >
              Open Station Mode
            </Link>
            <Link
              href="/admin/factory/qc"
              className="inline-flex min-h-11 items-center rounded-xl border border-white/40 px-4 text-sm font-black text-white"
            >
              Open QC Mode
            </Link>
            <Link
              href="/admin/factory/reports?period=daily"
              className="inline-flex min-h-11 items-center rounded-xl bg-amber-300 px-4 text-sm font-black text-brand-green-ink"
            >
              Open daily / weekly / monthly reports
            </Link>
          </div>
        </div>
      </header>

      <article className="mt-6 rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-clay">
              Live command center
            </p>
            <h2 className="mt-2 text-2xl font-black text-brand-green-ink">
              Today&apos;s factory pulse
            </h2>
          </div>
          <span className="rounded-full bg-brand-green-ink px-3 py-1.5 text-xs font-black text-white">
            Verified production only
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Good pairs today"
            value={dashboard.todayGoodPairs}
            detail={`${dashboard.todayRejectPairs} reject · ${dashboard.todayReworkPairs} rework`}
            tone="good"
          />
          <StatCard
            label="Overdue orders"
            value={dashboard.overdueWorkOrders}
            detail="active Work Orders past due date"
            tone={dashboard.overdueWorkOrders > 0 ? "warn" : "good"}
          />
          <StatCard
            label="Ready for stock"
            value={dashboard.readyForStockPairs}
            detail="packed pairs waiting Owner posting"
            tone={dashboard.readyForStockPairs > 0 ? "warn" : "default"}
          />
          <StatCard
            label="Needs verification"
            value={dashboard.pendingVerificationEntries}
            detail={`estimated wage Rs. ${dashboard.estimatedWagesPending.toLocaleString("en-IN")}`}
            tone={dashboard.pendingVerificationEntries > 0 ? "warn" : "good"}
          />
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <div>
            <h3 className="text-sm font-black text-brand-green-ink">Stage-wise pending pairs</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {dashboard.stagePending.map((stage) => (
                <div key={stage.stageCode} className="rounded-2xl border border-gray-100 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-black text-gray-700">{stage.stageName}</p>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black ${
                      stage.pendingPairs > 0
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}>
                      {stage.pendingPairs}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {stage.activeTasks} active tasks
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-emerald-100 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-wider text-emerald-700">
                Top output today
              </p>
              <p className="mt-2 text-lg font-black text-brand-green-ink">
                {dashboard.topOutputWorker?.workerName ?? "No verified entry"}
              </p>
              <p className="text-xs text-gray-500">
                {dashboard.topOutputWorker
                  ? `${dashboard.topOutputWorker.pairs} good pairs`
                  : "Production verification will update this automatically."}
              </p>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-wider text-blue-700">
                Highest quality
              </p>
              <p className="mt-2 text-lg font-black text-brand-green-ink">
                {dashboard.highestQualityWorker?.workerName ?? "No verified entry"}
              </p>
              <p className="text-xs text-gray-500">
                {dashboard.highestQualityWorker
                  ? `${dashboard.highestQualityWorker.qualityRate}% · ${dashboard.highestQualityWorker.inspectedPairs} inspected`
                  : "Quality rank appears after QC verification."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-amber-100 bg-white p-3">
                <p className="text-2xl font-black text-amber-800">{dashboard.workersWithoutEntry}</p>
                <p className="mt-1 text-[11px] font-bold text-gray-500">workers without today&apos;s entry</p>
              </div>
              <div className="rounded-2xl border border-orange-100 bg-white p-3">
                <p className="text-2xl font-black text-orange-800">{dashboard.materialVarianceLines}</p>
                <p className="mt-1 text-[11px] font-bold text-gray-500">material lines with variance</p>
              </div>
            </div>
          </div>
        </div>
      </article>

      <article
        id="factory-bottlenecks"
        className={`mt-6 rounded-3xl border p-5 shadow-sm sm:p-6 ${
          dashboard.pausedStages.length > 0
            ? "border-red-200 bg-gradient-to-br from-red-50 to-white"
            : "border-emerald-200 bg-emerald-50"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-700">
              Bottleneck board
            </p>
            <h2 className="mt-2 text-xl font-black text-brand-green-ink">
              Paused production stages
            </h2>
          </div>
          <span className="rounded-full bg-red-700 px-3 py-1.5 text-xs font-black text-white">
            {dashboard.pausedStages.length} blocked
          </span>
        </div>
        {dashboard.pausedStages.length > 0 ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {dashboard.pausedStages.map((stage) => (
              <Link
                key={stage.assignmentId}
                href={factoryWorkOrderTracePath(stage.workOrderId)}
                className="rounded-2xl border border-red-100 bg-white p-4 transition hover:border-red-300"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-red-700">
                      {stage.workOrderNumber}
                    </p>
                    <p className="mt-1 font-black text-brand-green-ink">
                      {stage.stageName} - {stage.workerName}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-900">
                    {stage.pausedHours}h paused
                  </span>
                </div>
                <p className="mt-3 text-sm text-red-800">{stage.reason}</p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm font-bold text-emerald-800">
            No active production stage is paused.
          </p>
        )}
      </article>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active employees"
          value={audit.activeEmployeeCount}
          detail={`${audit.employeeCount} total HR employee records`}
          tone="good"
        />
        <StatCard
          label="Legacy batches"
          value={audit.productionBatchCount}
          detail="Existing production batches preserved"
        />
        <StatCard
          label="Worker tasks"
          value={audit.legacyTaskCount}
          detail={`${audit.linkedLegacyTaskCount} can be matched safely by current name`}
        />
        <StatCard
          label="Linkage review"
          value={reviewCount}
          detail="Tasks needing Worker ID mapping before migration"
          tone={reviewCount > 0 ? "warn" : "good"}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-clay">
            Real factory line
          </p>
          <h2 className="mt-2 text-xl font-black text-brand-green-ink">
            Configurable production stages
          </h2>
          <div className="mt-5 space-y-3">
            {factoryStages.map((stage, index) => (
              <div
                key={stage.code}
                className="grid grid-cols-[2.5rem_1fr] gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-green text-sm font-black text-white">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-black text-brand-green-ink">{stage.name}</h3>
                  <p className="mt-1 text-sm leading-5 text-gray-500">{stage.description}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-clay">
            Controlled rollout
          </p>
          <h2 className="mt-2 text-xl font-black text-brand-green-ink">Implementation phases</h2>
          <ol className="mt-5 space-y-4">
            {factoryRolloutPhases.map((phase) => (
              <li key={phase.number} className="flex gap-3">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-black ${
                  phase.status === "In progress"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-gray-100 text-gray-500"
                }`}>
                  {phase.number}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black text-brand-green-ink">{phase.name}</h3>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-gray-600">
                      {phase.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-5 text-gray-500">{phase.scope}</p>
                </div>
              </li>
            ))}
          </ol>
        </article>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-clay">
            Phase 1 · Item Master
          </p>
          <h2 className="mt-2 text-xl font-black text-brand-green-ink">
            Add production item
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            This creates a Factory-only item. It does not change the shop catalog,
            finished stock or sales availability.
          </p>
          {params?.created === "1" ? (
            <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
              Production item saved in shadow mode.
            </p>
          ) : null}
          <form action={createFactoryItemAction} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold text-brand-green-ink">
                Item code
                <input name="code" required placeholder="LH-01" className="mt-1 h-11 w-full rounded-xl border border-gray-200 px-3 font-normal outline-none focus:border-brand-green" />
              </label>
              <label className="text-sm font-bold text-brand-green-ink">
                Category
                <input name="category" placeholder="Ladies Heel" className="mt-1 h-11 w-full rounded-xl border border-gray-200 px-3 font-normal outline-none focus:border-brand-green" />
              </label>
            </div>
            <label className="block text-sm font-bold text-brand-green-ink">
              English name
              <input name="englishName" required placeholder="Ladies Heel" className="mt-1 h-11 w-full rounded-xl border border-gray-200 px-3 font-normal outline-none focus:border-brand-green" />
            </label>
            <label className="block text-sm font-bold text-brand-green-ink">
              नेपाली नाम
              <input name="nepaliName" placeholder="लेडिज हिल" className="mt-1 h-11 w-full rounded-xl border border-gray-200 px-3 font-normal outline-none focus:border-brand-green" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold text-brand-green-ink">
                Colours
                <input name="colors" placeholder="Black, Maroon, Gold" className="mt-1 h-11 w-full rounded-xl border border-gray-200 px-3 font-normal outline-none focus:border-brand-green" />
              </label>
              <label className="text-sm font-bold text-brand-green-ink">
                Mixed sizes
                <input name="sizes" placeholder="36, 37, 38, 39, 40" className="mt-1 h-11 w-full rounded-xl border border-gray-200 px-3 font-normal outline-none focus:border-brand-green" />
              </label>
            </div>
            <fieldset>
              <legend className="text-sm font-bold text-brand-green-ink">Production stages</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {factoryStages.map((stage) => (
                  <label key={stage.code} className="flex min-h-11 items-center gap-3 rounded-xl border border-gray-200 px-3 text-sm font-semibold">
                    <input type="checkbox" name="stageCodes" value={stage.code} defaultChecked className="h-4 w-4 accent-brand-green" />
                    {stage.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold text-brand-green-ink">
                Standard minutes/pair
                <input type="number" min="0" step="0.01" name="standardMinutesPerPair" defaultValue="0" className="mt-1 h-11 w-full rounded-xl border border-gray-200 px-3 font-normal outline-none focus:border-brand-green" />
              </label>
              <label className="text-sm font-bold text-brand-green-ink">
                Status
                <select name="status" className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 font-normal outline-none focus:border-brand-green">
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </label>
            </div>
            <FormSubmitButton className="min-h-12 w-full rounded-xl bg-brand-green px-5 text-sm font-black text-white">
              Save production item
            </FormSubmitButton>
          </form>
        </article>

        <article className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-clay">
                Factory records
              </p>
              <h2 className="mt-2 text-xl font-black text-brand-green-ink">
                Production Item Master
              </h2>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black text-gray-600">
              {factory.items.length} items
            </span>
          </div>
          <div className="mt-5 space-y-3">
            {factory.items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-gray-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-brand-clay">{item.code}</p>
                    <h3 className="mt-1 font-black text-brand-green-ink">{item.englishName}</h3>
                    {item.nepaliName ? <p className="text-sm text-gray-500">{item.nepaliName}</p> : null}
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-black ${
                    item.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"
                  }`}>
                    {item.status}
                  </span>
                </div>
                <p className="mt-3 text-sm text-gray-500">
                  Sizes: {item.sizes.join(", ") || "Not set"} · Colours: {item.colors.join(", ") || "Not set"}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {item.stageCodes.length} stages · {factory.bomLines.filter((line) => line.itemId === item.id).length} BOM materials
                </p>
              </div>
            ))}
            {factory.items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 px-5 py-10 text-center">
                <p className="font-black text-brand-green-ink">No production items yet</p>
                <p className="mt-2 text-sm text-gray-500">Start with one real factory item for the pilot.</p>
              </div>
            ) : null}
          </div>
        </article>
      </div>

      <article className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-clay">
          Factory setup
        </p>
        <h2 className="mt-2 text-xl font-black text-brand-green-ink">
          Materials, wages and workers
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
          Configure one real item at a time. Saving here prepares Work Order calculations,
          but does not deduct material, create payroll or increase finished stock.
        </p>
        {params?.updated ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
            {params.updated}
          </p>
        ) : null}

        {factory.items.length > 0 ? (
          <div className="mt-6 grid gap-5 xl:grid-cols-3">
            <form action={saveFactoryBomLineAction} className="rounded-2xl border border-gray-200 p-4">
              <h3 className="font-black text-brand-green-ink">Add BOM material</h3>
              <p className="mt-1 text-xs leading-5 text-gray-500">Material needed for one finished pair.</p>
              <label className="mt-4 block text-sm font-bold">
                Production item
                <select name="itemId" required className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 font-normal">
                  {factory.items.filter((item) => item.status === "Active").map((item) => (
                    <option key={item.id} value={item.id}>{item.code} · {item.englishName}</option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block text-sm font-bold">
                Raw material
                <select name="materialId" required className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 font-normal">
                  {operations.rawMaterials.map((material) => (
                    <option key={material.id} value={material.id}>{material.name} ({material.unit})</option>
                  ))}
                </select>
              </label>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="text-sm font-bold">
                  Qty/pair
                  <input name="quantityPerPair" type="number" min="0.0001" step="0.0001" required className="mt-1 h-11 w-full rounded-xl border border-gray-200 px-3 font-normal" />
                </label>
                <label className="text-sm font-bold">
                  Wastage %
                  <input name="wastagePercent" type="number" min="0" step="0.01" defaultValue="0" className="mt-1 h-11 w-full rounded-xl border border-gray-200 px-3 font-normal" />
                </label>
              </div>
              <FormSubmitButton className="mt-4 min-h-11 w-full rounded-xl bg-brand-green px-4 text-sm font-black text-white">
                Save BOM line
              </FormSubmitButton>
            </form>

            <form action={saveFactoryStageRateAction} className="rounded-2xl border border-gray-200 p-4">
              <h3 className="font-black text-brand-green-ink">Set stage wage</h3>
              <p className="mt-1 text-xs leading-5 text-gray-500">Default rate for one approved good pair.</p>
              <label className="mt-4 block text-sm font-bold">
                Production item
                <select name="itemId" required className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 font-normal">
                  {factory.items.filter((item) => item.status === "Active").map((item) => (
                    <option key={item.id} value={item.id}>{item.code} · {item.englishName}</option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block text-sm font-bold">
                Stage
                <select name="stageCode" required className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 font-normal">
                  {factoryStages.map((stage) => (
                    <option key={stage.code} value={stage.code}>{stage.name}</option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block text-sm font-bold">
                Wage per good pair (Rs.)
                <input name="ratePerGoodPair" type="number" min="0" step="0.01" required className="mt-1 h-11 w-full rounded-xl border border-gray-200 px-3 font-normal" />
              </label>
              <FormSubmitButton className="mt-4 min-h-11 w-full rounded-xl bg-brand-green px-4 text-sm font-black text-white">
                Save wage rate
              </FormSubmitButton>
            </form>

            <form action={saveFactoryWorkerLinkAction} className="rounded-2xl border border-gray-200 p-4">
              <h3 className="font-black text-brand-green-ink">Link factory worker</h3>
              <p className="mt-1 text-xs leading-5 text-gray-500">Uses the permanent Employee ID from HR.</p>
              <label className="mt-4 block text-sm font-bold">
                HR employee
                <select name="employeeId" required className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 font-normal">
                  {hr.employees.filter((employee) => employee.status === "Active").map((employee) => (
                    <option key={employee.id} value={employee.id}>{employee.name} · {employee.department}</option>
                  ))}
                </select>
              </label>
              <fieldset className="mt-3">
                <legend className="text-sm font-bold">Worker stages</legend>
                <div className="mt-2 grid gap-2">
                  {factoryStages.map((stage) => (
                    <label key={stage.code} className="flex min-h-10 items-center gap-3 rounded-xl border border-gray-200 px-3 text-xs font-semibold">
                      <input type="checkbox" name="workerStageCodes" value={stage.code} className="h-4 w-4 accent-brand-green" />
                      {stage.name}
                    </label>
                  ))}
                </div>
              </fieldset>
              <FormSubmitButton className="mt-4 min-h-11 w-full rounded-xl bg-brand-green px-4 text-sm font-black text-white">
                Save worker linkage
              </FormSubmitButton>
            </form>
          </div>
        ) : (
          <p className="mt-5 rounded-2xl border border-dashed border-gray-300 p-5 text-sm text-gray-500">
            Add the first Production Item before configuring BOM, wages and workers.
          </p>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="BOM lines" value={factory.bomLines.length} detail="Item-to-material recipes" />
          <StatCard label="Stage rates" value={factory.stageRates.length} detail="Item and stage wage defaults" />
          <StatCard label="Factory workers" value={factory.workerLinks.filter((link) => link.active).length} detail="Permanent HR Employee ID links" />
        </div>
      </article>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-clay">
            Phase 2 · Planning
          </p>
          <h2 className="mt-2 text-xl font-black text-brand-green-ink">
            Create Work Order / Lot
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Factory Watching Man can prepare the colour, due date and size-wise quantity.
            New orders remain Draft until the release workflow is added.
          </p>
          {params?.workOrder ? (
            <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
              Draft {params.workOrder} created successfully.
            </p>
          ) : null}
          {params?.released ? (
            <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
              {params.released} released and stage assignments locked with wage snapshots.
            </p>
          ) : null}
          {params?.entry ? (
            <p className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">
              Production entry submitted for verification. Wage and stock are not posted yet.
            </p>
          ) : null}
          {params?.handover ? (
            <p className="mt-4 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm font-bold text-purple-800">
              Size-wise stage handover saved and the receiving stage is ready.
            </p>
          ) : null}
          {params?.packed ? (
            <p className="mt-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-bold text-teal-800">
              {params.packed} passed packing reconciliation and is Ready for Stock. Sellable stock is unchanged.
            </p>
          ) : null}
          {params?.materialDraft ? (
            <p className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-bold text-orange-800">
              Raw-material issue draft saved with a purchase-cost snapshot. Inventory stock is unchanged.
            </p>
          ) : null}
          {params?.materialPosted ? (
            <p className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-bold text-orange-800">
              Material issue confirmed and raw inventory deducted safely.
            </p>
          ) : null}
          {params?.materialReturned ? (
            <p className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">
              Unused production material returned to raw inventory.
            </p>
          ) : null}
          {params?.materialFinalized ? (
            <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
              Material consumption and wastage finalized with an audit record.
            </p>
          ) : null}
          {params?.stockPosted ? (
            <p className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">
              {params.stockPosted} posted size-wise to finished stock. Operations, POS and shop stock are synchronized.
            </p>
          ) : null}
          <div className="mt-5">
            <WorkOrderForm
              items={factory.items
                .filter((item) => item.status === "Active" && item.colors.length > 0 && item.sizes.length > 0)
                .map((item) => ({
                  id: item.id,
                  code: item.code,
                  name: item.englishName,
                  colors: item.colors,
                  sizes: item.sizes,
                }))}
            />
          </div>
        </article>

        <article className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-clay">
                Shadow-mode planning
              </p>
              <h2 className="mt-2 text-xl font-black text-brand-green-ink">Work Orders</h2>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black text-gray-600">
              {filteredWorkOrders.length} of {factory.workOrders.length} orders
            </span>
          </div>
          <form
            action="/admin/factory"
            className="mt-4 grid gap-2 rounded-2xl border border-gray-100 bg-gray-50 p-3 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_1fr_auto]"
          >
            <input
              name="q"
              defaultValue={params?.q}
              placeholder="Search WO, lot, item or colour"
              className="min-h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm"
            />
            <select
              name="orderStatus"
              defaultValue={orderStatus}
              className="min-h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm"
            >
              <option value="">All statuses</option>
              {["Draft", "Released", "In Progress", "Ready for Stock", "Completed", "Cancelled"].map(
                (status) => <option key={status}>{status}</option>,
              )}
            </select>
            <select
              name="orderPriority"
              defaultValue={orderPriority}
              className="min-h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm"
            >
              <option value="">All priorities</option>
              {["Normal", "High", "Urgent"].map((priority) => (
                <option key={priority}>{priority}</option>
              ))}
            </select>
            <select
              name="orderStage"
              defaultValue={orderStage}
              className="min-h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm"
            >
              <option value="">All active stages</option>
              {factoryStages.map((stage) => (
                <option key={stage.code} value={stage.code}>{stage.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button className="min-h-11 flex-1 rounded-xl bg-brand-green px-4 text-xs font-black text-white">
                Apply
              </button>
              <Link
                href="/admin/factory"
                className="inline-flex min-h-11 items-center rounded-xl border border-gray-300 px-3 text-xs font-black text-gray-700"
              >
                Clear
              </Link>
            </div>
          </form>
          <div className="mt-5 space-y-4">
            {filteredWorkOrders.map((order) => {
              const sizes = factory.workOrderSizes.filter((row) => row.workOrderId === order.id);
              const bom = factory.bomLines.filter((line) => line.itemId === order.itemId);
              const item = factory.items.find((entry) => entry.id === order.itemId);
              const assignments = factory.stageAssignments.filter((entry) => entry.workOrderId === order.id);
              const cancellationBlockers =
                getFactoryWorkOrderCancellationBlockers(factory, order);
              const packingReadiness = getFactoryPackingReadiness(factory, order);
              const packingApproval = factory.packingApprovals.find(
                (entry) => entry.workOrderId === order.id,
              );
              const activeMaterialIssues = factory.materialIssues.filter(
                (entry) =>
                  entry.workOrderId === order.id && entry.status !== "Cancelled",
              );
              const materialsFinalized =
                activeMaterialIssues.length > 0 &&
                activeMaterialIssues.every(
                  (entry) => entry.status === "Posted" && Boolean(entry.finalizedAt),
                );
              const verifiedWage = factory.productionEntries
                .filter(
                  (entry) =>
                    entry.workOrderId === order.id && entry.status === "Verified",
                )
                .reduce((sum, entry) => sum + entry.calculatedWage, 0);
              const materialPlan = getFactoryMaterialPlan({
                workOrder: order,
                bomLines: factory.bomLines,
                materialIssues: factory.materialIssues,
              });
              const materialOptions = materialPlan.map((line) => {
                const material = operations.rawMaterials.find(
                  (entry) => entry.id === line.materialId,
                );
                const rate =
                  materialRates.find((entry) => entry.materialId === line.materialId)
                    ?.averageUnitCost ?? 0;
                return {
                  bomLineId: line.id,
                  name: line.materialName,
                  unit: line.unit,
                  plannedQuantity: line.plannedQuantity,
                  allocatedQuantity: line.allocatedQuantity,
                  remainingQuantity: line.remainingQuantity,
                  availableStock: material
                    ? Math.max(
                        0,
                        material.openingStock + material.received - material.used,
                      )
                    : 0,
                  averageUnitCost: rate,
                };
              });
              const draftMaterialCost = factory.materialIssues
                .filter(
                  (issue) =>
                    issue.workOrderId === order.id && issue.status !== "Cancelled",
                )
                .reduce((sum, issue) => sum + issue.totalCost, 0);
              const releaseStages = (item?.stageCodes ?? []).map((code) => ({
                code,
                rate:
                  factory.stageRates.find(
                    (entry) => entry.itemId === order.itemId && entry.stageCode === code,
                  )?.ratePerGoodPair ?? null,
                workers: factory.workerLinks
                  .filter(
                    (link) =>
                      link.active &&
                      link.stageCodes.includes(code) &&
                      hr.employees.some(
                        (employee) => employee.id === link.employeeId && employee.status === "Active",
                      ),
                  )
                  .map((link) => {
                    const employee = hr.employees.find((entry) => entry.id === link.employeeId)!;
                    return { id: employee.id, name: employee.name };
                  }),
              }));
              return (
                <div key={order.id} className="rounded-2xl border border-gray-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-brand-clay">{order.workOrderNumber}</p>
                      <h3 className="mt-1 font-black text-brand-green-ink">{order.itemCode} · {order.itemName}</h3>
                      <p className="mt-1 text-sm text-gray-500">{order.color} · {order.totalPairs} pairs · Due {order.dueDate}</p>
                    </div>
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">{order.status}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={factoryWorkOrderTracePath(order.id)}
                      className="inline-flex min-h-10 items-center rounded-xl bg-brand-green-ink px-4 text-xs font-black text-white"
                    >
                      Open lot trace
                    </Link>
                    <a
                      href={`/api/admin/factory/work-orders/${order.id}/qr`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-10 items-center rounded-xl border border-brand-green px-4 text-xs font-black text-brand-green"
                    >
                      View / print QR
                    </a>
                    <Link
                      href={factoryWorkOrderWorksheetPath(order.id)}
                      className="inline-flex min-h-10 items-center rounded-xl border border-brand-clay px-4 text-xs font-black text-brand-clay"
                    >
                      Print worksheet
                    </Link>
                  </div>
                  {order.status === "Cancelled" ? (
                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900">
                      <p className="font-black">Cancelled: {order.cancellationReason || "No reason recorded."}</p>
                      <p className="mt-1">
                        By {order.cancelledBy || "Admin"}
                        {order.cancelledAt
                          ? ` at ${new Date(order.cancelledAt).toLocaleString("en-NP")}`
                          : ""}
                      </p>
                    </div>
                  ) : null}
                  {cancellationBlockers.length === 0 ? (
                    <WorkOrderCancellationForm workOrderId={order.id} />
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {sizes.map((row) => (
                      <span key={row.id} className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">
                        {row.size}: {row.plannedPairs}
                      </span>
                    ))}
                  </div>
                  <details className="mt-3 rounded-xl bg-gray-50 p-3">
                    <summary className="cursor-pointer text-sm font-black text-brand-green-ink">
                      Planned BOM requirement ({bom.length})
                    </summary>
                    <div className="mt-2 space-y-1">
                      {bom.map((line) => {
                        const requirement = calculateBomRequirement(line, order.totalPairs);
                        return (
                          <p key={line.id} className="text-xs text-gray-600">
                            {line.materialName}: {requirement.requiredQuantity} {line.unit}
                            {line.wastagePercent > 0 ? ` (includes ${line.wastagePercent}% wastage)` : ""}
                          </p>
                        );
                      })}
                      {bom.length === 0 ? <p className="text-xs text-amber-700">BOM not configured for this item.</p> : null}
                    </div>
                  </details>
                  <p className="mt-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-700">
                    Verified production wage: Rs. {verifiedWage.toLocaleString("en-IN")}
                    {" · "}Draft material cost: Rs. {draftMaterialCost.toLocaleString("en-IN")}
                    {" · "}Combined preview: Rs. {(verifiedWage + draftMaterialCost).toLocaleString("en-IN")}
                  </p>
                  {materialOptions.length > 0 &&
                  !["Completed", "Cancelled"].includes(order.status) ? (
                    <MaterialIssueDraftForm
                      workOrderId={order.id}
                      materials={materialOptions}
                    />
                  ) : null}
                  {factory.materialIssues.some(
                    (issue) => issue.workOrderId === order.id,
                  ) ? (
                    <details className="mt-3 rounded-xl border border-orange-100 bg-orange-50 p-3">
                      <summary className="cursor-pointer text-sm font-black text-orange-900">
                        Material issue ledger
                      </summary>
                      <div className="mt-3 space-y-2">
                        {factory.materialIssues
                          .filter((issue) => issue.workOrderId === order.id)
                          .map((issue) => (
                            <div key={issue.id} className="rounded-lg bg-white p-2 text-xs text-gray-700">
                              <p>
                                <strong>{issue.materialName}</strong>: {issue.quantity} {issue.unit}
                                {" · "}Rs. {issue.totalCost.toLocaleString("en-IN")}
                                {" · "}{issue.status}
                                {issue.returnedQuantity > 0
                                  ? ` · returned ${issue.returnedQuantity}`
                                  : ""}
                              </p>
                              {issue.postedAt ? (
                                <p className="mt-1 text-[11px] text-gray-500">
                                  Posted by {issue.postedBy} ·{" "}
                                  {new Date(issue.postedAt).toLocaleString("en-NP")}
                                </p>
                              ) : null}
                              <MaterialIssuePostingControls issue={issue} />
                            </div>
                          ))}
                      </div>
                    </details>
                  ) : null}
                  {packingApproval ? (
                    packingApproval.stockPostedAt ? (
                      <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
                        Stock posted: {packingApproval.approvedPairs} pairs ·{" "}
                        {packingApproval.stockMovementIds.length} size movements · by{" "}
                        {packingApproval.stockPostedBy} ·{" "}
                        {new Date(packingApproval.stockPostedAt).toLocaleString("en-NP")}
                      </p>
                    ) : (
                      <FinishedStockPostingForm
                        workOrderId={order.id}
                        pairs={packingApproval.approvedPairs}
                        canPost={
                          order.status === "Ready for Stock" && materialsFinalized
                        }
                        message={
                          materialsFinalized
                            ? "Packing and material reconciliation are complete. Owner confirmation will increase finished stock."
                            : "Post and finalize every raw-material issue before finished stock can increase."
                        }
                      />
                    )
                  ) : null}
                  {order.status === "Draft" && item ? (
                    <WorkOrderReleaseForm
                      workOrderId={order.id}
                      stages={releaseStages}
                      bomReady={bom.length > 0}
                    />
                  ) : null}
                  {assignments.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      {assignments.map((assignment) => {
                        const stage = factoryStages.find((entry) => entry.code === assignment.stageCode);
                        const assignmentPlan = getFactoryAssignmentSizePlan(factory, assignment);
                        const validEntries = factory.productionEntries.filter(
                          (entry) =>
                            entry.assignmentId === assignment.id && entry.status !== "Rejected",
                        );
                        const validEntryIds = new Set(validEntries.map((entry) => entry.id));
                        const remainingSizes = assignmentPlan.map((size) => ({
                          size: size.size,
                          remainingPairs: Math.max(
                            0,
                            size.plannedPairs -
                              factory.productionEntrySizes
                                .filter(
                                  (entry) =>
                                    validEntryIds.has(entry.productionEntryId) &&
                                    entry.size === size.size,
                                )
                                .reduce((sum, entry) => sum + entry.goodPairs, 0),
                          ),
                        }));
                        const nextAssignment = assignments.find(
                          (entry) => entry.sequence === assignment.sequence + 1,
                        );
                        const verifiedEntryIds = new Set(
                          validEntries
                            .filter((entry) => entry.status === "Verified")
                            .map((entry) => entry.id),
                        );
                        const outgoingHandoverIds = new Set(
                          factory.stageHandovers
                            .filter((handover) => handover.fromAssignmentId === assignment.id)
                            .map((handover) => handover.id),
                        );
                        const handoverSizes = sizes.map((size) => ({
                          size: size.size,
                          availablePairs: Math.max(
                            0,
                            factory.productionEntrySizes
                              .filter(
                                (entry) =>
                                  verifiedEntryIds.has(entry.productionEntryId) &&
                                  entry.size === size.size,
                              )
                              .reduce((sum, entry) => sum + entry.goodPairs, 0) -
                              factory.stageHandoverSizes
                                .filter(
                                  (entry) =>
                                    outgoingHandoverIds.has(entry.handoverId) &&
                                    entry.size === size.size,
                                )
                                .reduce((sum, entry) => sum + entry.sentPairs, 0),
                          ),
                        }));
                        return (
                          <div key={assignment.id} className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-black text-emerald-950">
                                {assignment.sequence}. {stage?.name} · {assignment.workerName}
                              </span>
                              <span className="font-bold text-emerald-700">
                                {assignment.status} · Rs. {assignment.ratePerGoodPairSnapshot}/pair
                              </span>
                            </div>
                            {validEntries.length > 0 ? (
                              <p className="mt-2 font-bold text-emerald-800">
                                {validEntries.length} entries · {validEntries.reduce((sum, entry) => sum + entry.goodPairs, 0)} good · Rs. {validEntries.reduce((sum, entry) => sum + entry.calculatedWage, 0).toLocaleString("en-IN")} pending verification
                              </p>
                            ) : null}
                            {order.currentStageCode === assignment.stageCode ? (
                              <StagePauseControls
                                assignmentId={assignment.id}
                                status={assignment.status}
                                pauseReason={assignment.pauseReason}
                                pausedBy={assignment.pausedBy}
                                pausedAt={assignment.pausedAt}
                              />
                            ) : null}
                            {assignment.status !== "Completed" ? (
                              <StageWorkerReassignmentForm
                                assignmentId={assignment.id}
                                currentWorkerId={assignment.workerId}
                                currentRate={assignment.ratePerGoodPairSnapshot}
                                cameraZone={assignment.cameraZone}
                                workers={factory.workerLinks
                                  .filter(
                                    (link) =>
                                      link.active &&
                                      link.stageCodes.includes(assignment.stageCode),
                                  )
                                  .flatMap((link) => {
                                    const employee = hr.employees.find(
                                      (entry) =>
                                        entry.id === link.employeeId &&
                                        entry.status === "Active",
                                    );
                                    return employee
                                      ? [{ id: employee.id, name: employee.name }]
                                      : [];
                                  })}
                              />
                            ) : null}
                            {["Ready", "In Progress"].includes(assignment.status) &&
                            remainingSizes.some((row) => row.remainingPairs > 0) ? (
                              <ProductionEntryForm
                                assignmentId={assignment.id}
                                sizes={remainingSizes}
                                wageRate={assignment.ratePerGoodPairSnapshot}
                              />
                            ) : null}
                            {nextAssignment &&
                            handoverSizes.some((row) => row.availablePairs > 0) ? (
                              <StageHandoverForm
                                fromAssignmentId={assignment.id}
                                sizes={handoverSizes}
                                toStageName={
                                  factoryStages.find(
                                    (entry) => entry.code === nextAssignment.stageCode,
                                  )?.name ?? nextAssignment.stageCode
                                }
                                toWorkerName={nextAssignment.workerName}
                              />
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  {factory.stageHandovers.some((handover) => handover.workOrderId === order.id) ? (
                    <details className="mt-4 rounded-xl border border-purple-100 bg-purple-50 p-3">
                      <summary className="cursor-pointer text-sm font-black text-purple-900">
                        Handover history
                      </summary>
                      <div className="mt-3 space-y-2">
                        {factory.stageHandovers
                          .filter((handover) => handover.workOrderId === order.id)
                          .map((handover) => (
                            <div key={handover.id} className="rounded-lg bg-white p-3 text-xs text-gray-700">
                              <p className="font-black text-purple-950">
                                {factoryStages.find((stage) => stage.code === handover.fromStageCode)?.name}
                                {" → "}
                                {factoryStages.find((stage) => stage.code === handover.toStageCode)?.name}
                              </p>
                              <p className="mt-1">
                                {handover.fromWorkerName} → {handover.toWorkerName} · Sent {handover.sentPairs} · Received {handover.receivedPairs} · Difference {handover.discrepancyPairs}
                              </p>
                              {handover.remarks ? <p className="mt-1 font-semibold text-amber-700">{handover.remarks}</p> : null}
                            </div>
                          ))}
                      </div>
                    </details>
                  ) : null}
                  {packingReadiness.packingAssignment &&
                  !packingReadiness.existingApproval &&
                  order.status !== "Draft" ? (
                    <PackingApprovalForm
                      workOrderId={order.id}
                      rows={packingReadiness.sizes}
                      pendingEntries={packingReadiness.pendingEntries}
                      ready={packingReadiness.ready}
                    />
                  ) : null}
                  {packingReadiness.existingApproval ? (
                    <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-3 text-xs text-teal-900">
                      <p className="font-black">
                        Ready for Stock · {packingReadiness.existingApproval.approvedPairs} pairs
                      </p>
                      <p className="mt-1">
                        Approved by {packingReadiness.existingApproval.approvedBy}
                      </p>
                      <p className="mt-1 font-bold">
                        Stock posting is still locked in shadow mode.
                      </p>
                    </div>
                  ) : null}
                </div>
              );
            })}
            {filteredWorkOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 px-5 py-10 text-center">
                <p className="font-black text-brand-green-ink">No matching Work Orders</p>
                <p className="mt-2 text-sm text-gray-500">Clear filters or create a new mixed-size Work Order.</p>
              </div>
            ) : null}
          </div>
        </article>
      </div>

      <article className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-clay">
              QC and wage control
            </p>
            <h2 className="mt-2 text-xl font-black text-brand-green-ink">
              Production Verification Inbox
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
              Submitted output becomes wage-eligible only after Owner/Supervisor verification.
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
            {factory.productionEntries.filter((entry) => entry.status === "Submitted").length} pending
          </span>
        </div>
        {params?.verified ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
            Production entry verification saved.
          </p>
        ) : null}
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {factory.productionEntries
            .filter((entry) => entry.status === "Submitted")
            .map((entry) => {
              const order = factory.workOrders.find((row) => row.id === entry.workOrderId);
              const stage = factoryStages.find((row) => row.code === entry.stageCode);
              const sizeRows = factory.productionEntrySizes.filter(
                (row) => row.productionEntryId === entry.id,
              );
              return (
                <div key={entry.id} className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-blue-700">
                    {order?.workOrderNumber} · {stage?.name}
                  </p>
                  <h3 className="mt-1 font-black text-brand-green-ink">{entry.workerName}</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {entry.entryDate} · Received {entry.receivedPairs} · Good {entry.goodPairs} ·
                    Reject {entry.rejectPairs} · Rework {entry.reworkPairs}
                  </p>
                  <p className="mt-1 text-sm font-black text-blue-800">
                    Wage preview: Rs. {entry.calculatedWage.toLocaleString("en-IN")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sizeRows.map((row) => (
                      <span key={row.id} className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-gray-700">
                        {row.size}: G{row.goodPairs}/R{row.rejectPairs}/RW{row.reworkPairs}
                      </span>
                    ))}
                  </div>
                  <ProductionVerificationForm
                    entryId={entry.id}
                    hasQualityIssue={entry.rejectPairs > 0 || entry.reworkPairs > 0}
                    workers={hr.employees
                      .filter((employee) => employee.status === "Active")
                      .map((employee) => ({ id: employee.id, name: employee.name }))}
                  />
                </div>
              );
            })}
          {factory.productionEntries.every((entry) => entry.status !== "Submitted") ? (
            <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center xl:col-span-2">
              <p className="font-black text-brand-green-ink">Verification inbox is clear</p>
              <p className="mt-2 text-sm text-gray-500">New submitted production entries will appear here.</p>
            </div>
          ) : null}
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Verified good"
            value={factory.productionEntries.filter((entry) => entry.status === "Verified").reduce((sum, entry) => sum + entry.goodPairs, 0)}
            detail="Approved pairs across all stages"
            tone="good"
          />
          <StatCard
            label="Verified wage"
            value={factory.productionEntries.filter((entry) => entry.status === "Verified").reduce((sum, entry) => sum + entry.calculatedWage, 0)}
            detail="Approved preview; not posted to payroll"
          />
          <StatCard
            label="Rejected entries"
            value={factory.productionEntries.filter((entry) => entry.status === "Rejected").length}
            detail="Excluded from output and wage"
            tone="warn"
          />
        </div>
      </article>

      {reviewCount > 0 ? (
        <article className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
          <h2 className="text-lg font-black text-amber-950">Worker ID migration review</h2>
          <p className="mt-2 text-sm leading-6 text-amber-900/75">
            These legacy names must be confirmed before tasks are attached to permanent HR
            Employee IDs. Nothing has been changed automatically.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {[...audit.unlinkedWorkerNames, ...audit.ambiguousWorkerNames].map((name) => (
              <span key={name} className="rounded-full border border-amber-300 bg-white px-3 py-1 text-sm font-bold text-amber-900">
                {name}
              </span>
            ))}
          </div>
        </article>
      ) : null}
    </section>
  );
}
