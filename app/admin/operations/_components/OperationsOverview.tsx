import Link from "next/link";
import type {
  OperationsCostingSnapshot,
  OperationsSnapshot,
} from "@/app/admin/operations/_components/types";
import { money, SectionTitle, StatCard } from "@/app/admin/operations/_components/operations-ui";

function ReportLine({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "good" | "warn";
}) {
  const valueClass =
    tone === "good" ? "text-[#0B4D3B]" : tone === "warn" ? "text-[#7B3128]" : "text-[#10231D]";

  return (
    <div className="flex items-center justify-between gap-4 border-b border-gray-100 py-2 last:border-b-0">
      <dt className="text-sm font-semibold text-gray-500">{label}</dt>
      <dd className={`text-sm font-black ${valueClass}`}>{value}</dd>
    </div>
  );
}

function stockSignalClass(signal: string) {
  if (signal === "Healthy") return "bg-[#EAF5EF] text-[#0B4D3B]";
  if (signal === "Return watch") return "bg-[#FFF7DF] text-[#7A5A00]";
  return "bg-[#FBEAE8] text-[#7B3128]";
}

function catalogSyncClass(signal: string) {
  if (signal === "Matched") return "bg-[#EAF5EF] text-[#0B4D3B]";
  if (signal === "Catalog high" || signal === "Catalog low") return "bg-[#FFF7DF] text-[#7A5A00]";
  return "bg-[#FBEAE8] text-[#7B3128]";
}

function stockLedgerSignalClass(signal: string) {
  if (signal === "Balanced") return "bg-[#EAF5EF] text-[#0B4D3B]";
  if (signal === "Watch") return "bg-[#FFF7DF] text-[#7A5A00]";
  return "bg-[#FBEAE8] text-[#7B3128]";
}

function collectionPriorityClass(priority: string) {
  if (priority === "Clear") return "bg-[#EAF5EF] text-[#0B4D3B]";
  if (priority === "Monitor" || priority === "Medium") return "bg-[#FFF7DF] text-[#7A5A00]";
  return "bg-[#FBEAE8] text-[#7B3128]";
}

const reportExports = [
  { label: "Production CSV", href: "/api/admin/operations/export?type=production-insights" },
  { label: "Worker CSV", href: "/api/admin/operations/export?type=worker-tasks" },
  { label: "Material CSV", href: "/api/admin/operations/export?type=material-consumptions" },
  { label: "Dispatch CSV", href: "/api/admin/operations/export?type=vehicle-dispatch-items" },
  { label: "Finished CSV", href: "/api/admin/operations/export?type=finished-stock" },
  { label: "Stock CSV", href: "/api/admin/operations/export?type=stock-movements" },
  { label: "Stock ledger CSV", href: "/api/admin/operations/export?type=stock-ledger-summary" },
  { label: "Stock health CSV", href: "/api/admin/operations/export?type=stock-health" },
  { label: "Stock flow CSV", href: "/api/admin/operations/export?type=stock-flow-summary" },
  { label: "Raw value CSV", href: "/api/admin/costing/export?type=stock-valuation" },
  { label: "Finished value CSV", href: "/api/admin/costing/export?type=finished-stock-value" },
  { label: "Catalog sync CSV", href: "/api/admin/costing/export?type=catalog-stock-sync" },
  { label: "Ledger aging CSV", href: "/api/admin/operations/export?type=ledger-aging" },
  { label: "Follow-up CSV", href: "/api/admin/operations/export?type=ledger-followups" },
  { label: "Ledger txn CSV", href: "/api/admin/operations/export?type=ledger-transactions" },
];

