import Link from "next/link";
import T from "@/components/T";
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
    tone === "good" ? "text-brand-green" : tone === "warn" ? "text-brand-clay" : "text-brand-green-ink";

  return (
    <div className="flex items-center justify-between gap-4 border-b border-brand-green-line py-2 last:border-b-0">
      <dt className="text-base font-semibold text-brand-muted">{label}</dt>
      <dd className={`text-base font-black ${valueClass}`}>{value}</dd>
    </div>
  );
}

function stockSignalClass(signal: string) {
  if (signal === "Healthy") return "bg-brand-green-tint text-brand-green";
  if (signal === "Return watch") return "bg-brand-cream-soft text-brand-gold-ink";
  return "bg-brand-clay-tint text-brand-clay";
}

function catalogSyncClass(signal: string) {
  if (signal === "Matched") return "bg-brand-green-tint text-brand-green";
  if (signal === "Catalog high" || signal === "Catalog low") return "bg-brand-cream-soft text-brand-gold-ink";
  return "bg-brand-clay-tint text-brand-clay";
}

function stockLedgerSignalClass(signal: string) {
  if (signal === "Balanced") return "bg-brand-green-tint text-brand-green";
  if (signal === "Watch") return "bg-brand-cream-soft text-brand-gold-ink";
  return "bg-brand-clay-tint text-brand-clay";
}

