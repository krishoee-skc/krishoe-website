import Link from "next/link";
import {
  updateCustomerLedgerAction,
  updateFinishedStockAction,
  updateProductionBatchAction,
  updateRawMaterialAction,
  updateVehicleDispatchAction,
  updateWorkerTaskAction,
} from "@/app/admin/operations/actions";
import type {
  OperationsCostingSnapshot,
  OperationsSnapshot,
} from "@/app/admin/operations/_components/types";
import {
  compactInputClass,
  DeleteRecordForm,
  money,
  SaveButton,
  SectionTitle,
  workerStationOptions,
  workerStatusOptions,
} from "@/app/admin/operations/_components/operations-ui";
import type { LedgerTransactionType, StockMovement, StockMovementType } from "@/lib/operations";

function stockMovementTypeClass(type: StockMovementType) {
  if (type === "Production In" || type === "Purchase In" || type === "Return In") {
    return "bg-brand-green-tint text-brand-green";
  }

  if (type === "Dispatch Out" || type === "Sale Out" || type === "Market Sale") {
    return "bg-brand-cream-soft text-brand-gold-ink";
  }

  return "bg-gray-100 text-gray-700";
}

function stockSignalClass(signal: string) {
  if (signal === "Healthy") return "bg-brand-green-tint text-brand-green";
  if (signal === "Return watch") return "bg-brand-cream-soft text-brand-gold-ink";
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

function ledgerTransactionTypeClass(type: LedgerTransactionType) {
  if (type === "Cash Payment" || type === "Cheque Payment") {
    return "bg-brand-green-tint text-brand-green";
  }

  if (type === "Credit Sale") {
    return "bg-brand-cream-soft text-brand-gold-ink";
  }

  return "bg-gray-100 text-gray-700";
}

function agingClass(bucket: string) {
  if (bucket === "60+ days") {
    return "text-brand-clay";
  }

  if (bucket === "31-60 days") {
    return "text-brand-gold-ink";
  }

  return "text-brand-green";
}

function formatOptionalDate(value: string) {
  return value ? new Date(value).toLocaleString("en-IN") : "No movement";
}

function stockMovementSource(
  movement: StockMovement,
  linkedItem?: OperationsSnapshot["vehicleDispatchItems"][number],
) {
  if (linkedItem) {
    return {
      label: linkedItem.vehicleNumber,
      detail: linkedItem.marketRoute || "Dispatch item",
    };
  }

  const note = movement.note.toLowerCase();

  if (note.includes("kr-bill") || note.includes("kr-rt")) {
    return {
      label: "POS billing",
      detail: "Invoice posting",
    };
  }

  if (movement.type === "Production In") {
    return {
      label: "Production",
      detail: "Factory output",
    };
  }

  if (movement.type === "Purchase In") {
    return {
      label: "Purchase",
      detail: "Trading goods received",
    };
  }

  if (movement.type === "Adjustment") {
    return {
      label: "Adjustment",
      detail: "Manual correction",
    };
  }

  return {
    label: "Manual",
    detail: "Direct entry",
  };
}

function ProductionBatchesTable({ snapshot }: { snapshot: OperationsSnapshot }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <SectionTitle
        title="Production batches"
        detail="Kati mal banyo, kati bandai cha, kati reject bhayo."
      />
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b text-left text-gray-500">
            <tr>
              <th className="py-2 pr-3">Design</th>
              <th className="py-2 pr-3">Planned</th>
              <th className="py-2 pr-3">Finished</th>
              <th className="py-2 pr-3">WIP</th>
              <th className="py-2 pr-3">Reject</th>
              <th className="py-2 pr-3">Stage</th>
              <th className="py-2 pr-3">Manage</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {snapshot.productionBatches.map((batch) => (
              <tr key={batch.id}>
                <td className="py-3 pr-3 font-semibold text-brand-green-ink">{batch.design}</td>
                <td className="py-3 pr-3">{batch.plannedPairs}</td>
                <td className="py-3 pr-3">{batch.finishedPairs}</td>
                <td className="py-3 pr-3">{batch.inProgressPairs}</td>
                <td className="py-3 pr-3">{batch.rejectedPairs}</td>
                <td className="py-3 pr-3">{batch.status}</td>
                <td className="min-w-80 py-3 pr-3">
                  <form action={updateProductionBatchAction} className="grid gap-2">
                    <input type="hidden" name="id" value={batch.id} />
                    <input name="design" required className={compactInputClass} defaultValue={batch.design} />
                    <div className="grid grid-cols-4 gap-2">
                      <input name="plannedPairs" type="number" min="0" className={compactInputClass} defaultValue={batch.plannedPairs} aria-label="Planned pairs" />
                      <input name="finishedPairs" type="number" min="0" className={compactInputClass} defaultValue={batch.finishedPairs} aria-label="Finished pairs" />
                      <input name="inProgressPairs" type="number" min="0" className={compactInputClass} defaultValue={batch.inProgressPairs} aria-label="Work in progress pairs" />
                      <input name="rejectedPairs" type="number" min="0" className={compactInputClass} defaultValue={batch.rejectedPairs} aria-label="Rejected pairs" />
                    </div>
                    <textarea
                      name="rawMaterialUsed"
                      className="min-h-16 rounded-md border border-gray-200 px-2 py-2 text-xs outline-none focus:border-brand-green"
                      defaultValue={batch.rawMaterialUsed.join(", ")}
                      aria-label="Raw materials used"
                    />
                    <div className="flex flex-wrap gap-2">
                      <select name="status" className={compactInputClass} defaultValue={batch.status}>
                        <option>Planning</option>
                        <option>Cutting</option>
                        <option>Making</option>
                        <option>QC</option>
                        <option>Packed</option>
                      </select>
                      <SaveButton />
                    </div>
                  </form>
                  <div className="mt-2">
                    <DeleteRecordForm kind="productionBatch" id={batch.id} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function WorkerProgressCards({ snapshot }: { snapshot: OperationsSnapshot }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <SectionTitle
        title="Worker progress and camera zones"
        detail="Kun worker le kun station ma kati progress garyo."
      />
      <div className="grid gap-3">
        {snapshot.workerTasks.map((task) => {
          const linkedBatch = snapshot.productionBatches.find((batch) => batch.id === task.batchId);

          return (
            <div key={task.id} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-brand-green-ink">{task.workerName}</p>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-brand-green">
                  {task.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                {task.station} - {task.design}
              </p>
              <p className="mt-1 text-xs font-bold text-brand-muted-soft">
                Batch: {linkedBatch ? `${linkedBatch.design} (${linkedBatch.status})` : "Manual / unlinked"}
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-700">
                {task.completedPairs}/{task.targetPairs} pairs - {task.cameraZone}
              </p>
              <form action={updateWorkerTaskAction} className="mt-3 grid gap-2">
                <input type="hidden" name="id" value={task.id} />
                <div className="grid grid-cols-2 gap-2">
                  <input name="workerName" required className={compactInputClass} defaultValue={task.workerName} aria-label="Worker name" />
                  <select name="batchId" className={compactInputClass} defaultValue={task.batchId} aria-label="Production batch">
                    <option value="">Manual / no batch</option>
                    {snapshot.productionBatches.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.design}
                      </option>
                    ))}
                  </select>
                </div>
                <input name="design" className={compactInputClass} defaultValue={task.design} aria-label="Design" />
                <div className="grid grid-cols-2 gap-2">
                  <select name="station" className={compactInputClass} defaultValue={task.station} aria-label="Station">
                    {workerStationOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                  <select name="status" className={compactInputClass} defaultValue={task.status} aria-label="Worker status">
                    {workerStatusOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                  <input name="targetPairs" type="number" min="0" className={compactInputClass} defaultValue={task.targetPairs} aria-label="Target pairs" />
                  <input name="completedPairs" type="number" min="0" className={compactInputClass} defaultValue={task.completedPairs} aria-label="Completed pairs" />
                </div>
                <input name="cameraZone" className={compactInputClass} defaultValue={task.cameraZone} aria-label="Camera zone" />
                <SaveButton />
              </form>
              <div className="mt-2">
                <DeleteRecordForm kind="workerTask" id={task.id} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RawMaterialsPanel({
  snapshot,
  costing,
}: {
  snapshot: OperationsSnapshot;
  costing: OperationsCostingSnapshot;
}) {
  const valuationByMaterialId = new Map(
    costing.rawMaterialStockValuation.map((material) => [material.materialId, material]),
  );

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <SectionTitle title="Raw material" detail="Used, received, balance, reorder alert." />
      <div className="grid gap-3">
        {snapshot.rawMaterials.map((material) => {
          const valuation = valuationByMaterialId.get(material.id);

          return (
            <div key={material.id} className="rounded-lg border border-gray-100 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-bold text-brand-green-ink">{material.name}</p>
                <span className={material.lowStock ? "text-sm font-bold text-red-700" : "text-sm font-bold text-brand-green"}>
                  {material.balance} {material.unit}
                </span>
              </div>
              <div className="mb-3 rounded-md bg-gray-50 p-3 text-xs font-semibold text-gray-600">
                <p>
                  Avg cost {money(valuation?.averageUnitCost ?? 0)} | stock value{" "}
                  {money(valuation?.stockValue ?? 0)}
                </p>
                <p className="mt-1">
                  Reorder need {valuation?.reorderShortage ?? 0} {material.unit} /{" "}
                  {money(valuation?.reorderValue ?? 0)}
                  {valuation && !valuation.hasPurchaseRate ? " | purchase rate missing" : ""}
                </p>
              </div>
              <form action={updateRawMaterialAction} className="grid gap-2">
                <input type="hidden" name="id" value={material.id} />
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input name="name" required className={compactInputClass} defaultValue={material.name} aria-label="Material name" />
                  <select name="unit" className={compactInputClass} defaultValue={material.unit} aria-label="Unit">
                    <option value="kg">kg</option>
                    <option value="meter">meter</option>
                    <option value="pair">pair</option>
                    <option value="piece">piece</option>
                    <option value="liter">liter</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input name="openingStock" type="number" min="0" className={compactInputClass} defaultValue={material.openingStock} aria-label="Opening stock" />
                  <input name="used" type="number" min="0" className={compactInputClass} defaultValue={material.used} aria-label="Used" />
                  <input name="received" type="number" min="0" className={compactInputClass} defaultValue={material.received} aria-label="Received" />
                  <input name="reorderLevel" type="number" min="0" className={compactInputClass} defaultValue={material.reorderLevel} aria-label="Reorder level" />
                </div>
                <SaveButton />
              </form>
              <div className="mt-2">
                <DeleteRecordForm kind="rawMaterial" id={material.id} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MaterialConsumptionHistory({ snapshot }: { snapshot: OperationsSnapshot }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <SectionTitle
        title="Material consumption"
        detail="Batch-wise raw material used, wastage, and production notes."
      />
      {snapshot.materialConsumptions.length === 0 ? (
        <p className="text-sm text-gray-500">No material consumption has been recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b text-left text-gray-500">
              <tr>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Batch</th>
                <th className="py-2 pr-3">Material</th>
                <th className="py-2 pr-3">Used</th>
                <th className="py-2 pr-3">Wastage</th>
                <th className="py-2 pr-3">Note</th>
                <th className="py-2 pr-3">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {snapshot.materialConsumptions.map((consumption) => (
                <tr key={consumption.id}>
                  <td className="py-3 pr-3 text-xs text-gray-500">
                    {new Date(consumption.createdAt).toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 pr-3 font-semibold text-brand-green-ink">{consumption.batchDesign}</td>
                  <td className="py-3 pr-3">{consumption.materialName}</td>
                  <td className="py-3 pr-3 font-bold text-brand-green">
                    {consumption.quantity} {consumption.unit}
                  </td>
                  <td className="py-3 pr-3 font-bold text-brand-clay">
                    {consumption.wastage} {consumption.unit}
                  </td>
                  <td className="max-w-48 py-3 pr-3 text-gray-600">{consumption.note || "-"}</td>
                  <td className="py-3 pr-3">
                    <DeleteRecordForm kind="materialConsumption" id={consumption.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DemandPanel({ snapshot }: { snapshot: OperationsSnapshot }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <SectionTitle title="Fast and slow designs" detail="Market demand signal by sold pairs." />
      <div className="grid gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-green">Fast moving</p>
          {snapshot.fastMovingStock.slice(0, 3).map((stock) => (
            <p key={stock.id} className="mt-2 text-sm text-gray-700">
              {stock.design}: <span className="font-bold">{stock.soldPairs}</span> sold
            </p>
          ))}
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-clay">Slow moving</p>
          {snapshot.slowMovingStock.slice(0, 3).map((stock) => (
            <p key={stock.id} className="mt-2 text-sm text-gray-700">
              {stock.design}: <span className="font-bold">{stock.soldPairs}</span> sold
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

function CollectionPanel({ snapshot }: { snapshot: OperationsSnapshot }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <SectionTitle title="Collection summary" detail="Cash, cheque, credit from market vehicles." />
      <dl className="grid gap-3 text-sm">
        <div className="flex justify-between">
          <dt className="font-semibold text-gray-500">Cash</dt>
          <dd className="font-black text-brand-green-ink">{money(snapshot.summary.cash)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-semibold text-gray-500">Cheque</dt>
          <dd className="font-black text-brand-green-ink">{money(snapshot.summary.cheque)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-semibold text-gray-500">Credit</dt>
          <dd className="font-black text-brand-green-ink">{money(snapshot.summary.credit)}</dd>
        </div>
      </dl>
    </section>
  );
}

function FinishedStockTable({
  snapshot,
  costing,
}: {
  snapshot: OperationsSnapshot;
  costing: OperationsCostingSnapshot;
}) {
  const valuationByStockId = new Map(
    costing.finishedStockValuation.map((stock) => [stock.stockId, stock]),
  );

  return (
    <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <SectionTitle title="Finished stock" detail="Design, channel, stock, COGS value, profit potential, and returns." />
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b text-left text-gray-500">
            <tr>
              <th className="py-2 pr-3">Design</th>
              <th className="py-2 pr-3">Channel</th>
              <th className="py-2 pr-3">Size</th>
              <th className="py-2 pr-3">Stock</th>
              <th className="py-2 pr-3">Value</th>
              <th className="py-2 pr-3">Sold</th>
              <th className="py-2 pr-3">Return</th>
              <th className="py-2 pr-3">Health</th>
              <th className="py-2 pr-3">Manage</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {snapshot.finishedStock.map((stock) => {
              const health = snapshot.reports.stockHealthRows.find((row) => row.id === stock.id);
              const valuation = valuationByStockId.get(stock.id);

              return (
                <tr key={stock.id}>
                  <td className="py-3 pr-3 font-semibold text-brand-green-ink">{stock.design}</td>
                  <td className="py-3 pr-3">{stock.channel}</td>
                  <td className="py-3 pr-3">{stock.sizeRun}</td>
                  <td className="py-3 pr-3 font-bold text-brand-green">{stock.stockPairs}</td>
                  <td className="py-3 pr-3">
                    <p className="font-bold text-brand-green-ink">{money(valuation?.stockValue ?? 0)}</p>
                    <p className="text-xs text-gray-500">
                      COGS {money(valuation?.unitCostPerPair ?? 0)} / profit{" "}
                      {money(valuation?.potentialGrossProfit ?? 0)}
                    </p>
                    <p className="mt-1 text-xs font-bold text-brand-gold-ink">
                      {valuation?.signal ?? "Needs cost"} / {valuation?.priceSource ?? "Missing"}
                    </p>
                  </td>
                  <td className="py-3 pr-3">{stock.soldPairs}</td>
                  <td className="py-3 pr-3">{stock.returnedPairs}</td>
                  <td className="py-3 pr-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${stockSignalClass(health?.signal ?? "Healthy")}`}>
                      {health?.signal ?? "Healthy"}
                    </span>
                    <p className="mt-1 text-xs text-gray-500">
                      Sell {health?.sellThroughRate ?? 0}% | return {health?.returnRate ?? 0}%
                    </p>
                  </td>
                  <td className="min-w-96 py-3 pr-3">
                    <form action={updateFinishedStockAction} className="grid gap-2">
                      <input type="hidden" name="id" value={stock.id} />
                      <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                        <input name="design" required className={compactInputClass} defaultValue={stock.design} aria-label="Stock design" />
                        <select name="channel" className={compactInputClass} defaultValue={stock.channel} aria-label="Stock channel">
                          <option>Factory</option>
                          <option>Wholesale</option>
                          <option>Retail</option>
                          <option>Online</option>
                        </select>
                        <input name="sizeRun" className={compactInputClass} defaultValue={stock.sizeRun} aria-label="Size run" />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input name="stockPairs" type="number" min="0" className={compactInputClass} defaultValue={stock.stockPairs} aria-label="Stock pairs" />
                        <input name="soldPairs" type="number" min="0" className={compactInputClass} defaultValue={stock.soldPairs} aria-label="Sold pairs" />
                        <input name="returnedPairs" type="number" min="0" className={compactInputClass} defaultValue={stock.returnedPairs} aria-label="Returned pairs" />
                      </div>
                      <SaveButton />
                    </form>
                    <div className="mt-2">
                      <DeleteRecordForm kind="finishedStock" id={stock.id} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StockLedgerSummary({ snapshot }: { snapshot: OperationsSnapshot }) {
  return (
    <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-brand-green-ink">Stock ledger summary</h2>
          <p className="mt-1 text-sm text-gray-500">
            Book stock compared with stock movement trail for closing, audit, and correction.
          </p>
        </div>
        <Link
          href="/api/admin/operations/export?type=stock-ledger-summary"
          className="inline-flex h-9 items-center rounded-full border border-gray-200 px-3 text-xs font-bold text-brand-green-ink transition hover:border-brand-green hover:text-brand-green"
        >
          Export ledger CSV
        </Link>
      </div>

      {snapshot.reports.stockLedgerRows.length === 0 ? (
        <p className="text-sm text-gray-500">No stock ledger rows are available yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b text-left text-gray-500">
              <tr>
                <th className="py-2 pr-3">Design</th>
                <th className="py-2 pr-3">Book stock</th>
                <th className="py-2 pr-3">Movement stock</th>
                <th className="py-2 pr-3">Variance</th>
                <th className="py-2 pr-3">Flow</th>
                <th className="py-2 pr-3">Last movement</th>
                <th className="py-2 pr-3">Signal</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {snapshot.reports.stockLedgerRows.map((row) => (
                <tr key={row.id}>
                  <td className="py-3 pr-3">
                    <p className="font-semibold text-brand-green-ink">{row.design}</p>
                    <p className="text-xs text-gray-500">
                      {row.channel} | {row.sizeRun}
                    </p>
                  </td>
                  <td className="py-3 pr-3 font-bold text-brand-green">{row.stockPairs}</td>
                  <td className="py-3 pr-3">
                    <p className="font-bold text-brand-green-ink">{row.movementStockPairs}</p>
                    <p className="text-xs text-gray-500">{row.movementCount} movements</p>
                  </td>
                  <td className={`py-3 pr-3 font-black ${row.variancePairs === 0 ? "text-brand-green" : "text-brand-clay"}`}>
                    {row.variancePairs}
                  </td>
                  <td className="py-3 pr-3 text-xs font-semibold text-gray-600">
                    <p>In {row.productionIn + row.returnIn + row.adjustment}</p>
                    <p>Out {row.dispatchOut + row.saleOut}</p>
                    <p>Market {row.marketSale}</p>
                  </td>
                  <td className="py-3 pr-3 text-xs text-gray-500">{formatOptionalDate(row.lastMovementAt)}</td>
                  <td className="py-3 pr-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${stockLedgerSignalClass(row.signal)}`}>
                      {row.signal}
                    </span>
                    <p className="mt-2 max-w-60 text-xs font-semibold text-gray-600">{row.nextAction}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function VehicleDispatchCards({ snapshot }: { snapshot: OperationsSnapshot }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <SectionTitle title="Vehicle dispatch" detail="Gadi, driver, route, loaded, return, collection." />
      <div className="grid gap-3">
        {snapshot.vehicleDispatches.map((dispatch) => (
          <div key={dispatch.id} className="rounded-lg border border-gray-100 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold text-brand-green-ink">{dispatch.vehicleNumber}</p>
              <span className="rounded-full bg-brand-mist px-3 py-1 text-xs font-bold text-brand-green">
                {dispatch.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              {dispatch.driverName} - {dispatch.marketRoute}
            </p>
            <p className="mt-1 text-sm text-gray-700">
              Loaded {dispatch.loadedPairs}, returned {dispatch.returnedPairs}, credit {money(dispatch.creditAmount)}
            </p>
            <form action={updateVehicleDispatchAction} className="mt-3 grid gap-2">
              <input type="hidden" name="id" value={dispatch.id} />
              <div className="grid grid-cols-2 gap-2">
                <input name="vehicleNumber" required className={compactInputClass} defaultValue={dispatch.vehicleNumber} aria-label="Vehicle number" />
                <input name="driverName" required className={compactInputClass} defaultValue={dispatch.driverName} aria-label="Driver name" />
              </div>
              <input name="marketRoute" className={compactInputClass} defaultValue={dispatch.marketRoute} aria-label="Market route" />
              <div className="grid grid-cols-3 gap-2">
                <input name="loadedPairs" type="number" min="0" className={compactInputClass} defaultValue={dispatch.loadedPairs} aria-label="Loaded pairs" />
                <input name="returnedPairs" type="number" min="0" className={compactInputClass} defaultValue={dispatch.returnedPairs} aria-label="Returned pairs" />
                <input name="cashCollected" type="number" min="0" className={compactInputClass} defaultValue={dispatch.cashCollected} aria-label="Cash collected" />
                <input name="chequeCollected" type="number" min="0" className={compactInputClass} defaultValue={dispatch.chequeCollected} aria-label="Cheque collected" />
                <input name="creditAmount" type="number" min="0" className={compactInputClass} defaultValue={dispatch.creditAmount} aria-label="Credit amount" />
                <select name="status" className={compactInputClass} defaultValue={dispatch.status} aria-label="Dispatch status">
                  <option>Loading</option>
                  <option>In Market</option>
                  <option>Returned</option>
                  <option>Closed</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <SaveButton />
              </div>
            </form>
            <div className="mt-2">
              <DeleteRecordForm kind="vehicleDispatch" id={dispatch.id} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function LedgerFollowupQueue({ snapshot }: { snapshot: OperationsSnapshot }) {
  const rows = snapshot.reports.ledgerCollectionFollowups.filter((ledger) => ledger.priority !== "Clear");

  return (
    <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-brand-green-ink">Collection follow-up queue</h2>
          <p className="mt-1 text-sm text-gray-500">
            Customer-wise priority, payment due date, and next collection action.
          </p>
        </div>
        <Link
          href="/api/admin/operations/export?type=ledger-followups"
          className="inline-flex h-9 items-center rounded-full border border-gray-200 px-3 text-xs font-bold text-brand-green-ink transition hover:border-brand-green hover:text-brand-green"
        >
          Export follow-ups
        </Link>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <p className="text-xs font-semibold text-gray-500">Urgent</p>
          <p className="mt-1 text-xl font-black text-brand-clay">
            {snapshot.reports.ledgerCollectionSummary.urgentCount}
          </p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <p className="text-xs font-semibold text-gray-500">High</p>
          <p className="mt-1 text-xl font-black text-brand-gold-ink">
            {snapshot.reports.ledgerCollectionSummary.highCount}
          </p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <p className="text-xs font-semibold text-gray-500">This week due</p>
          <p className="mt-1 text-xl font-black text-brand-green-ink">
            {money(snapshot.reports.ledgerCollectionSummary.dueThisWeek)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <p className="text-xs font-semibold text-gray-500">Total due</p>
          <p className="mt-1 text-xl font-black text-brand-green-ink">
            {money(snapshot.reports.ledgerCollectionSummary.totalDue)}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">No customer collection follow-up is due.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b text-left text-gray-500">
              <tr>
                <th className="py-2 pr-3">Customer</th>
                <th className="py-2 pr-3">Priority</th>
                <th className="py-2 pr-3">Due</th>
                <th className="py-2 pr-3">Aging</th>
                <th className="py-2 pr-3">Coverage</th>
                <th className="py-2 pr-3">Follow-up</th>
                <th className="py-2 pr-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((ledger) => (
                <tr key={ledger.id}>
                  <td className="py-3 pr-3">
                    <Link
                      href={`/admin/operations/ledger/${ledger.id}`}
                      className="font-semibold text-brand-green-ink underline decoration-brand-gold-bright underline-offset-4 transition hover:text-brand-green"
                    >
                      {ledger.customerName}
                    </Link>
                    <p className="text-xs text-gray-500">
                      {ledger.channel} | {ledger.phone || "No phone"}
                    </p>
                  </td>
                  <td className="py-3 pr-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${collectionPriorityClass(ledger.priority)}`}>
                      {ledger.priority}
                    </span>
                  </td>
                  <td className="py-3 pr-3 font-bold text-brand-clay">{money(ledger.balanceDue)}</td>
                  <td className="py-3 pr-3">
                    <p className={`font-bold ${agingClass(ledger.agingBucket)}`}>{ledger.agingBucket}</p>
                    <p className="text-xs text-gray-500">{ledger.daysOutstanding} days</p>
                  </td>
                  <td className="py-3 pr-3">
                    <p className="font-semibold text-brand-green-ink">{ledger.collectionCoverageRate}%</p>
                    <p className="text-xs text-gray-500">{money(ledger.collectionTotal)} collected</p>
                  </td>
                  <td className="py-3 pr-3">{ledger.followUpDueDate || "-"}</td>
                  <td className="max-w-72 py-3 pr-3 text-xs font-semibold leading-5 text-gray-600">
                    {ledger.nextAction}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function VehicleDispatchItemHistory({ snapshot }: { snapshot: OperationsSnapshot }) {
  return (
    <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <SectionTitle
        title="Dispatch item history"
        detail="Vehicle-wise design, size, loaded, sold, return, and collection trail."
      />
      {snapshot.vehicleDispatchItems.length === 0 ? (
        <p className="text-sm text-gray-500">No dispatch item has been recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b text-left text-gray-500">
              <tr>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Vehicle</th>
                <th className="py-2 pr-3">Design</th>
                <th className="py-2 pr-3">Channel</th>
                <th className="py-2 pr-3">Loaded</th>
                <th className="py-2 pr-3">Sold</th>
                <th className="py-2 pr-3">Return</th>
                <th className="py-2 pr-3">Collection</th>
                <th className="py-2 pr-3">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {snapshot.vehicleDispatchItems.map((item) => (
                <tr key={item.id}>
                  <td className="py-3 pr-3 text-xs text-gray-500">
                    {new Date(item.createdAt).toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 pr-3">
                    <p className="font-semibold text-brand-green-ink">{item.vehicleNumber}</p>
                    <p className="text-xs text-gray-500">{item.marketRoute || "-"}</p>
                  </td>
                  <td className="py-3 pr-3">
                    <p className="font-semibold text-brand-green-ink">{item.design}</p>
                    <p className="text-xs text-gray-500">{item.sizeRun}</p>
                  </td>
                  <td className="py-3 pr-3">{item.channel}</td>
                  <td className="py-3 pr-3 font-bold">{item.loadedPairs}</td>
                  <td className="py-3 pr-3 text-brand-green">{item.soldPairs}</td>
                  <td className="py-3 pr-3 text-brand-clay">{item.returnedPairs}</td>
                  <td className="py-3 pr-3">
                    <p>{money(item.cashCollected)} cash</p>
                    <p className="text-xs text-gray-500">
                      {money(item.chequeCollected)} cheque, {money(item.creditAmount)} credit
                    </p>
                  </td>
                  <td className="py-3 pr-3">
                    <DeleteRecordForm kind="vehicleDispatchItem" id={item.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CustomerLedgerTable({ snapshot }: { snapshot: OperationsSnapshot }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <SectionTitle title="Customer ledger" detail="Customer details, cash, cheque, credit, balance due." />
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b text-left text-gray-500">
            <tr>
              <th className="py-2 pr-3">Customer</th>
              <th className="py-2 pr-3">Channel</th>
              <th className="py-2 pr-3">Cash</th>
              <th className="py-2 pr-3">Cheque</th>
              <th className="py-2 pr-3">Due</th>
              <th className="py-2 pr-3">Aging</th>
              <th className="py-2 pr-3">Manage</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {snapshot.customerLedgers.map((ledger) => {
              const aging = snapshot.reports.ledgerAgingRows.find((row) => row.id === ledger.id);

              return (
                <tr key={ledger.id}>
                  <td className="py-3 pr-3">
                    <Link
                      href={`/admin/operations/ledger/${ledger.id}`}
                      className="font-semibold text-brand-green-ink underline decoration-brand-gold-bright underline-offset-4 transition hover:text-brand-green"
                    >
                      {ledger.customerName}
                    </Link>
                    <p className="text-xs text-gray-500">{ledger.phone}</p>
                  </td>
                  <td className="py-3 pr-3">{ledger.channel}</td>
                  <td className="py-3 pr-3">{money(ledger.cashPaid)}</td>
                  <td className="py-3 pr-3">{money(ledger.chequePaid)}</td>
                  <td className="py-3 pr-3 font-bold text-brand-clay">{money(ledger.balanceDue)}</td>
                  <td className="py-3 pr-3">
                    <p className={`font-bold ${agingClass(aging?.agingBucket ?? "Paid")}`}>
                      {aging?.agingBucket ?? "Paid"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {aging?.daysOutstanding ?? 0} days | {aging?.collectionCoverageRate ?? 0}% cover
                    </p>
                  </td>
                  <td className="min-w-80 py-3 pr-3">
                    <form action={updateCustomerLedgerAction} className="grid gap-2">
                      <input type="hidden" name="id" value={ledger.id} />
                      <input name="customerName" required className={compactInputClass} defaultValue={ledger.customerName} aria-label="Customer name" />
                      <div className="grid grid-cols-2 gap-2">
                        <input name="phone" className={compactInputClass} defaultValue={ledger.phone} aria-label="Phone" />
                        <select name="channel" className={compactInputClass} defaultValue={ledger.channel} aria-label="Channel">
                          <option>Wholesale</option>
                          <option>Retail</option>
                          <option>Online</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <input name="cashPaid" type="number" min="0" className={compactInputClass} defaultValue={ledger.cashPaid} aria-label="Cash paid" />
                        <input name="chequePaid" type="number" min="0" className={compactInputClass} defaultValue={ledger.chequePaid} aria-label="Cheque paid" />
                        <input name="creditGiven" type="number" min="0" className={compactInputClass} defaultValue={ledger.creditGiven} aria-label="Credit given" />
                        <input name="balanceDue" type="number" min="0" className={compactInputClass} defaultValue={ledger.balanceDue} aria-label="Balance due" />
                        <input name="creditLimit" type="number" min="0" className={compactInputClass} defaultValue={ledger.creditLimit} aria-label="Credit limit (0 = no limit)" />
                      </div>
                      <SaveButton />
                    </form>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Link
                        href={`/admin/operations/ledger/${ledger.id}`}
                        className="inline-flex h-9 items-center rounded-full border border-gray-200 px-3 text-xs font-bold text-brand-green-ink transition hover:border-brand-green"
                      >
                        Open ledger
                      </Link>
                      <DeleteRecordForm kind="customerLedger" id={ledger.id} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StockMovementHistory({ snapshot }: { snapshot: OperationsSnapshot }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <SectionTitle title="Stock movement history" detail="Production, dispatch, sale, return, and adjustment trail." />
      {snapshot.stockMovements.length === 0 ? (
        <p className="text-sm text-gray-500">No stock movement has been recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b text-left text-gray-500">
              <tr>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Design</th>
                <th className="py-2 pr-3">Channel</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Pairs</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Note</th>
                <th className="py-2 pr-3">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {snapshot.stockMovements.map((movement) => {
                const linkedItem = snapshot.vehicleDispatchItems.find((item) =>
                  item.stockMovementIds.includes(movement.id),
                );
                const source = stockMovementSource(movement, linkedItem);

                return (
                  <tr key={movement.id}>
                    <td className="py-3 pr-3 text-xs text-gray-500">
                      {new Date(movement.createdAt).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 pr-3 font-semibold text-brand-green-ink">{movement.design}</td>
                    <td className="py-3 pr-3">{movement.channel}</td>
                    <td className="py-3 pr-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${stockMovementTypeClass(movement.type)}`}>
                        {movement.type}
                      </span>
                    </td>
                    <td className="py-3 pr-3 font-bold">{movement.pairs}</td>
                    <td className="py-3 pr-3">
                      <p className="font-semibold text-brand-green-ink">{source.label}</p>
                      <p className="text-xs text-gray-500">{source.detail}</p>
                    </td>
                    <td className="max-w-48 py-3 pr-3 text-gray-600">{movement.note || "-"}</td>
                    <td className="py-3 pr-3">
                      <DeleteRecordForm kind="stockMovement" id={movement.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function LedgerTransactionHistory({ snapshot }: { snapshot: OperationsSnapshot }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <SectionTitle title="Ledger transaction history" detail="Cash, cheque, credit sale, return adjustment, and balance adjustment trail." />
      {snapshot.ledgerTransactions.length === 0 ? (
        <p className="text-sm text-gray-500">No ledger transaction has been recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b text-left text-gray-500">
              <tr>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Customer</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Amount</th>
                <th className="py-2 pr-3">Note</th>
                <th className="py-2 pr-3">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {snapshot.ledgerTransactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td className="py-3 pr-3 text-xs text-gray-500">
                    {new Date(transaction.createdAt).toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 pr-3">
                    <Link
                      href={`/admin/operations/ledger/${transaction.ledgerId}`}
                      className="font-semibold text-brand-green-ink underline decoration-brand-gold-bright underline-offset-4 transition hover:text-brand-green"
                    >
                      {transaction.customerName}
                    </Link>
                  </td>
                  <td className="py-3 pr-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${ledgerTransactionTypeClass(transaction.type)}`}>
                      {transaction.type}
                    </span>
                  </td>
                  <td className="py-3 pr-3 font-bold">{money(transaction.amount)}</td>
                  <td className="max-w-56 py-3 pr-3 text-gray-600">{transaction.note || "-"}</td>
                  <td className="py-3 pr-3">
                    <DeleteRecordForm kind="ledgerTransaction" id={transaction.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function OperationsRecords({
  snapshot,
  costing,
}: {
  snapshot: OperationsSnapshot;
  costing: OperationsCostingSnapshot;
}) {
  return (
    <>
      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <ProductionBatchesTable snapshot={snapshot} />
        <WorkerProgressCards snapshot={snapshot} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <RawMaterialsPanel snapshot={snapshot} costing={costing} />
        <DemandPanel snapshot={snapshot} />
        <CollectionPanel snapshot={snapshot} />
      </div>

      <FinishedStockTable snapshot={snapshot} costing={costing} />
      <StockLedgerSummary snapshot={snapshot} />

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <VehicleDispatchCards snapshot={snapshot} />
        <CustomerLedgerTable snapshot={snapshot} />
      </div>

      <LedgerFollowupQueue snapshot={snapshot} />

      <VehicleDispatchItemHistory snapshot={snapshot} />

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <MaterialConsumptionHistory snapshot={snapshot} />
        <StockMovementHistory snapshot={snapshot} />
        <LedgerTransactionHistory snapshot={snapshot} />
      </div>
    </>
  );
}
