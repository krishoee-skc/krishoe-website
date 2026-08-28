import type { Metadata } from "next";
import T from "@/components/T";
import Link from "next/link";
import OperationsOverview from "@/app/admin/operations/_components/OperationsOverview";
import OperationsQuickEntry from "@/app/admin/operations/_components/OperationsQuickEntry";
import OperationsRecords from "@/app/admin/operations/_components/OperationsRecords";
import { getCostingSnapshot } from "@/lib/costing";
import { getOperationsSnapshot } from "@/lib/operations";
import { listFactoryWorkerOptions } from "@/lib/factory-worker-portal";
import { reportError } from "@/lib/report-error";
import { getProductionControlSummary } from "@/lib/production-accounting";

export const metadata: Metadata = {
  title: "Operations | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

export default async function AdminOperationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string }>;
}) {
  const saved = (await searchParams)?.saved?.trim() ?? "";
  const [snapshot, costing, productionControl] = await Promise.all([
    getOperationsSnapshot(),
    getCostingSnapshot(),
    getProductionControlSummary(),
  ]);

  // The worker-task form picks a name from here instead of typing it. Loaded on
  // its own and guarded, so a hiccup leaves the field typeable rather than
  // taking the operations page down with it.
  let workerNames: string[] = [];
  try {
    const workers = await listFactoryWorkerOptions();
    workerNames = [...new Set(workers.map((worker) => worker.name))].sort((left, right) =>
      left.localeCompare(right),
    );
  } catch (error) {
    reportError("load worker names for the worker task form", error);
  }

  return (
    <section className="p-6">
      {/* Saving used to be silent: the row was written and the page came back
          looking identical, so there was no way to tell it apart from a button
          that did nothing. */}
      {saved ? (
        <p
          role="status"
          className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900"
        >
          ✅ {saved}
        </p>
      ) : null}
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-brand-gold-deep">
          <T en="Operations" ne="उत्पादन र स्टक" />
        </p>
        <h1 className="mt-2 font-display text-3xl font-black leading-tight text-brand-green-ink">
          Factory, wholesale, retail and online operations
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-brand-muted">
          Raw material, production progress, worker tasks, QC, finished stock,
          vehicle dispatch, sales return, and customer ledger control.
        </p>
        <Link
          href="/admin/operations/production-accounts"
          className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-brand-green px-5 text-sm font-black text-white transition hover:bg-brand-green-ink"
        >
          Open production wages & kharcha
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            id: "lots",
            label: <T en="Active factory lots" ne="चलिरहेका lot" />,
            value: productionControl.activeWorkOrders,
            detail: <T en={`${productionControl.overdueWorkOrders} overdue`} ne={`${productionControl.overdueWorkOrders} ढिलो भएको`} />,
          },
          {
            id: "output",
            label: <T en="Today good output" ne="आज बनेको राम्रो माल" />,
            value: <T en={`${productionControl.todayGoodPairs} pairs`} ne={`${productionControl.todayGoodPairs} जोडी`} />,
            detail: <T en={`${productionControl.todayRejectedPairs} rejected`} ne={`${productionControl.todayRejectedPairs} बिग्रेको`} />,
          },
          {
            id: "qc",
            label: <T en="Ready for QC" ne="जाँच्न तयार" />,
            value: productionControl.readyForQc,
            detail: <T en={`${productionControl.todayStockPairs} pairs stocked today`} ne={`आज ${productionControl.todayStockPairs} जोडी स्टकमा चढ्यो`} />,
          },
          {
            id: "wages",
            label: <T en="Worker balance due" ne="कामदारलाई तिर्न बाँकी" />,
            value: `Rs. ${productionControl.workerBalanceDue.toLocaleString("en-IN")}`,
            detail: <T en={`${productionControl.handoverMismatches} handover mismatch`} ne={`${productionControl.handoverMismatches} हस्तान्तरण मिलेन`} />,
          },
        ].map(({ id, label, value, detail }) => (
          <div key={id} className="rounded-xl border border-brand-green-line bg-brand-paper p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wider text-brand-muted">{label}</p>
            <p className="mt-2 text-xl font-black text-brand-green-ink">{value}</p>
            <p className="mt-2 text-xs font-bold text-brand-muted">{detail}</p>
          </div>
        ))}
      </div>

      <OperationsOverview snapshot={snapshot} costing={costing} />
      <OperationsQuickEntry snapshot={snapshot} workerNames={workerNames} />
      <OperationsRecords snapshot={snapshot} costing={costing} />
    </section>
  );
}
