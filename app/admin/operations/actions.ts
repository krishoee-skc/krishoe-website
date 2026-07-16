"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { syncProductCatalogStockWithFinishedStock } from "@/lib/product-store";
import { reportingErrors } from "@/lib/report-error";
import {
  addCustomerLedger,
  addFinishedStock,
  addLedgerTransaction,
  addMaterialConsumption,
  addProductionBatch,
  addRawMaterial,
  addStockMovement,
  addVehicleDispatch,
  addVehicleDispatchItem,
  addWorkerTask,
  deleteOperationRecord,
  updateCustomerLedger,
  updateFinishedStock,
  updateProductionBatch,
  updateProductionBatchStatus,
  updateRawMaterial,
  updateVehicleDispatch,
  updateVehicleDispatchStatus,
  updateWorkerTask,
  updateWorkerTaskStatus,
  type CustomerLedger,
  type FinishedStock,
  type LedgerTransaction,
  type OperationRecordKind,
  type ProductionBatch,
  type RawMaterial,
  type StockMovement,
  type VehicleDispatch,
  type VehicleDispatchItem,
  type WorkerTask,
} from "@/lib/operations";

const rawMaterialUnits: RawMaterial["unit"][] = ["kg", "meter", "pair", "piece", "liter"];
const batchStatuses: ProductionBatch["status"][] = ["Planning", "Cutting", "Making", "QC", "Packed"];
const dispatchStatuses: VehicleDispatch["status"][] = ["Loading", "In Market", "Returned", "Closed"];
const dispatchItemChannels: VehicleDispatchItem["channel"][] = ["Wholesale", "Retail", "Online"];
const workerStations: WorkerTask["station"][] = ["Cutting", "Stitching", "Sole Press", "Finishing", "Packing", "QC"];
const workerStatuses: WorkerTask["status"][] = ["Not Started", "In Progress", "Paused", "Done"];
const ledgerChannels: CustomerLedger["channel"][] = ["Wholesale", "Retail", "Online"];
const finishedStockChannels: FinishedStock["channel"][] = ["Factory", "Wholesale", "Retail", "Online"];
const stockChannels: StockMovement["channel"][] = ["Factory", "Wholesale", "Retail", "Online"];
const stockMovementTypes: StockMovement["type"][] = [
  "Production In",
  "Purchase In",
  "Dispatch Out",
  "Return In",
  "Sale Out",
  "Market Sale",
  "Adjustment",
];
const ledgerTransactionTypes: LedgerTransaction["type"][] = [
  "Cash Payment",
  "Cheque Payment",
  "Credit Sale",
  "Return Adjustment",
  "Manual Adjustment",
];
const operationRecordKinds: OperationRecordKind[] = [
  "rawMaterial",
  "materialConsumption",
  "workerTask",
  "productionBatch",
  "finishedStock",
  "vehicleDispatch",
  "vehicleDispatchItem",
  "customerLedger",
  "stockMovement",
  "ledgerTransaction",
];

// Deleting one of these changes how many pairs exist, so the catalog stock the
// shop reads has to be recomputed. The other kinds never touch finished stock.
const STOCK_BEARING_RECORD_KINDS: OperationRecordKind[] = [
  "finishedStock",
  "stockMovement",
  "vehicleDispatchItem",
];

// The shop reads products.stock, so pairs recorded here are not buyable until
// the catalog is recomputed. The record has already been written by the time
// this runs, so a failure is reported rather than thrown — throwing would show
// the admin an error for work that succeeded and invite a duplicate entry.
async function syncCatalogStock(what: string) {
  await reportingErrors(`sync catalog stock after ${what}`, () =>
    syncProductCatalogStockWithFinishedStock(),
  );
}

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(formData: FormData, key: string) {
  return Math.max(0, Math.round(Number(textValue(formData, key)) || 0));
}

