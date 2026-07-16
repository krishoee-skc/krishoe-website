import type { Metadata } from "next";
import OperationsOverview from "@/app/admin/operations/_components/OperationsOverview";
import OperationsQuickEntry from "@/app/admin/operations/_components/OperationsQuickEntry";
import OperationsRecords from "@/app/admin/operations/_components/OperationsRecords";
import { getCostingSnapshot } from "@/lib/costing";
import { getOperationsSnapshot } from "@/lib/operations";

export const metadata: Metadata = {
  title: "Operations | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

export default async function AdminOperationsPage() {
  const [snapshot, costing] = await Promise.all([
    getOperationsSnapshot(),
    getCostingSnapshot(),
  ]);

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
      <OperationsQuickEntry snapshot={snapshot} />
      <OperationsRecords snapshot={snapshot} costing={costing} />
    </section>
  );
}
