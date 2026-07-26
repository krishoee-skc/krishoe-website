import type { Metadata } from "next";
import Link from "next/link";
import ProductionVerificationForm from "@/app/admin/factory/ProductionVerificationForm";
import { requireAdminPermission } from "@/lib/admin-permissions";
import {
  factoryStages,
  factoryWorkOrderTracePath,
  getFactoryData,
  getFactoryQcInbox,
  isFactoryStageCode,
} from "@/lib/factory";
import { getHrData } from "@/lib/hr";

export const metadata: Metadata = { title: "QC Mode | KRISHOE Factory" };
export const dynamic = "force-dynamic";

export default async function FactoryQcPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
    worker?: string;
    stage?: string;
    issues?: string;
    verified?: string;
  }>;
}) {
  await requireAdminPermission("factory:write");
  const [factory, hr, params] = await Promise.all([
    getFactoryData(),
    getHrData(),
    searchParams,
  ]);
  const requestedStage = params?.stage ?? "";
  const stageCode = isFactoryStageCode(requestedStage) ? requestedStage : "";
  const activeWorkers = hr.employees
    .filter((employee) => employee.status === "Active")
    .map((employee) => ({ id: employee.id, name: employee.name }));
  const inbox = getFactoryQcInbox(factory, {
    query: params?.q,
    workerId: params?.worker,
    stageCode,
    issuesOnly: params?.issues === "1",
  });

  return (
    <section className="p-3 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-3xl bg-gradient-to-br from-blue-950 to-brand-green-ink p-5 text-white shadow-lg">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-200">
            KRISHOE Factory
          </p>
          <h1 className="mt-2 text-3xl font-black">QC Mode</h1>
          <p className="mt-2 text-sm text-blue-50/80">
            Verify submitted production before wage, handover and stock posting.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/admin/factory" className="inline-flex min-h-11 items-center rounded-xl border border-white/30 px-4 text-sm font-black">
              Owner dashboard
            </Link>
            <Link href="/admin/factory/station" className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-sm font-black text-blue-950">
              Station Mode
            </Link>
          </div>
        </header>

        {params?.verified ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
            QC verification saved successfully.
          </p>
        ) : null}

        <form action="/admin/factory/qc" className="mt-4 grid gap-2 rounded-2xl border bg-white p-3 sm:grid-cols-2">
          <input name="q" defaultValue={params?.q} placeholder="Search lot, item, colour or worker" className="min-h-12 rounded-xl border border-gray-200 px-3" />
          <select name="worker" defaultValue={params?.worker ?? ""} className="min-h-12 rounded-xl border border-gray-200 bg-white px-3">
            <option value="">All workers</option>
            {activeWorkers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}
          </select>
          <select name="stage" defaultValue={stageCode} className="min-h-12 rounded-xl border border-gray-200 bg-white px-3">
            <option value="">All stages</option>
            {factoryStages.map((stage) => <option key={stage.code} value={stage.code}>{stage.name}</option>)}
          </select>
          <div className="flex min-h-12 items-center gap-3 rounded-xl border border-gray-200 px-3">
            <label className="flex flex-1 items-center gap-2 text-sm font-bold">
              <input type="checkbox" name="issues" value="1" defaultChecked={params?.issues === "1"} className="h-4 w-4" />
              Reject/Rework only
            </label>
            <button className="min-h-10 rounded-lg bg-blue-800 px-4 text-xs font-black text-white">Apply</button>
          </div>
        </form>

        <div className="mt-4 flex items-center justify-between gap-3">
          <h2 className="font-black text-brand-green-ink">Verification inbox</h2>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-800">{inbox.length} pending</span>
        </div>

        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {inbox.map(({ entry, workOrder }) => {
            const sizeRows = factory.productionEntrySizes.filter(
              (row) => row.productionEntryId === entry.id,
            );
            const stageName =
              factoryStages.find((stage) => stage.code === entry.stageCode)?.name ??
              entry.stageCode;
            const hasIssue = entry.rejectPairs + entry.reworkPairs > 0;
            return (
              <article key={entry.id} className={`rounded-3xl border bg-white p-4 shadow-sm ${hasIssue ? "border-red-200" : "border-blue-200"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-blue-700">{workOrder?.workOrderNumber ?? entry.workOrderId}</p>
                    <h3 className="mt-1 text-lg font-black text-brand-green-ink">{workOrder?.itemName ?? "Production entry"}</h3>
                    <p className="mt-1 text-sm text-gray-600">{stageName} - {entry.workerName}</p>
                  </div>
                  {hasIssue ? <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-black text-red-800">QC issue</span> : null}
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                  {[
                    ["Received", entry.receivedPairs],
                    ["Good", entry.goodPairs],
                    ["Reject", entry.rejectPairs],
                    ["Rework", entry.reworkPairs],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-gray-50 p-2">
                      <p className="font-black text-brand-green-ink">{value}</p>
                      <p className="mt-1 text-gray-500">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {sizeRows.map((row) => (
                    <span key={row.id} className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-bold">
                      {row.size}: G{row.goodPairs}/R{row.rejectPairs}/RW{row.reworkPairs}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-sm font-black text-blue-800">
                  Wage preview: Rs. {entry.calculatedWage.toLocaleString("en-IN")}
                </p>
                <ProductionVerificationForm
                  entryId={entry.id}
                  hasQualityIssue={hasIssue}
                  workers={activeWorkers}
                  returnTo="/admin/factory/qc"
                />
                {workOrder ? (
                  <Link href={factoryWorkOrderTracePath(workOrder.id)} className="mt-3 inline-flex min-h-11 items-center text-sm font-black text-brand-green">
                    Open full lot trace
                  </Link>
                ) : null}
              </article>
            );
          })}
          {inbox.length === 0 ? (
            <div className="rounded-3xl border border-dashed bg-white p-10 text-center lg:col-span-2">
              <p className="font-black text-brand-green-ink">QC inbox is clear</p>
              <p className="mt-2 text-sm text-gray-500">New submitted production entries will appear here.</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
