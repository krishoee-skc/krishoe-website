import type { Metadata } from "next";
import OperationsOverview from "@/app/admin/operations/_components/OperationsOverview";
import OperationsQuickEntry from "@/app/admin/operations/_components/OperationsQuickEntry";
import OperationsRecords from "@/app/admin/operations/_components/OperationsRecords";
import { getCostingSnapshot } from "@/lib/costing";
import { getOperationsSnapshot } from "@/lib/operations";
import { getHrData } from "@/lib/hr";
import { reportError } from "@/lib/report-error";

export const metadata: Metadata = {
  title: "Operations | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

export default async function AdminOperationsPage() {
  const [snapshot, costing] = await Promise.all([
    getOperationsSnapshot(),
    getCostingSnapshot(),
  ]);

  // The worker-task form picks a name from here instead of typing it. Loaded on
  // its own and guarded, so an HR hiccup leaves the field typeable rather than
  // taking the operations page down with it.
  let workerNames: string[] = [];
  try {
    const hr = await getHrData();
    workerNames = [...new Set(hr.employees.filter((employee) => employee.status === "Active").map((employee) => employee.name))].sort(
      (left, right) => left.localeCompare(right),
    );
  } catch (error) {
    reportError("load employee names for the worker task form", error);
  }

  return (
    <section className="p-6">
      <div>
        <h1 className="text-2xl font-black text-brand-green-ink">
          Factory, wholesale, retail and online operations
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
          Raw material, production progress, worker tasks, QC, finished stock,
          vehicle dispatch, sales return, and customer ledger control.
        </p>
      </div>

      <OperationsOverview snapshot={snapshot} costing={costing} />
      <OperationsQuickEntry snapshot={snapshot} workerNames={workerNames} />
      <OperationsRecords snapshot={snapshot} costing={costing} />
    </section>
  );
}
