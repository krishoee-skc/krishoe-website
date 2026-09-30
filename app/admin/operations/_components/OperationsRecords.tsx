import EnterWalkForm from "@/components/admin/EnterWalkForm";
import Link from "next/link";
import T from "@/components/T";
import ExportButton from "@/components/admin/ExportButton";
import { DateDisplayAdmin } from "@/components/DateDisplay";
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

// What these records mean — the colour a status earns, and where a stock
// movement came from — beside this file, because they are rules rather than
// markup, and because a test can reach them there.
import {
  agingClass,
  collectionPriorityClass,
  ledgerTransactionTypeClass,
  stockLedgerSignalClass,
  stockMovementSource,
  stockMovementTypeClass,
  stockSignalClass,
} from "@/app/admin/operations/_components/operations-record-rules";

function OptionalDate({ value }: { value: string }) {
  return value ? <DateDisplayAdmin date={value} time /> : <>No movement</>;
}

function ProductionBatchesTable({ snapshot }: { snapshot: OperationsSnapshot }) {
  return (
    <section className="rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
      <SectionTitle
        title="Production batches"
        detail="Kati mal banyo, kati bandai cha, kati reject bhayo."
      />
      <div className="overflow-x-auto">
        <table className="reflow-table min-w-full text-base">
          <thead className="border-b text-left text-brand-muted">
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
                <td className="reflow-primary py-3 pr-3 font-semibold text-brand-green-ink">{batch.design}</td>
                <td data-label="Planned" className="py-3 pr-3">{batch.plannedPairs}</td>
                <td data-label="Finished" className="py-3 pr-3">{batch.finishedPairs}</td>
                <td data-label="WIP" className="py-3 pr-3">{batch.inProgressPairs}</td>
                <td data-label="Reject" className="py-3 pr-3">{batch.rejectedPairs}</td>
                <td data-label="Stage" className="py-3 pr-3">{batch.status}</td>
                <td data-label="Manage" className="min-w-80 py-3 pr-3">
                  <EnterWalkForm action={updateProductionBatchAction} className="grid gap-2">
                    <input type="hidden" name="id" value={batch.id} />
                    <input aria-label="Design name" name="design" required className={compactInputClass} defaultValue={batch.design} />
                    <div className="grid grid-cols-4 gap-2">
                      <input name="plannedPairs" type="number" min="0" className={compactInputClass} defaultValue={batch.plannedPairs} aria-label="Planned pairs" />
                      <input name="finishedPairs" type="number" min="0" className={compactInputClass} defaultValue={batch.finishedPairs} aria-label="Finished pairs" />
                      <input name="inProgressPairs" type="number" min="0" className={compactInputClass} defaultValue={batch.inProgressPairs} aria-label="Work in progress pairs" />
                      <input name="rejectedPairs" type="number" min="0" className={compactInputClass} defaultValue={batch.rejectedPairs} aria-label="Rejected pairs" />
                    </div>
                    <textarea
                      name="rawMaterialUsed"
                      className="min-h-16 rounded-md border border-brand-green-line px-2 py-2 text-sm outline-none focus:border-brand-green"
                      defaultValue={batch.rawMaterialUsed.join(", ")}
                      aria-label="Raw materials used"
                    />
                    <div className="flex flex-wrap gap-2">
                      <select aria-label="Status" name="status" className={compactInputClass} defaultValue={batch.status}>
                        <option>Planning</option>
                        <option>Cutting</option>
                        <option>Making</option>
                        <option>QC</option>
                        <option>Packed</option>
                      </select>
                      <SaveButton />
                    </div>
                  </EnterWalkForm>
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
    <section className="rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
      <SectionTitle
        title="Worker progress and camera zones"
        detail="Kun worker le kun station ma kati progress garyo."
      />
      <div className="grid gap-3">
        {snapshot.workerTasks.map((task) => {
          const linkedBatch = snapshot.productionBatches.find((batch) => batch.id === task.batchId);

          return (
            <div key={task.id} className="rounded-lg border border-brand-green-line bg-brand-paper-deep p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-brand-green-ink">{task.workerName}</p>
                <span className="rounded-full bg-brand-paper px-3 py-1 text-sm font-bold text-brand-green">
                  {task.status}
                </span>
              </div>
              <p className="mt-2 text-base text-brand-muted">
                {task.station} - {task.design}
              </p>
              <p className="mt-1 text-sm font-bold text-brand-muted-soft">
                Batch: {linkedBatch ? `${linkedBatch.design} (${linkedBatch.status})` : "Manual / unlinked"}
              </p>
              <p className="mt-1 text-base font-semibold text-brand-muted-deep">
                {task.completedPairs}/{task.targetPairs} pairs - {task.cameraZone}
              </p>
              <EnterWalkForm action={updateWorkerTaskAction} className="mt-3 grid gap-2">
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
              </EnterWalkForm>
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
    <section className="rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
      <SectionTitle title="Raw material" detail="Used, received, balance, reorder alert." />
      <div className="grid gap-3">
        {snapshot.rawMaterials.map((material) => {
          const valuation = valuationByMaterialId.get(material.id);

          return (
            <div key={material.id} className="rounded-lg border border-brand-green-line p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-bold text-brand-green-ink">{material.name}</p>
                <span className={material.lowStock ? "text-base font-bold text-red-700" : "text-base font-bold text-brand-green"}>
                  {material.balance} {material.unit}
                </span>
              </div>
              <div className="mb-3 rounded-md bg-brand-paper-deep p-3 text-sm font-semibold text-brand-muted">
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
              <EnterWalkForm action={updateRawMaterialAction} className="grid gap-2">
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
                  {/* Read only: it is what the purchase bills brought in. */}
                  <p className={`${compactInputClass} flex items-center bg-brand-paper-deep text-brand-muted`} title="From purchase bills">
                    <T en={`In: ${material.received}`} ne={`आएको: ${material.received}`} />
                  </p>
                  <input name="reorderLevel" type="number" min="0" className={compactInputClass} defaultValue={material.reorderLevel} aria-label="Reorder level" />
                </div>
                <SaveButton />
              </EnterWalkForm>
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
    <section className="rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
      <SectionTitle
        title="Material consumption"
        detail="Batch-wise raw material used, wastage, and production notes."
      />
      {snapshot.materialConsumptions.length === 0 ? (
        <p className="text-base text-brand-muted">No material consumption has been recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="reflow-table min-w-full text-base">
            <thead className="border-b text-left text-brand-muted">
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
                  <td className="reflow-primary py-3 pr-3 text-sm text-brand-muted">
                    <DateDisplayAdmin date={consumption.createdAt} time />
                  </td>
                  <td data-label="Batch" className="py-3 pr-3 font-semibold text-brand-green-ink">{consumption.batchDesign}</td>
                  <td data-label="Material" className="py-3 pr-3">{consumption.materialName}</td>
                  <td data-label="Used" className="py-3 pr-3 font-bold text-brand-green">
                    {consumption.quantity} {consumption.unit}
                  </td>
                  <td data-label="Wastage" className="py-3 pr-3 font-bold text-brand-clay">
                    {consumption.wastage} {consumption.unit}
                  </td>
                  <td data-label="Note" className="max-w-48 py-3 pr-3 text-brand-muted">{consumption.note || "-"}</td>
                  <td data-label="Manage" className="py-3 pr-3">
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
    <section className="rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
      <SectionTitle title="Fast and slow designs" detail="Market demand signal by sold pairs." />
      <div className="grid gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.16em] text-brand-green">Fast moving</p>
          {snapshot.fastMovingStock.slice(0, 3).map((stock) => (
            <p key={stock.id} className="mt-2 text-base text-brand-muted-deep">
              {stock.design}: <span className="font-bold">{stock.soldPairs}</span> sold
            </p>
          ))}
        </div>
        <div>
          <p className="text-sm font-black uppercase tracking-[0.16em] text-brand-clay">Slow moving</p>
          {snapshot.slowMovingStock.slice(0, 3).map((stock) => (
            <p key={stock.id} className="mt-2 text-base text-brand-muted-deep">
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
    <section className="rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
      <SectionTitle title="Collection summary" detail="Cash, cheque, credit from market vehicles." />
      <dl className="grid gap-3 text-base">
        <div className="flex justify-between">
          <dt className="font-semibold text-brand-muted">Cash</dt>
          <dd className="font-black text-brand-green-ink">{money(snapshot.summary.cash)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-semibold text-brand-muted">Cheque</dt>
          <dd className="font-black text-brand-green-ink">{money(snapshot.summary.cheque)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-semibold text-brand-muted">Credit</dt>
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
    <section className="mt-8 rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
      <SectionTitle title="Finished stock" detail="Design, channel, stock, COGS value, profit potential, and returns." />
      <div className="overflow-x-auto">
        <table className="reflow-table min-w-full text-base">
          <thead className="border-b text-left text-brand-muted">
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
            {/* One line per shoe. A shoe posted size by size is several rows
                (Fom flat 25 to 30, ten each), which read as six shoes in a
                jumbled order; the sizes now sit in the Size cell and each
                row still opens to be corrected. */}
            {snapshot.finishedStockByShoe.map((shoe) => {
              const members = shoe.ids
                .map((id) => snapshot.finishedStock.find((stock) => stock.id === id))
                .filter((stock): stock is (typeof snapshot.finishedStock)[number] => Boolean(stock));
              const health = snapshot.reports.stockHealthRows.find((row) => row.id === shoe.id);
              const valuations = members.map((stock) => valuationByStockId.get(stock.id));
              const stockValue = valuations.reduce((total, row) => total + (row?.stockValue ?? 0), 0);
              const profit = valuations.reduce((total, row) => total + (row?.potentialGrossProfit ?? 0), 0);
              const first = valuations.find(Boolean);

              return (
                <tr key={shoe.id}>
                  <td className="reflow-primary py-3 pr-3 font-semibold text-brand-green-ink">{shoe.design}</td>
                  <td data-label="Channel" className="py-3 pr-3">{shoe.channel}</td>
                  <td data-label="Size" className="py-3 pr-3">
                    {members.length > 1 ? (
                      <span className="flex max-w-56 flex-wrap gap-1">
                        {shoe.sizes.map((size) => (
                          <span
                            key={size.size}
                            className="rounded-md border border-brand-green-line px-1.5 text-sm font-bold tabular-nums"
                          >
                            {size.size}: {size.pairs}
                          </span>
                        ))}
                      </span>
                    ) : (
                      shoe.sizeRun
                    )}
                  </td>
                  <td data-label="Stock" className="py-3 pr-3 font-bold text-brand-green">{shoe.stockPairs}</td>
                  <td data-label="Value" className="py-3 pr-3">
                    <p className="font-bold text-brand-green-ink">{money(stockValue)}</p>
                    <p className="text-sm text-brand-muted">
                      COGS {money(first?.unitCostPerPair ?? 0)} / profit {money(profit)}
                    </p>
                    <p className="mt-1 text-sm font-bold text-brand-gold-ink">
                      {first?.signal ?? "Needs cost"} / {first?.priceSource ?? "Missing"}
                    </p>
                  </td>
                  <td data-label="Sold" className="py-3 pr-3">{shoe.soldPairs}</td>
                  <td data-label="Return" className="py-3 pr-3">{shoe.returnedPairs}</td>
                  <td data-label="Health" className="py-3 pr-3">
                    <span className={`rounded-full px-3 py-1 text-sm font-bold ${stockSignalClass(health?.signal ?? "Healthy")}`}>
                      {health?.signal ?? "Healthy"}
                    </span>
                    <p className="mt-1 text-sm text-brand-muted">
                      Sell {health?.sellThroughRate ?? 0}% | return {health?.returnRate ?? 0}%
                    </p>
                  </td>
                  <td data-label="Manage" className="min-w-96 py-3 pr-3">
                    {members.length > 1 ? (
                      <details>
                        <summary className="cursor-pointer text-sm font-black text-brand-green">
                          <T en={`Correct size by size (${members.length})`} ne={`साइज अनुसार सच्याउने (${members.length})`} />
                        </summary>
                        <div className="mt-2 grid gap-3">
                          {members.map((stock) => (
                            <div key={stock.id} className="rounded-lg border border-brand-green-line p-2">
                              <p className="mb-1 text-sm font-black text-brand-green-ink">
                                <T en={`Size ${stock.sizeRun}`} ne={`साइज ${stock.sizeRun}`} />
                              </p>
                              <FinishedStockEditForm stock={stock} />
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : members[0] ? (
                      <FinishedStockEditForm stock={members[0]} />
                    ) : null}
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

/** One stock row's correction form, and its delete. */
function FinishedStockEditForm({ stock }: { stock: OperationsSnapshot["finishedStock"][number] }) {
  return (
    <>
      <EnterWalkForm action={updateFinishedStockAction} className="grid gap-2">
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
      </EnterWalkForm>
      <div className="mt-2">
        <DeleteRecordForm kind="finishedStock" id={stock.id} />
      </div>
    </>
  );
}

function StockLedgerSummary({ snapshot }: { snapshot: OperationsSnapshot }) {
  return (
    <section className="mt-8 rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-brand-green-ink">Stock ledger summary</h2>
          <p className="mt-1 text-base text-brand-muted">
            Book stock compared with stock movement trail for closing, audit, and correction.
          </p>
        </div>
        <ExportButton
          href="/api/admin/operations/export?type=stock-ledger-summary"
          className="inline-flex h-9 items-center rounded-full border border-brand-green-line px-3 text-sm font-bold text-brand-green-ink transition hover:border-brand-green hover:text-brand-green"
        >
          Export ledger CSV
        </ExportButton>
      </div>

      {snapshot.reports.stockLedgerRows.length === 0 ? (
        <p className="text-base text-brand-muted">No stock ledger rows are available yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="reflow-table min-w-full text-base">
            <thead className="border-b text-left text-brand-muted">
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
                  <td className="reflow-primary py-3 pr-3">
                    <p className="font-semibold text-brand-green-ink">{row.design}</p>
                    <p className="text-sm text-brand-muted">
                      {row.channel} | {row.sizeRun}
                    </p>
                  </td>
                  <td data-label="Book stock" className="py-3 pr-3 font-bold text-brand-green">{row.stockPairs}</td>
                  <td data-label="Movement stock" className="py-3 pr-3">
                    <p className="font-bold text-brand-green-ink">{row.movementStockPairs}</p>
                    <p className="text-sm text-brand-muted">{row.movementCount} movements</p>
                  </td>
                  <td data-label="Variance" className={`py-3 pr-3 font-black ${row.variancePairs === 0 ? "text-brand-green" : "text-brand-clay"}`}>
                    {row.variancePairs}
                  </td>
                  <td data-label="Flow" className="py-3 pr-3 text-sm font-semibold text-brand-muted">
                    <p>In {row.productionIn + row.returnIn + row.adjustment}</p>
                    <p>Out {row.dispatchOut + row.saleOut}</p>
                    <p>Market {row.marketSale}</p>
                  </td>
                  <td data-label="Last movement" className="py-3 pr-3 text-sm text-brand-muted"><OptionalDate value={row.lastMovementAt} /></td>
                  <td data-label="Signal" className="py-3 pr-3">
                    <span className={`rounded-full px-3 py-1 text-sm font-bold ${stockLedgerSignalClass(row.signal)}`}>
                      {row.signal}
                    </span>
                    <p className="mt-2 max-w-60 text-sm font-semibold text-brand-muted">{row.nextAction}</p>
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
    <section className="rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
      <SectionTitle title="Vehicle dispatch" detail="Gadi, driver, route, loaded, return, collection." />
      <div className="grid gap-3">
        {snapshot.vehicleDispatches.map((dispatch) => (
          <div key={dispatch.id} className="rounded-lg border border-brand-green-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold text-brand-green-ink">{dispatch.vehicleNumber}</p>
              <span className="rounded-full bg-brand-mist px-3 py-1 text-sm font-bold text-brand-green">
                {dispatch.status}
              </span>
            </div>
            <p className="mt-2 text-base text-brand-muted">
              {dispatch.driverName} - {dispatch.marketRoute}
            </p>
            <p className="mt-1 text-base text-brand-muted-deep">
              Loaded {dispatch.loadedPairs}, returned {dispatch.returnedPairs}, credit {money(dispatch.creditAmount)}
            </p>
            <EnterWalkForm action={updateVehicleDispatchAction} className="mt-3 grid gap-2">
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
            </EnterWalkForm>
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
    <section className="mt-8 rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-brand-green-ink">Collection follow-up queue</h2>
          <p className="mt-1 text-base text-brand-muted">
            Customer-wise priority, payment due date, and next collection action.
          </p>
        </div>
        <ExportButton
          href="/api/admin/operations/export?type=ledger-followups"
          className="inline-flex h-9 items-center rounded-full border border-brand-green-line px-3 text-sm font-bold text-brand-green-ink transition hover:border-brand-green hover:text-brand-green"
        >
          Export follow-ups
        </ExportButton>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-brand-green-line bg-brand-paper-deep p-3">
          <p className="text-sm font-semibold text-brand-muted">Urgent</p>
          <p className="mt-1 text-xl font-black text-brand-clay">
            {snapshot.reports.ledgerCollectionSummary.urgentCount}
          </p>
        </div>
        <div className="rounded-lg border border-brand-green-line bg-brand-paper-deep p-3">
          <p className="text-sm font-semibold text-brand-muted">High</p>
          <p className="mt-1 text-xl font-black text-brand-gold-ink">
            {snapshot.reports.ledgerCollectionSummary.highCount}
          </p>
        </div>
        <div className="rounded-lg border border-brand-green-line bg-brand-paper-deep p-3">
          <p className="text-sm font-semibold text-brand-muted">This week due</p>
          <p className="mt-1 text-xl font-black text-brand-green-ink">
            {money(snapshot.reports.ledgerCollectionSummary.dueThisWeek)}
          </p>
        </div>
        <div className="rounded-lg border border-brand-green-line bg-brand-paper-deep p-3">
          <p className="text-sm font-semibold text-brand-muted">Total due</p>
          <p className="mt-1 text-xl font-black text-brand-green-ink">
            {money(snapshot.reports.ledgerCollectionSummary.totalDue)}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-base text-brand-muted">No customer collection follow-up is due.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="reflow-table min-w-full text-base">
            <thead className="border-b text-left text-brand-muted">
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
                  <td className="reflow-primary py-3 pr-3">
                    <Link
                      href={`/admin/operations/ledger/${ledger.id}`}
                      className="font-semibold text-brand-green-ink underline decoration-brand-gold-bright underline-offset-4 transition hover:text-brand-green"
                    >
                      {ledger.customerName}
                    </Link>
                    <p className="text-sm text-brand-muted">
                      {ledger.channel} | {ledger.phone || "No phone"}
                    </p>
                  </td>
                  <td data-label="Priority" className="py-3 pr-3">
                    <span className={`rounded-full px-3 py-1 text-sm font-bold ${collectionPriorityClass(ledger.priority)}`}>
                      {ledger.priority}
                    </span>
                  </td>
                  <td data-label="Due" className="py-3 pr-3 font-bold text-brand-clay">{money(ledger.balanceDue)}</td>
                  <td data-label="Aging" className="py-3 pr-3">
                    <p className={`font-bold ${agingClass(ledger.agingBucket)}`}>{ledger.agingBucket}</p>
                    <p className="text-sm text-brand-muted">{ledger.daysOutstanding} days</p>
                  </td>
                  <td data-label="Coverage" className="py-3 pr-3">
                    <p className="font-semibold text-brand-green-ink">{ledger.collectionCoverageRate}%</p>
                    <p className="text-sm text-brand-muted">{money(ledger.collectionTotal)} collected</p>
                  </td>
                  <td data-label="Follow-up" className="py-3 pr-3">{ledger.followUpDueDate || "-"}</td>
                  <td data-label="Action" className="max-w-72 py-3 pr-3 text-sm font-semibold leading-5 text-brand-muted">
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
    <section className="mt-8 rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
      <SectionTitle
        title="Dispatch item history"
        detail="Vehicle-wise design, size, loaded, sold, return, and collection trail."
      />
      {snapshot.vehicleDispatchItems.length === 0 ? (
        <p className="text-base text-brand-muted">No dispatch item has been recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="reflow-table min-w-full text-base">
            <thead className="border-b text-left text-brand-muted">
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
                  <td className="reflow-primary py-3 pr-3 text-sm text-brand-muted">
                    <DateDisplayAdmin date={item.createdAt} time />
                  </td>
                  <td data-label="Vehicle" className="py-3 pr-3">
                    <p className="font-semibold text-brand-green-ink">{item.vehicleNumber}</p>
                    <p className="text-sm text-brand-muted">{item.marketRoute || "-"}</p>
                  </td>
                  <td data-label="Design" className="py-3 pr-3">
                    <p className="font-semibold text-brand-green-ink">{item.design}</p>
                    <p className="text-sm text-brand-muted">{item.sizeRun}</p>
                  </td>
                  <td data-label="Channel" className="py-3 pr-3">{item.channel}</td>
                  <td data-label="Loaded" className="py-3 pr-3 font-bold">{item.loadedPairs}</td>
                  <td data-label="Sold" className="py-3 pr-3 text-brand-green">{item.soldPairs}</td>
                  <td data-label="Return" className="py-3 pr-3 text-brand-clay">{item.returnedPairs}</td>
                  <td data-label="Collection" className="py-3 pr-3">
                    <p>{money(item.cashCollected)} cash</p>
                    <p className="text-sm text-brand-muted">
                      {money(item.chequeCollected)} cheque, {money(item.creditAmount)} credit
                    </p>
                  </td>
                  <td data-label="Manage" className="py-3 pr-3">
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
    <section id="customer-ledgers" className="scroll-mt-24 rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
      <SectionTitle title="Customer ledger" detail="Customer details, cash, cheque, credit, balance due." />
      <div className="overflow-x-auto">
        <table className="reflow-table min-w-full text-base">
          <thead className="border-b text-left text-brand-muted">
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
                  <td className="reflow-primary py-3 pr-3">
                    <Link
                      href={`/admin/operations/ledger/${ledger.id}`}
                      className="font-semibold text-brand-green-ink underline decoration-brand-gold-bright underline-offset-4 transition hover:text-brand-green"
                    >
                      {ledger.customerName}
                    </Link>
                    <p className="text-sm text-brand-muted">{ledger.phone}</p>
                  </td>
                  <td data-label="Channel" className="py-3 pr-3">{ledger.channel}</td>
                  <td data-label="Cash" className="py-3 pr-3">{money(ledger.cashPaid)}</td>
                  <td data-label="Cheque" className="py-3 pr-3">{money(ledger.chequePaid)}</td>
                  <td data-label="Due" className="py-3 pr-3 font-bold text-brand-clay">{money(ledger.balanceDue)}</td>
                  <td data-label="Aging" className="py-3 pr-3">
                    <p className={`font-bold ${agingClass(aging?.agingBucket ?? "Paid")}`}>
                      {aging?.agingBucket ?? "Paid"}
                    </p>
                    <p className="text-sm text-brand-muted">
                      {aging?.daysOutstanding ?? 0} days | {aging?.collectionCoverageRate ?? 0}% cover
                    </p>
                  </td>
                  <td data-label="Manage" className="min-w-80 py-3 pr-3">
                    <EnterWalkForm action={updateCustomerLedgerAction} className="grid gap-2">
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
                    </EnterWalkForm>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Link
                        href={`/admin/operations/ledger/${ledger.id}`}
                        className="inline-flex h-9 items-center rounded-full border border-brand-green-line px-3 text-sm font-bold text-brand-green-ink transition hover:border-brand-green"
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

/**
 * One line per bill, not per size (owner, 2026-09-29). A counter bill writes
 * a movement for every size of every shoe on it — bill 0003 was eleven lines —
 * so forty-eight lines told the story of about fifteen events. Movements that
 * share a bill or purchase number group under it; the rest group by day, shoe
 * and type. Each line still opens to its rows, with Delete on every one.
 */
type MovementRow = OperationsSnapshot["stockMovements"][number];

function movementGroupKey(movement: MovementRow) {
  // Old bills read KR-BILL-…, new ones KRB001 / KRR001 (lib/bill-number.ts).
  const reference = /KR-(?:BILL|PUR)-[A-Za-z0-9-]+|\bKR[BR]\d+\b/.exec(movement.note ?? "")?.[0]?.replace(/-[A-F0-9]{6}$/, "");
  if (reference) return { key: `ref:${reference}`, reference };
  const day = String(movement.createdAt ?? "").slice(0, 10);
  return { key: `day:${day}:${movement.design}:${movement.type}`, reference: "" };
}

function groupMovements(movements: MovementRow[]) {
  const groups = new Map<string, { key: string; reference: string; rows: MovementRow[] }>();
  for (const movement of movements) {
    const { key, reference } = movementGroupKey(movement);
    const group = groups.get(key) ?? { key, reference, rows: [] };
    group.rows.push(movement);
    groups.set(key, group);
  }
  return [...groups.values()];
}

const OUTGOING = new Set(["Sale Out", "Dispatch Out", "Market Sale", "Damage Out"]);

function StockMovementHistory({ snapshot }: { snapshot: OperationsSnapshot }) {
  const groups = groupMovements(snapshot.stockMovements);

  return (
    <section className="rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
      <SectionTitle title="Stock movement history" detail="One line per bill or per shoe a day — open a line for its rows." />
      {groups.length === 0 ? (
        <p className="text-lg text-brand-muted">No stock movement has been recorded yet.</p>
      ) : (
        <ul className="grid gap-2">
          {groups.map((group) => {
            const first = group.rows[0];
            const types = [...new Set(group.rows.map((row) => row.type))];
            const pairs = group.rows.reduce((total, row) => total + (Number(row.pairs) || 0), 0);
            const signed = types.every((type) => OUTGOING.has(type)) ? -pairs : pairs;
            const byShoe = new Map<string, number>();
            for (const row of group.rows) byShoe.set(row.design, (byShoe.get(row.design) ?? 0) + (Number(row.pairs) || 0));

            return (
              <li key={group.key} className="rounded-lg border border-brand-green-line px-3 py-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="font-black text-brand-green-ink">
                    {group.reference ? group.reference : first.design}
                    <span className="ml-2 text-base font-semibold text-brand-muted">
                      <DateDisplayAdmin date={first.createdAt} time />
                    </span>
                  </p>
                  <p className={`text-lg font-black tabular-nums ${signed < 0 ? "text-brand-clay" : "text-brand-green"}`}>
                    {signed > 0 ? "+" : ""}
                    {signed}
                  </p>
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-base text-brand-muted">
                  {types.map((type) => (
                    <span key={type} className={`rounded-full px-2.5 py-0.5 text-base font-bold ${stockMovementTypeClass(type)}`}>
                      {type}
                    </span>
                  ))}
                  <span>{[...byShoe.entries()].map(([design, count]) => `${design} ${count}`).join(" · ")}</span>
                </p>
                <details className="mt-1.5">
                  <summary className="cursor-pointer text-base font-bold text-brand-green">
                    <T en={`Rows (${group.rows.length})`} ne={`लाइन हेर्ने (${group.rows.length})`} />
                  </summary>
                  <ul className="mt-2 grid gap-1.5">
                    {group.rows.map((movement) => {
                      const linkedItem = snapshot.vehicleDispatchItems.find((item) =>
                        item.stockMovementIds.includes(movement.id),
                      );
                      const source = stockMovementSource(movement, linkedItem);
                      return (
                        <li key={movement.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-brand-green-line pt-1.5 text-base">
                          <span>
                            <b className="text-brand-green-ink">{movement.design}</b> · {movement.channel}
                            {movement.sizeRun ? ` · ${movement.sizeRun}` : ""} · {movement.type} · <b>{movement.pairs}</b>
                            <span className="block text-brand-muted">{source.label} — {movement.note || source.detail}</span>
                          </span>
                          <DeleteRecordForm kind="stockMovement" id={movement.id} />
                        </li>
                      );
                    })}
                  </ul>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function LedgerTransactionHistory({ snapshot }: { snapshot: OperationsSnapshot }) {
  return (
    <section className="rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
      <SectionTitle title="Ledger transaction history" detail="Cash, cheque, credit sale, return adjustment, and balance adjustment trail." />
      {snapshot.ledgerTransactions.length === 0 ? (
        <p className="text-base text-brand-muted">No ledger transaction has been recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="reflow-table min-w-full text-base">
            <thead className="border-b text-left text-brand-muted">
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
                  <td className="reflow-primary py-3 pr-3 text-sm text-brand-muted">
                    <DateDisplayAdmin date={transaction.createdAt} time />
                  </td>
                  <td data-label="Customer" className="py-3 pr-3">
                    <Link
                      href={`/admin/operations/ledger/${transaction.ledgerId}`}
                      className="font-semibold text-brand-green-ink underline decoration-brand-gold-bright underline-offset-4 transition hover:text-brand-green"
                    >
                      {transaction.customerName}
                    </Link>
                  </td>
                  <td data-label="Type" className="py-3 pr-3">
                    <span className={`rounded-full px-3 py-1 text-sm font-bold ${ledgerTransactionTypeClass(transaction.type)}`}>
                      {transaction.type}
                    </span>
                  </td>
                  <td data-label="Amount" className="py-3 pr-3 font-bold">{money(transaction.amount)}</td>
                  <td data-label="Note" className="max-w-56 py-3 pr-3 text-brand-muted">{transaction.note || "-"}</td>
                  <td data-label="Manage" className="py-3 pr-3">
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
  // A part of the shop nobody has used yet — batches, vehicles, customer
  // ledgers — showed as a full empty section, twelve of them, between the
  // tables that are used every day (owner, 2026-09-29). Empty parts go under
  // one "more" fold; each comes back out by itself with its first record.
  const followups = snapshot.reports.ledgerCollectionFollowups.filter((ledger) => ledger.priority !== "Clear");
  const collected = snapshot.summary.cash + snapshot.summary.cheque + snapshot.summary.credit;
  const parts: Array<{ id: string; used: boolean; node: React.ReactNode }> = [
    { id: "batches", used: snapshot.productionBatches.length > 0, node: <ProductionBatchesTable snapshot={snapshot} /> },
    { id: "workers", used: snapshot.workerTasks.length > 0, node: <WorkerProgressCards snapshot={snapshot} /> },
    { id: "raw", used: snapshot.rawMaterials.length > 0, node: <RawMaterialsPanel snapshot={snapshot} costing={costing} /> },
    { id: "collection", used: collected > 0, node: <CollectionPanel snapshot={snapshot} /> },
    { id: "vehicles", used: snapshot.vehicleDispatches.length > 0, node: <VehicleDispatchCards snapshot={snapshot} /> },
    { id: "ledgers", used: snapshot.customerLedgers.length > 0, node: <CustomerLedgerTable snapshot={snapshot} /> },
    { id: "followups", used: followups.length > 0, node: <LedgerFollowupQueue snapshot={snapshot} /> },
    { id: "dispatch-items", used: snapshot.vehicleDispatchItems.length > 0, node: <VehicleDispatchItemHistory snapshot={snapshot} /> },
    { id: "consumption", used: snapshot.materialConsumptions.length > 0, node: <MaterialConsumptionHistory snapshot={snapshot} /> },
    { id: "ledger-txns", used: snapshot.ledgerTransactions.length > 0, node: <LedgerTransactionHistory snapshot={snapshot} /> },
  ];
  const used = parts.filter((part) => part.used);
  const unused = parts.filter((part) => !part.used);

  return (
    <>
      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <DemandPanel snapshot={snapshot} />
      </div>

      <FinishedStockTable snapshot={snapshot} costing={costing} />
      <StockLedgerSummary snapshot={snapshot} />

      <div className="mt-8">
        <StockMovementHistory snapshot={snapshot} />
      </div>

      {used.length > 0 ? (
        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          {used.map((part) => (
            <div key={part.id} className="min-w-0 [&>section]:mt-0">{part.node}</div>
          ))}
        </div>
      ) : null}

      {unused.length > 0 ? (
        <details className="mt-8 rounded-lg border border-dashed border-brand-green-line bg-brand-paper p-4">
          <summary className="cursor-pointer text-lg font-black text-brand-muted-deep">
            <T
              en={`More — parts not used yet (${unused.length}): batches, vehicles, customer ledgers…`}
              ne={`थप — अहिलेसम्म प्रयोग नभएका भाग (${unused.length}): batch, गाडी, ग्राहक खाता…`}
            />
          </summary>
          <div className="mt-4 grid gap-6 xl:grid-cols-2">
            {unused.map((part) => (
              <div key={part.id} className="min-w-0 [&>section]:mt-0">{part.node}</div>
            ))}
          </div>
        </details>
      ) : null}
    </>
  );
}