export default function OperationsOverview({
  snapshot,
  costing,
}: {
  snapshot: OperationsSnapshot;
  costing: OperationsCostingSnapshot;
}) {
  const reports = snapshot.reports;
  const topStockFlows = reports.stockMovementByDesignChannel.slice(0, 4);
  const stockLedgerWatchRows = reports.stockLedgerRows
    .filter((stock) => stock.signal !== "Balanced")
    .slice(0, 4);
  const stockWatchRows = reports.stockHealthRows
    .filter((stock) => stock.signal !== "Healthy")
    .slice(0, 4);
  const rawStockWatchRows = costing.rawMaterialStockValuation
    .filter((material) => material.lowStock || !material.hasPurchaseRate)
    .slice(0, 4);
  const finishedStockWatchRows = costing.finishedStockValuation
    .filter((stock) => stock.signal !== "Profit ready" && stock.stockPairs > 0)
    .slice(0, 4);
  const catalogMismatchRows = costing.catalogStockReconciliation
    .filter((stock) => stock.signal !== "Matched")
    .slice(0, 4);
  const riskyLedgerRows = reports.ledgerCollectionFollowups
    .filter((ledger) => ledger.priority !== "Clear")
    .slice(0, 4);

  return (
    <>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Planned production" value={snapshot.summary.plannedPairs} detail="pairs" />
        <StatCard label="Finished goods" value={snapshot.summary.finishedPairs} detail="ready pairs" />
        <StatCard label="Work in progress" value={snapshot.summary.inProgressPairs} detail="factory floor" />
        <StatCard label="Raw stock value" value={money(costing.summary.rawMaterialStockValue)} detail={`${costing.summary.unpricedStockMaterialCount} unpriced items`} />
        <StatCard label="Low stock need" value={money(costing.summary.lowStockMaterialValue)} detail="estimated reorder value" />
        <StatCard label="Finished value" value={money(costing.summary.finishedStockValue)} detail={`${costing.summary.finishedStockMissingCostCount} cost gaps`} />
        <StatCard label="Stock profit" value={money(costing.summary.finishedStockPotentialProfit)} detail={`${costing.summary.finishedStockMissingPriceCount} price gaps`} />
        <StatCard label="Catalog mismatch" value={costing.summary.catalogStockMismatchCount} detail={`${costing.summary.catalogStockDeltaPairs} pair delta`} />
        <StatCard label="Receivable" value={money(snapshot.summary.receivable)} detail="customer ledger" />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <SectionTitle
            title="Production control"
            detail="Batch output, wastage, raw material link, and worker progress."
          />
          <div className="grid gap-3">
            {reports.productionInsights.slice(0, 4).map((batch) => (
              <div key={batch.id} className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-[#10231D]">{batch.design}</p>
                  <span className="rounded-full bg-[#F5F7F4] px-3 py-1 text-xs font-bold text-[#0B4D3B]">
                    {batch.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-600">
                  Production {batch.productionCompletionRate}% | Worker {batch.workerProgressRate}% | Reject {batch.rejectRate}%
                </p>
                <p className="mt-1 text-xs font-semibold text-gray-500">
                  {batch.linkedTaskCount} tasks, {batch.materialCount} materials, {batch.consumptionCount} usage records, wastage {batch.materialWastageRate}%
                  {batch.missingRawMaterials.length > 0
                    ? `, missing: ${batch.missingRawMaterials.join(", ")}`
                    : ""}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-gray-100 pt-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0B4D3B]">
              Station progress
            </p>
            {reports.workerProgressByStation.slice(0, 3).map((station) => (
              <p key={station.station} className="mt-2 text-xs font-semibold text-gray-600">
                {station.station}: {station.completedPairs}/{station.targetPairs} pairs ({station.progressRate}%)
              </p>
            ))}
            {reports.unlinkedWorkerTasks.length > 0 ? (
              <p className="mt-2 text-xs font-bold text-[#7B3128]">
                {reports.unlinkedWorkerTasks.length} worker tasks need batch link.
              </p>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <SectionTitle title="Stock flow" detail="Movement totals and channel stock signal." />
          <dl>
            <ReportLine label="Production in" value={reports.stockMovementTotals["Production In"]} tone="good" />
            <ReportLine label="Dispatch out" value={reports.stockMovementTotals["Dispatch Out"]} />
            <ReportLine label="Sale out" value={reports.stockMovementTotals["Sale Out"]} />
            <ReportLine label="Market sale" value={reports.stockMovementTotals["Market Sale"]} />
            <ReportLine label="Return in" value={reports.stockMovementTotals["Return In"]} tone="warn" />
            <ReportLine label="Adjustment" value={reports.stockMovementTotals.Adjustment} />
          </dl>
          <div className="mt-4 grid gap-2 text-xs font-semibold text-gray-600">
            {(["Factory", "Wholesale", "Retail", "Online"] as const).map((channel) => (
              <div key={channel} className="grid grid-cols-[5.5rem_1fr] gap-2 border-b border-gray-100 py-1 last:border-b-0">
                <p className="font-black text-[#10231D]">{channel}</p>
                <p>
                  Stock {reports.stockByChannel[channel].stockPairs} | Sold{" "}
                  {reports.stockByChannel[channel].soldPairs} | Return{" "}
                  {reports.stockByChannel[channel].returnedPairs}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-gray-100 pt-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#10231D]">
              Active stock flow
            </p>
            {topStockFlows.length > 0 ? (
              topStockFlows.map((flow) => (
                <div key={flow.key} className="mt-2 text-xs font-semibold text-gray-600">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold text-[#10231D]">{flow.design}</p>
                    <p>{flow.channel}</p>
                  </div>
                  <p>
                    Net {flow.netStockFlow}, sold {flow.soldPairs}, return {flow.returnedPairs}
                  </p>
                </div>
              ))
            ) : (
              <p className="mt-2 text-xs font-semibold text-gray-500">No movement summary yet.</p>
            )}
          </div>
          <div className="mt-4 border-t border-gray-100 pt-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7B3128]">
              Stock ledger accuracy
            </p>
            {stockLedgerWatchRows.length > 0 ? (
              stockLedgerWatchRows.map((stock) => (
                <div key={stock.id} className="mt-2 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-bold text-[#10231D]">{stock.design}</p>
                    <p className="font-semibold text-gray-500">
                      {stock.channel} | book {stock.stockPairs} | movement {stock.movementStockPairs} | variance{" "}
                      {stock.variancePairs}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 font-bold ${stockLedgerSignalClass(stock.signal)}`}>
                    {stock.signal}
                  </span>
                </div>
              ))
            ) : (
              <p className="mt-2 text-xs font-semibold text-gray-500">Stock ledger rows are balanced.</p>
            )}
          </div>
          <div className="mt-4 border-t border-gray-100 pt-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7B3128]">
              Stock watch
            </p>
            {stockWatchRows.length > 0 ? (
              stockWatchRows.map((stock) => (
                <div key={stock.id} className="mt-2 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-bold text-[#10231D]">{stock.design}</p>
                    <p className="font-semibold text-gray-500">
                      {stock.channel} | {stock.stockPairs} pairs | return {stock.returnRate}%
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 font-bold ${stockSignalClass(stock.signal)}`}>
                    {stock.signal}
                  </span>
                </div>
              ))
            ) : (
              <p className="mt-2 text-xs font-semibold text-gray-500">No stock alerts.</p>
            )}
          </div>
          <div className="mt-4 border-t border-gray-100 pt-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#10231D]">
                Finished value
              </p>
              <Link href="/admin/costing" className="text-xs font-black text-[#0B4D3B] underline underline-offset-4">
                Costing
              </Link>
            </div>
            <p className="mt-2 text-xs font-semibold text-gray-600">
              Value {money(costing.summary.finishedStockValue)} | profit potential{" "}
              {money(costing.summary.finishedStockPotentialProfit)}
            </p>
            {finishedStockWatchRows.length > 0 ? (
              finishedStockWatchRows.map((stock) => (
                <div key={stock.stockId} className="mt-2 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-bold text-[#10231D]">{stock.design}</p>
                    <p className="font-semibold text-gray-500">
                      {stock.channel} | {stock.stockPairs} pairs | value {money(stock.stockValue)}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#FFF7DF] px-3 py-1 font-bold text-[#7A5A00]">
                    {stock.signal}
                  </span>
                </div>
              ))
            ) : (
              <p className="mt-2 text-xs font-semibold text-gray-500">Finished stock is profit ready.</p>
            )}
          </div>
          <div className="mt-4 border-t border-gray-100 pt-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7B3128]">
                Catalog sync
              </p>
              <Link href="/admin/costing" className="text-xs font-black text-[#0B4D3B] underline underline-offset-4">
                Review
              </Link>
            </div>
            <p className="mt-2 text-xs font-semibold text-gray-600">
              {costing.summary.catalogStockMismatchCount} mismatch rows,{" "}
              {costing.summary.catalogStockDeltaPairs} pair delta
            </p>
            {catalogMismatchRows.length > 0 ? (
              catalogMismatchRows.map((stock) => (
                <div key={stock.key} className="mt-2 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-bold text-[#10231D]">
                      {stock.productName || stock.operationsDesign || "Unmatched stock"}
                    </p>
                    <p className="font-semibold text-gray-500">
                      Catalog {stock.catalogStock} | operations {stock.operationsStockPairs} | delta{" "}
                      {stock.stockDelta}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 font-bold ${catalogSyncClass(stock.signal)}`}>
                    {stock.signal}
                  </span>
                </div>
              ))
            ) : (
              <p className="mt-2 text-xs font-semibold text-gray-500">Catalog and operations stock match.</p>
            )}
          </div>
          <div className="mt-4 border-t border-gray-100 pt-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0B4D3B]">
              Raw material usage
            </p>
            {reports.materialUsage.slice(0, 3).map((material) => (
              <p key={material.id} className="mt-2 text-xs font-semibold text-gray-600">
                {material.name}: {material.recordedTotal} {material.unit}, wastage {material.wastageRate}%
              </p>
            ))}
          </div>
          <div className="mt-4 border-t border-gray-100 pt-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#10231D]">
                Raw stock value
              </p>
              <Link href="/admin/costing" className="text-xs font-black text-[#0B4D3B] underline underline-offset-4">
                Costing
              </Link>
            </div>
            <p className="mt-2 text-xs font-semibold text-gray-600">
              Value {money(costing.summary.rawMaterialStockValue)} | Reorder need{" "}
              {money(costing.summary.lowStockMaterialValue)}
            </p>
            {rawStockWatchRows.length > 0 ? (
              rawStockWatchRows.map((material) => (
                <div key={material.materialId} className="mt-2 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-bold text-[#10231D]">{material.materialName}</p>
                    <p className="font-semibold text-gray-500">
                      Balance {material.balance} {material.unit} | value {money(material.stockValue)}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 font-bold ${
                    material.hasPurchaseRate ? "bg-[#FFF7DF] text-[#7A5A00]" : "bg-[#FBEAE8] text-[#7B3128]"
                  }`}>
                    {material.hasPurchaseRate ? "Reorder" : "Rate missing"}
                  </span>
                </div>
              ))
            ) : (
              <p className="mt-2 text-xs font-semibold text-gray-500">Raw stock value is covered.</p>
            )}
          </div>
          <div className="mt-4 border-t border-gray-100 pt-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7B3128]">
              Vehicle item totals
            </p>
            <p className="mt-2 text-xs font-semibold text-gray-600">
              Loaded {reports.dispatchItemTotals.loadedPairs}, sold {reports.dispatchItemTotals.soldPairs}, return {reports.dispatchItemTotals.returnedPairs}
            </p>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <SectionTitle title="Ledger health" detail="Receivable aging, collection, and credit movement." />
          <dl>
            <ReportLine label="0-30 days" value={money(reports.ledgerAging.due0To30)} />
            <ReportLine label="31-60 days" value={money(reports.ledgerAging.due31To60)} tone="warn" />
            <ReportLine label="60+ days" value={money(reports.ledgerAging.dueOver60)} tone="warn" />
            <ReportLine label="Urgent follow-up" value={money(reports.ledgerCollectionSummary.urgentDue)} tone="warn" />
            <ReportLine label="This week due" value={money(reports.ledgerCollectionSummary.dueThisWeek)} />
            <ReportLine label="Txn collection" value={money(reports.collectionFromLedgerTransactions)} tone="good" />
            <ReportLine label="Net credit" value={money(reports.netLedgerCredit)} />
          </dl>
          <div className="mt-4 grid gap-2 border-t border-gray-100 pt-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7B3128]">
              Collection priority
            </p>
            {riskyLedgerRows.map((ledger) => (
              <Link
                key={ledger.id}
                href={`/admin/operations/ledger/${ledger.id}`}
                className="grid gap-2 rounded-md border border-gray-100 p-3 text-xs transition hover:border-[#0B4D3B]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-[#10231D]">{ledger.customerName}</span>
                  <span className={`rounded-full px-3 py-1 font-bold ${collectionPriorityClass(ledger.priority)}`}>
                    {ledger.priority}
                  </span>
                </div>
                <p className="font-semibold text-gray-500">
                  {money(ledger.balanceDue)} | {ledger.daysOutstanding} days | due {ledger.followUpDueDate || "-"}
                </p>
              </Link>
            ))}
            {riskyLedgerRows.length === 0 ? (
              <p className="text-xs font-semibold text-gray-500">No collection follow-up is due.</p>
            ) : null}
          </div>
          <div className="mt-4 border-t border-gray-100 pt-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#10231D]">
              Ledger transaction mix
            </p>
            <p className="mt-2 text-xs font-semibold text-gray-600">
              Cash {money(reports.ledgerTransactionTotals["Cash Payment"])}, cheque{" "}
              {money(reports.ledgerTransactionTotals["Cheque Payment"])}
            </p>
            <p className="mt-1 text-xs font-semibold text-gray-600">
              Credit {money(reports.ledgerTransactionTotals["Credit Sale"])}, return adj{" "}
              {money(reports.ledgerTransactionTotals["Return Adjustment"])}
            </p>
          </div>
          <div className="mt-4 border-t border-gray-100 pt-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0B4D3B]">
              Top vehicle collection
            </p>
            {reports.dispatchPerformance.slice(0, 2).map((dispatch) => (
              <p key={dispatch.id} className="mt-2 text-xs font-semibold text-gray-600">
                {dispatch.vehicleNumber}: {money(dispatch.totalCollection)} collection, return {dispatch.returnRate}%
              </p>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-[#10231D]">Report exports</h2>
            <p className="mt-1 text-sm text-gray-500">
              Download admin-only CSV reports for factory, stock, and customer ledger review.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {reportExports.map((report) => (
              <a
                key={report.href}
                href={report.href}
                className="inline-flex h-9 items-center rounded-full border border-gray-200 px-3 text-xs font-bold text-[#10231D] transition hover:border-[#0B4D3B] hover:text-[#0B4D3B]"
              >
                {report.label}
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