function collectionPriorityClass(priority: string) {
  if (priority === "Clear") return "bg-brand-green-tint text-brand-green";
  if (priority === "Monitor" || priority === "Medium") return "bg-brand-cream-soft text-brand-gold-ink";
  return "bg-brand-clay-tint text-brand-clay";
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
  // One line per shoe: a shoe kept in size rows listed itself once per size.
  const finishedStockWatchRows = [
    ...costing.finishedStockValuation
      .filter((stock) => stock.signal !== "Profit ready" && stock.stockPairs > 0)
      .reduce((byShoe, stock) => {
        const key = `${stock.design.trim().toLowerCase()}::${stock.channel}`;
        const seen = byShoe.get(key);
        byShoe.set(
          key,
          seen
            ? { ...seen, stockPairs: seen.stockPairs + stock.stockPairs, stockValue: seen.stockValue + stock.stockValue }
            : stock,
        );
        return byShoe;
      }, new Map<string, (typeof costing.finishedStockValuation)[number]>())
      .values(),
  ].slice(0, 4);
  const catalogMismatchRows = costing.catalogStockReconciliation
    .filter((stock) => stock.signal !== "Matched")
    .slice(0, 4);
  const riskyLedgerRows = reports.ledgerCollectionFollowups
    .filter((ledger) => ledger.priority !== "Clear")
    .slice(0, 4);

  // Planned / finished / in progress come from production batches, and none
  // has ever been made: three tiles read 0 while 215 pairs stood ready
  // (owner, 2026-09-29). Until batches are used, the ready stock stands in.
  const batchesUsed =
    snapshot.summary.plannedPairs > 0 || snapshot.summary.finishedPairs > 0 || snapshot.summary.inProgressPairs > 0;
  const readyPairs = (["Factory", "Wholesale", "Retail", "Online"] as const).reduce(
    (total, channel) => total + reports.stockByChannel[channel].stockPairs,
    0,
  );
  // A made shoe costed from labour alone reads cheap and very profitable.
  // Said on the tile, rather than a clean figure that is quietly too high.
  const labourOnly = costing.summary.finishedStockLabourOnlyDesigns;
  const rawUsed = snapshot.rawMaterials.length > 0;
  const ledgersUsed = snapshot.customerLedgers.length > 0 || snapshot.summary.receivable > 0;
  const batchPanelUsed = reports.productionInsights.length > 0 || snapshot.workerTasks.length > 0;

  return (
    <>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {batchesUsed ? (
          <>
            <StatCard label="Planned production" value={snapshot.summary.plannedPairs} detail="pairs" />
            <StatCard label="Finished goods" value={snapshot.summary.finishedPairs} detail="ready pairs" />
            <StatCard label="Work in progress" value={snapshot.summary.inProgressPairs} detail="factory floor" />
          </>
        ) : (
          <StatCard
            label={<T en="Ready stock" ne="तयार स्टक" />}
            value={<T en={`${readyPairs} pairs`} ne={`${readyPairs} जोडी`} />}
            detail={<T en="Made and bought, every place" ne="बनेको र किनेको, सबै ठाउँ" />}
          />
        )}
        {rawUsed ? (
          <>
            <StatCard label="Raw stock value" value={money(costing.summary.rawMaterialStockValue)} detail={`${costing.summary.unpricedStockMaterialCount} unpriced items`} />
            <StatCard label="Low stock need" value={money(costing.summary.lowStockMaterialValue)} detail="estimated reorder value" />
          </>
        ) : null}
        <StatCard
          label={<T en="Stock at cost" ne="स्टकको लागत" />}
          value={money(costing.summary.finishedStockValue)}
          tone={labourOnly.length > 0 ? "warn" : "default"}
          detail={
            labourOnly.length > 0 ? (
              <T
                en={`⚠ Labour only, no material: ${labourOnly.join(", ")}`}
                ne={`⚠ ज्याला मात्र, कच्चा पदार्थ छैन: ${labourOnly.join(", ")}`}
              />
            ) : (
              `${costing.summary.finishedStockMissingCostCount} cost gaps`
            )
          }
        />
        <StatCard
          label={<T en="Possible profit" ne="सम्भावित नाफा" />}
          value={money(costing.summary.finishedStockPotentialProfit)}
          tone={labourOnly.length > 0 ? "warn" : "default"}
          detail={
            labourOnly.length > 0 ? (
              <T en="⚠ Too high until material cost is entered" ne="⚠ कच्चा पदार्थको लागत नराखेसम्म बढी देखिन्छ" />
            ) : (
              `${costing.summary.finishedStockMissingPriceCount} price gaps`
            )
          }
        />
        {costing.summary.catalogStockMismatchCount > 0 ? (
          <StatCard label="Catalog mismatch" value={costing.summary.catalogStockMismatchCount} detail={`${costing.summary.catalogStockDeltaPairs} pair delta`} />
        ) : null}
        {ledgersUsed ? (
          <StatCard label="Receivable" value={money(snapshot.summary.receivable)} detail="customer ledger" />
        ) : null}
      </div>

      <div className={`mt-8 grid gap-6 ${batchPanelUsed && ledgersUsed ? "xl:grid-cols-3" : batchPanelUsed || ledgersUsed ? "xl:grid-cols-2" : ""}`}>
        {batchPanelUsed ? (
        <section className="rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
          <SectionTitle
            title="Production control"
            detail="Batch output, wastage, raw material link, and worker progress."
          />
          <div className="grid gap-3">
            {reports.productionInsights.slice(0, 4).map((batch) => (
              <div key={batch.id} className="border-b border-brand-green-line pb-3 last:border-b-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-brand-green-ink">{batch.design}</p>
                  <span className="rounded-full bg-brand-mist px-3 py-1 text-sm font-bold text-brand-green">
                    {batch.status}
                  </span>
                </div>
                <p className="mt-2 text-base text-brand-muted">
                  Production {batch.productionCompletionRate}% | Worker {batch.workerProgressRate}% | Reject {batch.rejectRate}%
                </p>
                <p className="mt-1 text-sm font-semibold text-brand-muted">
                  {batch.linkedTaskCount} tasks, {batch.materialCount} materials, {batch.consumptionCount} usage records, wastage {batch.materialWastageRate}%
                  {batch.missingRawMaterials.length > 0
                    ? `, missing: ${batch.missingRawMaterials.join(", ")}`
                    : ""}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-brand-green-line pt-3">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-brand-green">
              Station progress
            </p>
            {reports.workerProgressByStation.slice(0, 3).map((station) => (
              <p key={station.station} className="mt-2 text-sm font-semibold text-brand-muted">
                {station.station}: {station.completedPairs}/{station.targetPairs} pairs ({station.progressRate}%)
              </p>
            ))}
            {reports.unlinkedWorkerTasks.length > 0 ? (
              <p className="mt-2 text-sm font-bold text-brand-clay">
                {reports.unlinkedWorkerTasks.length} worker tasks need batch link.
              </p>
            ) : null}
          </div>
        </section>
        ) : null}

        <section className="rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
          <SectionTitle title="Stock flow" detail="Movement totals and channel stock signal." />
          <dl>
            <ReportLine label="Production in" value={reports.stockMovementTotals["Production In"]} tone="good" />
            <ReportLine label="Purchase in" value={reports.stockMovementTotals["Purchase In"]} tone="good" />
            <ReportLine label="Dispatch out" value={reports.stockMovementTotals["Dispatch Out"]} />
            <ReportLine label="Sale out" value={reports.stockMovementTotals["Sale Out"]} />
            <ReportLine label="Market sale" value={reports.stockMovementTotals["Market Sale"]} />
            <ReportLine label="Return in" value={reports.stockMovementTotals["Return In"]} tone="warn" />
            <ReportLine label="Adjustment" value={reports.stockMovementTotals.Adjustment} />
          </dl>
          <div className="mt-4 grid gap-2 text-sm font-semibold text-brand-muted">
            {(["Factory", "Wholesale", "Retail", "Online"] as const).map((channel) => (
              <div key={channel} className="grid grid-cols-[5.5rem_1fr] gap-2 border-b border-brand-green-line py-1 last:border-b-0">
                <p className="font-black text-brand-green-ink">{channel}</p>
                <p>
                  Stock {reports.stockByChannel[channel].stockPairs} | Sold{" "}
                  {reports.stockByChannel[channel].soldPairs} | Return{" "}
                  {reports.stockByChannel[channel].returnedPairs}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-brand-green-line pt-3">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-brand-green-ink">
              Active stock flow
            </p>
            {topStockFlows.length > 0 ? (
              topStockFlows.map((flow) => (
                <div key={flow.key} className="mt-2 text-sm font-semibold text-brand-muted">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold text-brand-green-ink">{flow.design}</p>
                    <p>{flow.channel}</p>
                  </div>
                  <p>
                    Net {flow.netStockFlow}, sold {flow.soldPairs}, return {flow.returnedPairs}
                  </p>
                </div>
              ))
            ) : (
              <p className="mt-2 text-sm font-semibold text-brand-muted">No movement summary yet.</p>
            )}
          </div>
          <div className="mt-4 border-t border-brand-green-line pt-3">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-brand-clay">
              Stock ledger accuracy
            </p>
            {stockLedgerWatchRows.length > 0 ? (
              stockLedgerWatchRows.map((stock) => (
                <div key={stock.id} className="mt-2 flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-bold text-brand-green-ink">{stock.design}</p>
                    <p className="font-semibold text-brand-muted">
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
              <p className="mt-2 text-sm font-semibold text-brand-muted">Stock ledger rows are balanced.</p>
            )}
          </div>
          <div className="mt-4 border-t border-brand-green-line pt-3">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-brand-clay">
              Stock watch
            </p>
            {stockWatchRows.length > 0 ? (
              stockWatchRows.map((stock) => (
                <div key={stock.id} className="mt-2 flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-bold text-brand-green-ink">{stock.design}</p>
                    <p className="font-semibold text-brand-muted">
                      {stock.channel} | {stock.stockPairs} pairs | return {stock.returnRate}%
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 font-bold ${stockSignalClass(stock.signal)}`}>
                    {stock.signal}
                  </span>
                </div>
              ))
            ) : (
              <p className="mt-2 text-sm font-semibold text-brand-muted">No stock alerts.</p>
            )}
          </div>
          <div className="mt-4 border-t border-brand-green-line pt-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-brand-green-ink">
                Finished value
              </p>
              <Link href="/admin/costing" className="text-sm font-black text-brand-green underline underline-offset-4">
                Costing
              </Link>
            </div>
            <p className="mt-2 text-sm font-semibold text-brand-muted">
              Value {money(costing.summary.finishedStockValue)} | profit potential{" "}
              {money(costing.summary.finishedStockPotentialProfit)}
            </p>
            {finishedStockWatchRows.length > 0 ? (
              finishedStockWatchRows.map((stock) => (
                <div key={stock.stockId} className="mt-2 flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-bold text-brand-green-ink">{stock.design}</p>
                    <p className="font-semibold text-brand-muted">
                      {stock.channel} | {stock.stockPairs} pairs | value {money(stock.stockValue)}
                    </p>
                  </div>
                  <span className="rounded-full bg-brand-cream-soft px-3 py-1 font-bold text-brand-gold-ink">
                    {stock.signal}
                  </span>
                </div>
              ))
            ) : (
              <p className="mt-2 text-sm font-semibold text-brand-muted">Finished stock is profit ready.</p>
            )}
          </div>
          <div className="mt-4 border-t border-brand-green-line pt-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-brand-clay">
                Catalog sync
              </p>
              <Link href="/admin/costing" className="text-sm font-black text-brand-green underline underline-offset-4">
                Review
              </Link>
            </div>
            <p className="mt-2 text-sm font-semibold text-brand-muted">
              {costing.summary.catalogStockMismatchCount} mismatch rows,{" "}
              {costing.summary.catalogStockDeltaPairs} pair delta
            </p>
            {catalogMismatchRows.length > 0 ? (
              catalogMismatchRows.map((stock) => (
                <div key={stock.key} className="mt-2 flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-bold text-brand-green-ink">
                      {stock.productName || stock.operationsDesign || "Unmatched stock"}
                    </p>
                    <p className="font-semibold text-brand-muted">
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
              <p className="mt-2 text-sm font-semibold text-brand-muted">Catalog and operations stock match.</p>
            )}
          </div>
          <div className="mt-4 border-t border-brand-green-line pt-3">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-brand-green">
              Raw material usage
            </p>
            {reports.materialUsage.slice(0, 3).map((material) => (
              <p key={material.id} className="mt-2 text-sm font-semibold text-brand-muted">
                {material.name}: {material.recordedTotal} {material.unit}, wastage {material.wastageRate}%
              </p>
            ))}
          </div>
          <div className="mt-4 border-t border-brand-green-line pt-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-brand-green-ink">
                Raw stock value
              </p>
              <Link href="/admin/costing" className="text-sm font-black text-brand-green underline underline-offset-4">
                Costing
              </Link>
            </div>
            <p className="mt-2 text-sm font-semibold text-brand-muted">
              Value {money(costing.summary.rawMaterialStockValue)} | Reorder need{" "}
              {money(costing.summary.lowStockMaterialValue)}
            </p>
            {rawStockWatchRows.length > 0 ? (
              rawStockWatchRows.map((material) => (
                <div key={material.materialId} className="mt-2 flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-bold text-brand-green-ink">{material.materialName}</p>
                    <p className="font-semibold text-brand-muted">
                      Balance {material.balance} {material.unit} | value {money(material.stockValue)}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 font-bold ${
                    material.hasPurchaseRate ? "bg-brand-cream-soft text-brand-gold-ink" : "bg-brand-clay-tint text-brand-clay"
                  }`}>
                    {material.hasPurchaseRate ? "Reorder" : "Rate missing"}
                  </span>
                </div>
              ))
            ) : (
              <p className="mt-2 text-sm font-semibold text-brand-muted">Raw stock value is covered.</p>
            )}
          </div>
          <div className="mt-4 border-t border-brand-green-line pt-3">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-brand-clay">
              Vehicle item totals
            </p>
            <p className="mt-2 text-sm font-semibold text-brand-muted">
              Loaded {reports.dispatchItemTotals.loadedPairs}, sold {reports.dispatchItemTotals.soldPairs}, return {reports.dispatchItemTotals.returnedPairs}
            </p>
          </div>
        </section>

        {ledgersUsed ? (
        <section className="rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
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
          <div className="mt-4 grid gap-2 border-t border-brand-green-line pt-3">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-brand-clay">
              Collection priority
            </p>
            {riskyLedgerRows.map((ledger) => (
              <Link
                key={ledger.id}
                href={`/admin/operations/ledger/${ledger.id}`}
                className="grid gap-2 rounded-md border border-brand-green-line p-3 text-sm transition hover:border-brand-green"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-brand-green-ink">{ledger.customerName}</span>
                  <span className={`rounded-full px-3 py-1 font-bold ${collectionPriorityClass(ledger.priority)}`}>
                    {ledger.priority}
                  </span>
                </div>
                <p className="font-semibold text-brand-muted">
                  {money(ledger.balanceDue)} | {ledger.daysOutstanding} days | due {ledger.followUpDueDate || "-"}
                </p>
              </Link>
            ))}
            {riskyLedgerRows.length === 0 ? (
              <p className="text-sm font-semibold text-brand-muted">No collection follow-up is due.</p>
            ) : null}
          </div>
          <div className="mt-4 border-t border-brand-green-line pt-3">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-brand-green-ink">
              Ledger transaction mix
            </p>
            <p className="mt-2 text-sm font-semibold text-brand-muted">
              Cash {money(reports.ledgerTransactionTotals["Cash Payment"])}, cheque{" "}
              {money(reports.ledgerTransactionTotals["Cheque Payment"])}
            </p>
            <p className="mt-1 text-sm font-semibold text-brand-muted">
              Credit {money(reports.ledgerTransactionTotals["Credit Sale"])}, return adj{" "}
              {money(reports.ledgerTransactionTotals["Return Adjustment"])}
            </p>
          </div>
          <div className="mt-4 border-t border-brand-green-line pt-3">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-brand-green">
              Top vehicle collection
            </p>
            {reports.dispatchPerformance.slice(0, 2).map((dispatch) => (
              <p key={dispatch.id} className="mt-2 text-sm font-semibold text-brand-muted">
                {dispatch.vehicleNumber}: {money(dispatch.totalCollection)} collection, return {dispatch.returnRate}%
              </p>
            ))}
          </div>
        </section>
        ) : null}
      </div>

      {/* Fifteen download buttons were a whole section of the page; they are
          one fold now, opened when a file is wanted. */}
      <details className="mt-6 rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
        <summary className="cursor-pointer text-lg font-black text-brand-green-ink">
          <T en={`Download CSV reports (${reportExports.length})`} ne={`CSV रिपोर्ट डाउनलोड (${reportExports.length})`} />
        </summary>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {reportExports.map((report) => (
              <a
                key={report.href}
                href={report.href}
                className="inline-flex h-9 items-center rounded-full border border-brand-green-line px-3 text-sm font-bold text-brand-green-ink transition hover:border-brand-green hover:text-brand-green"
              >
                {report.label}
              </a>
            ))}
          </div>
        </div>
      </details>
    </>
  );
}
