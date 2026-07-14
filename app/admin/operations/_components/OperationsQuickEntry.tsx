import {
  createCustomerLedgerAction,
  createFinishedStockAction,
  createLedgerTransactionAction,
  createMaterialConsumptionAction,
  createProductionBatchAction,
  createRawMaterialAction,
  createStockMovementAction,
  createVehicleDispatchAction,
  createVehicleDispatchItemAction,
  createWorkerTaskAction,
} from "@/app/admin/operations/actions";
import type { OperationsSnapshot } from "@/app/admin/operations/_components/types";
import {
  inputClass,
  SectionTitle,
  SubmitActionButton,
  textareaClass,
  workerStationOptions,
  workerStatusOptions,
} from "@/app/admin/operations/_components/operations-ui";

export default function OperationsQuickEntry({ snapshot }: { snapshot: OperationsSnapshot }) {
  const stockDesignOptions = Array.from(
    new Set(snapshot.finishedStock.map((stock) => stock.design).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right));

  return (
    <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <SectionTitle
        title="Quick entry"
        detail="Real local entries for factory, vehicle, and ledger records. These are saved in data/operations.json."
      />
      <datalist id="stock-design-options">
        {stockDesignOptions.map((design) => (
          <option key={design} value={design} />
        ))}
      </datalist>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <form action={createProductionBatchAction} className="grid gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
          <h3 className="font-black text-[#10231D]">Production batch</h3>
          <input name="design" required list="stock-design-options" className={inputClass} placeholder="Design name" />
          <div className="grid grid-cols-2 gap-2">
            <input name="plannedPairs" type="number" min="0" className={inputClass} placeholder="Planned" />
            <input name="finishedPairs" type="number" min="0" className={inputClass} placeholder="Finished" />
            <input name="inProgressPairs" type="number" min="0" className={inputClass} placeholder="WIP" />
            <input name="rejectedPairs" type="number" min="0" className={inputClass} placeholder="Reject" />
          </div>
          <textarea name="rawMaterialUsed" className={textareaClass} placeholder="Raw materials, comma-separated" />
          <select name="status" className={inputClass} defaultValue="Planning">
            <option>Planning</option>
            <option>Cutting</option>
            <option>Making</option>
            <option>QC</option>
            <option>Packed</option>
          </select>
          <SubmitActionButton label="Add batch" />
        </form>

        <form action={createRawMaterialAction} className="grid gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
          <h3 className="font-black text-[#10231D]">Raw material</h3>
          <input name="name" required className={inputClass} placeholder="Material name" />
          <select name="unit" className={inputClass} defaultValue="kg">
            <option value="kg">kg</option>
            <option value="meter">meter</option>
            <option value="pair">pair</option>
            <option value="piece">piece</option>
            <option value="liter">liter</option>
          </select>
          <input name="openingStock" type="number" min="0" className={inputClass} placeholder="Opening stock" />
          <input name="received" type="number" min="0" className={inputClass} placeholder="Received" />
          <input name="reorderLevel" type="number" min="0" className={inputClass} placeholder="Reorder level" />
          <SubmitActionButton label="Add material" />
        </form>

        <form action={createMaterialConsumptionAction} className="grid gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
          <h3 className="font-black text-[#10231D]">Material consumption</h3>
          <select name="batchId" required className={inputClass} defaultValue="">
            <option value="" disabled>
              Select production batch
            </option>
            {snapshot.productionBatches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.design} - {batch.status}
              </option>
            ))}
          </select>
          <select name="materialId" required className={inputClass} defaultValue="">
            <option value="" disabled>
              Select raw material
            </option>
            {snapshot.rawMaterials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.name} ({material.balance} {material.unit})
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input name="quantity" type="number" min="0" className={inputClass} placeholder="Used" />
            <input name="wastage" type="number" min="0" className={inputClass} placeholder="Wastage" />
          </div>
          <textarea name="note" className={textareaClass} placeholder="Cutting, sole press, QC remark, or batch note" />
          <SubmitActionButton label="Record usage" />
        </form>

        <form action={createWorkerTaskAction} className="grid gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
          <h3 className="font-black text-[#10231D]">Worker task</h3>
          <input name="workerName" required className={inputClass} placeholder="Worker name" />
          <select name="batchId" className={inputClass} defaultValue="">
            <option value="">Manual design / no batch</option>
            {snapshot.productionBatches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.design} - {batch.status}
              </option>
            ))}
          </select>
          <input name="design" className={inputClass} placeholder="Design name if no batch" />
          <div className="grid grid-cols-2 gap-2">
            <select name="station" className={inputClass} defaultValue="Cutting">
              {workerStationOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
            <select name="status" className={inputClass} defaultValue="Not Started">
              {workerStatusOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
            <input name="targetPairs" type="number" min="0" className={inputClass} placeholder="Target" />
            <input name="completedPairs" type="number" min="0" className={inputClass} placeholder="Completed" />
          </div>
          <input name="cameraZone" className={inputClass} placeholder="Camera zone" />
          <SubmitActionButton label="Add worker task" />
        </form>

        <form action={createVehicleDispatchAction} className="grid gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
          <h3 className="font-black text-[#10231D]">Vehicle dispatch</h3>
          <input name="vehicleNumber" required className={inputClass} placeholder="Vehicle number" />
          <input name="driverName" required className={inputClass} placeholder="Driver name" />
          <input name="marketRoute" className={inputClass} placeholder="Market route" />
          <div className="grid grid-cols-2 gap-2">
            <input name="loadedPairs" type="number" min="0" className={inputClass} placeholder="Loaded" />
            <input name="returnedPairs" type="number" min="0" className={inputClass} placeholder="Return" />
            <input name="cashCollected" type="number" min="0" className={inputClass} placeholder="Cash" />
            <input name="creditAmount" type="number" min="0" className={inputClass} placeholder="Credit" />
          </div>
          <input name="chequeCollected" type="number" min="0" className={inputClass} placeholder="Cheque" />
          <select name="status" className={inputClass} defaultValue="Loading">
            <option>Loading</option>
            <option>In Market</option>
            <option>Returned</option>
            <option>Closed</option>
          </select>
          <SubmitActionButton label="Add dispatch" />
        </form>

        <form action={createVehicleDispatchItemAction} className="grid gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
          <h3 className="font-black text-[#10231D]">Dispatch item</h3>
          <select name="dispatchId" required className={inputClass} defaultValue="">
            <option value="" disabled>
              Select vehicle trip
            </option>
            {snapshot.vehicleDispatches.map((dispatch) => (
              <option key={dispatch.id} value={dispatch.id}>
                {dispatch.vehicleNumber} - {dispatch.marketRoute || dispatch.driverName}
              </option>
            ))}
          </select>
          <input name="design" required list="stock-design-options" className={inputClass} placeholder="Design name" />
          <div className="grid grid-cols-2 gap-2">
            <select name="channel" className={inputClass} defaultValue="Wholesale">
              <option>Wholesale</option>
              <option>Retail</option>
              <option>Online</option>
            </select>
            <input name="sizeRun" className={inputClass} placeholder="Size run" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input name="loadedPairs" type="number" min="0" className={inputClass} placeholder="Loaded" />
            <input name="soldPairs" type="number" min="0" className={inputClass} placeholder="Sold" />
            <input name="returnedPairs" type="number" min="0" className={inputClass} placeholder="Return" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input name="cashCollected" type="number" min="0" className={inputClass} placeholder="Cash" />
            <input name="chequeCollected" type="number" min="0" className={inputClass} placeholder="Cheque" />
            <input name="creditAmount" type="number" min="0" className={inputClass} placeholder="Credit" />
          </div>
          <textarea name="note" className={textareaClass} placeholder="Bill number, shop, return, or collection note" />
          <SubmitActionButton label="Add dispatch item" />
        </form>

        <form action={createCustomerLedgerAction} className="grid gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
          <h3 className="font-black text-[#10231D]">Customer ledger</h3>
          <input name="customerName" required className={inputClass} placeholder="Customer/shop name" />
          <input name="phone" className={inputClass} placeholder="Phone" />
          <select name="channel" className={inputClass} defaultValue="Wholesale">
            <option>Wholesale</option>
            <option>Retail</option>
            <option>Online</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input name="cashPaid" type="number" min="0" className={inputClass} placeholder="Cash" />
            <input name="chequePaid" type="number" min="0" className={inputClass} placeholder="Cheque" />
            <input name="creditGiven" type="number" min="0" className={inputClass} placeholder="Credit" />
            <input name="balanceDue" type="number" min="0" className={inputClass} placeholder="Due" />
          </div>
          <SubmitActionButton label="Add ledger" />
        </form>

        <form action={createStockMovementAction} className="grid gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
          <h3 className="font-black text-[#10231D]">Stock movement</h3>
          <input name="design" required list="stock-design-options" className={inputClass} placeholder="Design name" />
          <div className="grid grid-cols-2 gap-2">
            <select name="channel" className={inputClass} defaultValue="Factory">
              <option>Factory</option>
              <option>Wholesale</option>
              <option>Retail</option>
              <option>Online</option>
            </select>
            <select name="type" className={inputClass} defaultValue="Production In">
              <option>Production In</option>
              <option>Dispatch Out</option>
              <option>Return In</option>
              <option>Sale Out</option>
              <option>Market Sale</option>
              <option>Adjustment</option>
            </select>
          </div>
          <input name="pairs" type="number" min="0" className={inputClass} placeholder="Pairs" />
          <textarea name="note" className={textareaClass} placeholder="Bill, vehicle, return, or adjustment note" />
          <SubmitActionButton label="Record movement" />
        </form>

        <form action={createFinishedStockAction} className="grid gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
          <h3 className="font-black text-[#10231D]">Finished stock</h3>
          <input name="design" required list="stock-design-options" className={inputClass} placeholder="Design name" />
          <div className="grid grid-cols-2 gap-2">
            <select name="channel" className={inputClass} defaultValue="Factory">
              <option>Factory</option>
              <option>Wholesale</option>
              <option>Retail</option>
              <option>Online</option>
            </select>
            <input name="sizeRun" className={inputClass} placeholder="Size run" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input name="stockPairs" type="number" min="0" className={inputClass} placeholder="Stock" />
            <input name="soldPairs" type="number" min="0" className={inputClass} placeholder="Sold" />
            <input name="returnedPairs" type="number" min="0" className={inputClass} placeholder="Return" />
          </div>
          <SubmitActionButton label="Add stock" />
        </form>

        <form action={createLedgerTransactionAction} className="grid gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
          <h3 className="font-black text-[#10231D]">Ledger transaction</h3>
          <select name="ledgerId" required className={inputClass} defaultValue="">
            <option value="" disabled>
              Select customer
            </option>
            {snapshot.customerLedgers.map((ledger) => (
              <option key={ledger.id} value={ledger.id}>
                {ledger.customerName}
              </option>
            ))}
          </select>
          <select name="type" className={inputClass} defaultValue="Cash Payment">
            <option>Cash Payment</option>
            <option>Cheque Payment</option>
            <option>Credit Sale</option>
            <option>Return Adjustment</option>
            <option>Manual Adjustment</option>
          </select>
          <input name="amount" type="number" min="1" required className={inputClass} placeholder="Amount" />
          <textarea name="note" className={textareaClass} placeholder="Bill number, cheque number, or remark" />
          <SubmitActionButton label="Record transaction" />
        </form>
      </div>
    </section>
  );
}
