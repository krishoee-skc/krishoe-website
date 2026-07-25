import type { Metadata } from "next";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import WorkOrderForm from "@/app/admin/factory/WorkOrderForm";
import WorkOrderReleaseForm from "@/app/admin/factory/WorkOrderReleaseForm";
import ProductionEntryForm from "@/app/admin/factory/ProductionEntryForm";
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
  getFactoryData,
} from "@/lib/factory";
import { getHrData } from "@/lib/hr";
import { getOperationsData } from "@/lib/operations";
import { requireAdminPermission } from "@/lib/admin-permissions";

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
  }>;
}) {
  await requireAdminPermission("factory:write");
  const [hr, operations, factory, params] = await Promise.all([
    getHrData(),
    getOperationsData(),
    getFactoryData(),
    searchParams,
  ]);
  const audit = auditFactoryFoundation({
    employees: hr.employees,
    productionBatches: operations.productionBatches,
    workerTasks: operations.workerTasks,
  });
  const reviewCount = audit.unlinkedLegacyTaskCount + audit.ambiguousLegacyTaskCount;

  return (
    <section className="p-4 sm:p-6">
      <header className="overflow-hidden rounded-3xl bg-brand-green-ink px-5 py-7 text-white shadow-lg sm:px-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-300">
          KRISHOE Factory V2
        </p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">Factory ERP</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-50/85 sm:text-base">
          A parallel production system that protects the existing HR, sales, POS,
          purchasing and stock flows. Foundation revision is active; automatic wage
          and stock posting remain safely disabled until the pilot is verified.
        </p>
        <div className="mt-5 inline-flex rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-amber-200">
          Shadow mode · no live stock or payroll changes
        </div>
      </header>

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
              <h2 className="mt-2 text-xl font-black text-brand-green-ink">Draft Work Orders</h2>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black text-gray-600">
              {factory.workOrders.length} orders
            </span>
          </div>
          <div className="mt-5 space-y-4">
            {factory.workOrders.map((order) => {
              const sizes = factory.workOrderSizes.filter((row) => row.workOrderId === order.id);
              const bom = factory.bomLines.filter((line) => line.itemId === order.itemId);
              const item = factory.items.find((entry) => entry.id === order.itemId);
              const assignments = factory.stageAssignments.filter((entry) => entry.workOrderId === order.id);
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
                        const validEntries = factory.productionEntries.filter(
                          (entry) =>
                            entry.assignmentId === assignment.id && entry.status !== "Rejected",
                        );
                        const validEntryIds = new Set(validEntries.map((entry) => entry.id));
                        const remainingSizes = sizes.map((size) => ({
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
                                .reduce((sum, entry) => sum + entry.receivedPairs, 0),
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
                            {["Ready", "In Progress"].includes(assignment.status) &&
                            remainingSizes.some((row) => row.remainingPairs > 0) ? (
                              <ProductionEntryForm
                                assignmentId={assignment.id}
                                sizes={remainingSizes}
                                wageRate={assignment.ratePerGoodPairSnapshot}
                              />
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {factory.workOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 px-5 py-10 text-center">
                <p className="font-black text-brand-green-ink">No Work Orders yet</p>
                <p className="mt-2 text-sm text-gray-500">Create the first mixed-size draft for the pilot.</p>
              </div>
            ) : null}
          </div>
        </article>
      </div>

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