function csvValue(formData: FormData, key: string) {
  return textValue(formData, key)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function optionValue<T extends string>(value: string, options: readonly T[], fallback: T) {
  return options.includes(value as T) ? (value as T) : fallback;
}

async function auditOperationsAction(action: string, detail: string) {
  await appendAdminAuditEvent(action, detail).catch(() => undefined);
}

function operationsReturnPath(formData: FormData) {
  const returnTo = textValue(formData, "returnTo");

  if (returnTo === "/admin/operations" || returnTo.startsWith("/admin/operations/ledger/")) {
    return returnTo;
  }

  return "/admin/operations";
}

function refreshOperationsPage(nextPath = "/admin/operations") {
  revalidatePath("/admin/operations");

  if (nextPath !== "/admin/operations") {
    revalidatePath(nextPath);
  }

  redirect(nextPath);
}

export async function createRawMaterialAction(formData: FormData) {
  await requireAdminPermission("operations:write");

  const name = textValue(formData, "name");

  if (!name) {
    throw new Error("Raw material name is required.");
  }

  await addRawMaterial({
    name,
    unit: optionValue(textValue(formData, "unit"), rawMaterialUnits, "kg"),
    openingStock: numberValue(formData, "openingStock"),
    received: numberValue(formData, "received"),
    reorderLevel: numberValue(formData, "reorderLevel"),
  });
  await auditOperationsAction("operations_create_raw_material", `Raw material ${name} created.`);

  refreshOperationsPage();
}

export async function createProductionBatchAction(formData: FormData) {
  await requireAdminPermission("operations:write");

  const design = textValue(formData, "design");

  if (!design) {
    throw new Error("Design name is required.");
  }

  await addProductionBatch({
    design,
    plannedPairs: numberValue(formData, "plannedPairs"),
    finishedPairs: numberValue(formData, "finishedPairs"),
    inProgressPairs: numberValue(formData, "inProgressPairs"),
    rejectedPairs: numberValue(formData, "rejectedPairs"),
    rawMaterialUsed: csvValue(formData, "rawMaterialUsed"),
    status: optionValue(textValue(formData, "status"), batchStatuses, "Planning"),
  });
  await auditOperationsAction("operations_create_production_batch", `Production batch ${design} created.`);

  refreshOperationsPage();
}

export async function createMaterialConsumptionAction(formData: FormData) {
  await requireAdminPermission("operations:write");

  const batchId = textValue(formData, "batchId");
  const materialId = textValue(formData, "materialId");
  const quantity = numberValue(formData, "quantity");
  const wastage = numberValue(formData, "wastage");

  if (!batchId || !materialId || quantity + wastage <= 0) {
    throw new Error("Production batch, raw material, and quantity or wastage are required.");
  }

  await addMaterialConsumption({
    batchId,
    materialId,
    quantity,
    wastage,
    note: textValue(formData, "note"),
  });
  await auditOperationsAction(
    "operations_create_material_consumption",
    `Batch ${batchId} material ${materialId}: ${quantity} used, ${wastage} wastage.`,
  );

  refreshOperationsPage();
}

export async function createVehicleDispatchAction(formData: FormData) {
  await requireAdminPermission("operations:write");

  const vehicleNumber = textValue(formData, "vehicleNumber");
  const driverName = textValue(formData, "driverName");

  if (!vehicleNumber || !driverName) {
    throw new Error("Vehicle number and driver name are required.");
  }

  await addVehicleDispatch({
    vehicleNumber,
    driverName,
    marketRoute: textValue(formData, "marketRoute"),
    loadedPairs: numberValue(formData, "loadedPairs"),
    returnedPairs: numberValue(formData, "returnedPairs"),
    cashCollected: numberValue(formData, "cashCollected"),
    chequeCollected: numberValue(formData, "chequeCollected"),
    creditAmount: numberValue(formData, "creditAmount"),
    status: optionValue(textValue(formData, "status"), dispatchStatuses, "Loading"),
  });
  await auditOperationsAction(
    "operations_create_vehicle_dispatch",
    `Vehicle dispatch ${vehicleNumber} for ${driverName} created.`,
  );

  refreshOperationsPage();
}

export async function createVehicleDispatchItemAction(formData: FormData) {
  await requireAdminPermission("operations:write");

  const dispatchId = textValue(formData, "dispatchId");
  const design = textValue(formData, "design");
  const loadedPairs = numberValue(formData, "loadedPairs");
  const soldPairs = numberValue(formData, "soldPairs");
  const returnedPairs = numberValue(formData, "returnedPairs");

  if (!dispatchId || !design || loadedPairs <= 0) {
    throw new Error("Vehicle dispatch, design, and loaded pair quantity are required.");
  }

  if (soldPairs + returnedPairs > loadedPairs) {
    throw new Error("Sold and returned pairs cannot be greater than loaded pairs.");
  }

  await addVehicleDispatchItem({
    dispatchId,
    design,
    channel: optionValue(textValue(formData, "channel"), dispatchItemChannels, "Wholesale"),
    sizeRun: textValue(formData, "sizeRun"),
    loadedPairs,
    soldPairs,
    returnedPairs,
    cashCollected: numberValue(formData, "cashCollected"),
    chequeCollected: numberValue(formData, "chequeCollected"),
    creditAmount: numberValue(formData, "creditAmount"),
    note: textValue(formData, "note"),
  });
  await syncCatalogStock(`dispatch ${dispatchId} item ${design}`);
  await auditOperationsAction(
    "operations_create_vehicle_dispatch_item",
    `Dispatch ${dispatchId} item ${design}: loaded ${loadedPairs}, sold ${soldPairs}, returned ${returnedPairs}.`,
  );

  refreshOperationsPage();
}

export async function createCustomerLedgerAction(formData: FormData) {
  await requireAdminPermission("operations:write");

  const customerName = textValue(formData, "customerName");

  if (!customerName) {
    throw new Error("Customer name is required.");
  }

  await addCustomerLedger({
    customerName,
    channel: optionValue(textValue(formData, "channel"), ledgerChannels, "Wholesale"),
    phone: textValue(formData, "phone"),
    cashPaid: numberValue(formData, "cashPaid"),
    chequePaid: numberValue(formData, "chequePaid"),
    creditGiven: numberValue(formData, "creditGiven"),
    balanceDue: numberValue(formData, "balanceDue"),
    creditLimit: numberValue(formData, "creditLimit"),
  });
  await auditOperationsAction("operations_create_customer_ledger", `Customer ledger ${customerName} created.`);

  refreshOperationsPage();
}

export async function createWorkerTaskAction(formData: FormData) {
  await requireAdminPermission("operations:write");

  const workerName = textValue(formData, "workerName");
  const batchId = textValue(formData, "batchId");
  const design = textValue(formData, "design");

  if (!workerName || (!batchId && !design)) {
    throw new Error("Worker name and production batch or design are required.");
  }

  await addWorkerTask({
    workerName,
    station: optionValue(textValue(formData, "station"), workerStations, "Cutting"),
    batchId,
    design,
    targetPairs: numberValue(formData, "targetPairs"),
    completedPairs: numberValue(formData, "completedPairs"),
    status: optionValue(textValue(formData, "status"), workerStatuses, "Not Started"),
    cameraZone: textValue(formData, "cameraZone"),
  });
  await auditOperationsAction(
    "operations_create_worker_task",
    `Worker task for ${workerName} on ${design || batchId} created.`,
  );

  refreshOperationsPage();
}

export async function createFinishedStockAction(formData: FormData) {
  await requireAdminPermission("operations:write");

  const design = textValue(formData, "design");

  if (!design) {
    throw new Error("Design name is required.");
  }

  await addFinishedStock({
    design,
    channel: optionValue(textValue(formData, "channel"), finishedStockChannels, "Factory"),
    sizeRun: textValue(formData, "sizeRun"),
    stockPairs: numberValue(formData, "stockPairs"),
    soldPairs: numberValue(formData, "soldPairs"),
    returnedPairs: numberValue(formData, "returnedPairs"),
  });
  await syncCatalogStock(`finished stock created for ${design}`);
  await auditOperationsAction("operations_create_finished_stock", `Finished stock ${design} created.`);

  refreshOperationsPage();
}

export async function updateRawMaterialAction(formData: FormData) {
  await requireAdminPermission("operations:write");

  const id = textValue(formData, "id");
  const name = textValue(formData, "name");

  if (!id || !name) {
    throw new Error("Raw material id and name are required.");
  }

  await updateRawMaterial(id, {
    name,
    unit: optionValue(textValue(formData, "unit"), rawMaterialUnits, "kg"),
    openingStock: numberValue(formData, "openingStock"),
    used: numberValue(formData, "used"),
    received: numberValue(formData, "received"),
    reorderLevel: numberValue(formData, "reorderLevel"),
  });
  await auditOperationsAction("operations_update_raw_material", `Raw material ${id} updated.`);

  refreshOperationsPage();
}

export async function updateWorkerTaskAction(formData: FormData) {
  await requireAdminPermission("operations:write");

  const id = textValue(formData, "id");
  const workerName = textValue(formData, "workerName");
  const batchId = textValue(formData, "batchId");
  const design = textValue(formData, "design");

  if (!id || !workerName || (!batchId && !design)) {
    throw new Error("Worker task id, worker name, and production batch or design are required.");
  }

  await updateWorkerTask(id, {
    workerName,
    station: optionValue(textValue(formData, "station"), workerStations, "Cutting"),
    batchId,
    design,
    targetPairs: numberValue(formData, "targetPairs"),
    completedPairs: numberValue(formData, "completedPairs"),
    status: optionValue(textValue(formData, "status"), workerStatuses, "Not Started"),
    cameraZone: textValue(formData, "cameraZone"),
  });
  await auditOperationsAction("operations_update_worker_task", `Worker task ${id} updated.`);

  refreshOperationsPage();
}

export async function updateFinishedStockAction(formData: FormData) {
  await requireAdminPermission("operations:write");

  const id = textValue(formData, "id");
  const design = textValue(formData, "design");

  if (!id || !design) {
    throw new Error("Finished stock id and design are required.");
  }

  await updateFinishedStock(id, {
    design,
    channel: optionValue(textValue(formData, "channel"), finishedStockChannels, "Factory"),
    sizeRun: textValue(formData, "sizeRun"),
    stockPairs: numberValue(formData, "stockPairs"),
    soldPairs: numberValue(formData, "soldPairs"),
    returnedPairs: numberValue(formData, "returnedPairs"),
  });
  await syncCatalogStock(`finished stock ${id} updated`);
  await auditOperationsAction("operations_update_finished_stock", `Finished stock ${id} updated.`);

  refreshOperationsPage();
}

export async function updateProductionBatchAction(formData: FormData) {
  await requireAdminPermission("operations:write");

  const id = textValue(formData, "id");
  const design = textValue(formData, "design");

  if (!id || !design) {
    throw new Error("Production batch id and design are required.");
  }

  await updateProductionBatch(id, {
    design,
    plannedPairs: numberValue(formData, "plannedPairs"),
    finishedPairs: numberValue(formData, "finishedPairs"),
    inProgressPairs: numberValue(formData, "inProgressPairs"),
    rejectedPairs: numberValue(formData, "rejectedPairs"),
    rawMaterialUsed: csvValue(formData, "rawMaterialUsed"),
    status: optionValue(textValue(formData, "status"), batchStatuses, "Planning"),
  });
  await auditOperationsAction("operations_update_production_batch", `Production batch ${id} updated.`);

  refreshOperationsPage();
}

export async function updateVehicleDispatchAction(formData: FormData) {
  await requireAdminPermission("operations:write");

  const id = textValue(formData, "id");
  const vehicleNumber = textValue(formData, "vehicleNumber");
  const driverName = textValue(formData, "driverName");

  if (!id || !vehicleNumber || !driverName) {
    throw new Error("Vehicle id, number, and driver name are required.");
  }

  await updateVehicleDispatch(id, {
    vehicleNumber,
    driverName,
    marketRoute: textValue(formData, "marketRoute"),
    loadedPairs: numberValue(formData, "loadedPairs"),
    returnedPairs: numberValue(formData, "returnedPairs"),
    cashCollected: numberValue(formData, "cashCollected"),
    chequeCollected: numberValue(formData, "chequeCollected"),
    creditAmount: numberValue(formData, "creditAmount"),
    status: optionValue(textValue(formData, "status"), dispatchStatuses, "Loading"),
  });
  await auditOperationsAction("operations_update_vehicle_dispatch", `Vehicle dispatch ${id} updated.`);

  refreshOperationsPage();
}

export async function updateCustomerLedgerAction(formData: FormData) {
  await requireAdminPermission("operations:write");

  const id = textValue(formData, "id");
  const customerName = textValue(formData, "customerName");

  if (!id || !customerName) {
    throw new Error("Ledger id and customer name are required.");
  }

  await updateCustomerLedger(id, {
    customerName,
    channel: optionValue(textValue(formData, "channel"), ledgerChannels, "Wholesale"),
    phone: textValue(formData, "phone"),
    cashPaid: numberValue(formData, "cashPaid"),
    chequePaid: numberValue(formData, "chequePaid"),
    creditGiven: numberValue(formData, "creditGiven"),
    balanceDue: numberValue(formData, "balanceDue"),
    creditLimit: numberValue(formData, "creditLimit"),
  });
  await auditOperationsAction("operations_update_customer_ledger", `Customer ledger ${id} updated.`);

  refreshOperationsPage(operationsReturnPath(formData));
}

export async function createStockMovementAction(formData: FormData) {
  await requireAdminPermission("operations:write");

  const design = textValue(formData, "design");
  const pairs = numberValue(formData, "pairs");

  if (!design) {
    throw new Error("Design name is required.");
  }

  if (pairs <= 0) {
    throw new Error("Stock movement pairs must be greater than zero.");
  }

  await addStockMovement({
    design,
    channel: optionValue(textValue(formData, "channel"), stockChannels, "Factory"),
    type: optionValue(textValue(formData, "type"), stockMovementTypes, "Production In"),
    pairs,
    note: textValue(formData, "note"),
  });
  await syncCatalogStock(`stock movement for ${design}`);
  await auditOperationsAction("operations_create_stock_movement", `Stock movement for ${design} created.`);

  refreshOperationsPage();
}

export async function createLedgerTransactionAction(formData: FormData) {
  await requireAdminPermission("operations:write");

  const ledgerId = textValue(formData, "ledgerId");
  const amount = numberValue(formData, "amount");

  if (!ledgerId || amount <= 0) {
    throw new Error("Customer ledger and positive amount are required.");
  }

  await addLedgerTransaction({
    ledgerId,
    type: optionValue(textValue(formData, "type"), ledgerTransactionTypes, "Cash Payment"),
    amount,
    note: textValue(formData, "note"),
  });
  await auditOperationsAction(
    "operations_create_ledger_transaction",
    `Ledger ${ledgerId} transaction recorded for Rs. ${amount}.`,
  );

  refreshOperationsPage(operationsReturnPath(formData));
}

export async function updateProductionBatchStatusAction(formData: FormData) {
  await requireAdminPermission("operations:write");

  const id = textValue(formData, "id");
  const status = optionValue(textValue(formData, "status"), batchStatuses, "Planning");

  await updateProductionBatchStatus(id, status);
  await auditOperationsAction("operations_update_production_status", `Production batch ${id} marked ${status}.`);

  refreshOperationsPage();
}

export async function updateVehicleDispatchStatusAction(formData: FormData) {
  await requireAdminPermission("operations:write");

  const id = textValue(formData, "id");
  const status = optionValue(textValue(formData, "status"), dispatchStatuses, "Loading");

  await updateVehicleDispatchStatus(id, status);
  await auditOperationsAction("operations_update_dispatch_status", `Vehicle dispatch ${id} marked ${status}.`);

  refreshOperationsPage();
}

export async function updateWorkerTaskStatusAction(formData: FormData) {
  await requireAdminPermission("operations:write");

  const id = textValue(formData, "id");
  const status = optionValue(textValue(formData, "status"), workerStatuses, "Not Started");

  await updateWorkerTaskStatus(id, status);
  await auditOperationsAction("operations_update_worker_status", `Worker task ${id} marked ${status}.`);

  refreshOperationsPage();
}

export async function deleteOperationRecordAction(formData: FormData) {
  await requireAdminPermission("operations:write");

  const id = textValue(formData, "id");
  const kind = optionValue(textValue(formData, "kind"), operationRecordKinds, "rawMaterial");

  if (!id) {
    throw new Error("Record id is required.");
  }

  await deleteOperationRecord(kind, id);

  if (STOCK_BEARING_RECORD_KINDS.includes(kind)) {
    await syncCatalogStock(`${kind} ${id} deleted`);
  }

  await auditOperationsAction("operations_delete_record", `${kind} ${id} deleted.`);
  refreshOperationsPage(operationsReturnPath(formData));
}
