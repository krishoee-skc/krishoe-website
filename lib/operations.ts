import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { runWithDataBackend } from "@/lib/data-backend";
import { getPaymentTransactionsByLedgerId } from "@/lib/payment-transactions";
import {
  addCustomerLedgerToPostgres,
  addFinishedStockToPostgres,
  addLedgerTransactionToPostgres,
  addMaterialConsumptionToPostgres,
  addProductionBatchToPostgres,
  addRawMaterialReceiptToPostgres,
  addRawMaterialToPostgres,
  addStockMovementToPostgres,
  addVehicleDispatchToPostgres,
  addVehicleDispatchItemToPostgres,
  addWorkerTaskToPostgres,
  deleteOperationRecordFromPostgres,
  getOperationsDataFromPostgres,
  updateCustomerLedgerToPostgres,
  updateFinishedStockToPostgres,
  updateProductionBatchStatusToPostgres,
  updateProductionBatchToPostgres,
  updateRawMaterialToPostgres,
  updateVehicleDispatchStatusToPostgres,
  updateVehicleDispatchToPostgres,
  updateWorkerTaskStatusToPostgres,
  updateWorkerTaskToPostgres,
} from "@/lib/operations-postgres";

export type BusinessChannel = "Factory" | "Wholesale" | "Retail" | "Online";

export type RawMaterial = {
  id: string;
  name: string;
  unit: "kg" | "meter" | "pair" | "piece" | "liter";
  openingStock: number;
  used: number;
  received: number;
  reorderLevel: number;
};

export type WorkerTask = {
  id: string;
  workerName: string;
  station: "Cutting" | "Stitching" | "Sole Press" | "Finishing" | "Packing" | "QC";
  batchId: string;
  design: string;
  targetPairs: number;
  completedPairs: number;
  status: "Not Started" | "In Progress" | "Paused" | "Done";
  cameraZone: string;
};

export type ProductionBatch = {
  id: string;
  design: string;
  plannedPairs: number;
  finishedPairs: number;
  inProgressPairs: number;
  rejectedPairs: number;
  rawMaterialUsed: string[];
  status: "Planning" | "Cutting" | "Making" | "QC" | "Packed";
};

export type MaterialConsumption = {
  id: string;
  createdAt: string;
  batchId: string;
  batchDesign: string;
  materialId: string;
  materialName: string;
  unit: RawMaterial["unit"];
  quantity: number;
  wastage: number;
  note: string;
};

export type FinishedStock = {
  id: string;
  design: string;
  channel: BusinessChannel;
  sizeRun: string;
  stockPairs: number;
  soldPairs: number;
  returnedPairs: number;
};

export type VehicleDispatch = {
  id: string;
  vehicleNumber: string;
  driverName: string;
  marketRoute: string;
  loadedPairs: number;
  returnedPairs: number;
  cashCollected: number;
  chequeCollected: number;
  creditAmount: number;
  status: "Loading" | "In Market" | "Returned" | "Closed";
};

export type VehicleDispatchItem = {
  id: string;
  createdAt: string;
  dispatchId: string;
  vehicleNumber: string;
  marketRoute: string;
  design: string;
  channel: Exclude<BusinessChannel, "Factory">;
  sizeRun: string;
  loadedPairs: number;
  soldPairs: number;
  returnedPairs: number;
  cashCollected: number;
  chequeCollected: number;
  creditAmount: number;
  stockMovementIds: string[];
  note: string;
};

export type CustomerLedger = {
  id: string;
  customerName: string;
  channel: Exclude<BusinessChannel, "Factory">;
  phone: string;
  cashPaid: number;
  chequePaid: number;
  creditGiven: number;
  balanceDue: number;
  // Maximum outstanding credit allowed for this customer (wholesale/B2B).
  // 0 means no limit. Credit/partial POS sales are blocked past this.
  creditLimit: number;
  lastTransaction: string;
};

export type StockMovementType =
  | "Production In"
  | "Dispatch Out"
  | "Return In"
  | "Sale Out"
  | "Market Sale"
  | "Adjustment";

export type StockMovement = {
  id: string;
  createdAt: string;
  design: string;
  channel: BusinessChannel;
  // Size run the movement applies to. "Mixed" means it isn't size-specific and
  // targets the aggregate/range stock row (backward-compatible default).
  sizeRun: string;
  type: StockMovementType;
  pairs: number;
  note: string;
};

// Movement input: callers may omit sizeRun (defaults to "Mixed"), so existing
// production/dispatch/adjustment call sites keep working unchanged.
export type StockMovementInput = Omit<StockMovement, "id" | "createdAt" | "sizeRun"> & {
  sizeRun?: string;
};

export type LedgerTransactionType =
  | "Cash Payment"
  | "Cheque Payment"
  | "Credit Sale"
  | "Return Adjustment"
  | "Manual Adjustment";

export type LedgerTransaction = {
  id: string;
  createdAt: string;
  ledgerId: string;
  customerName: string;
  type: LedgerTransactionType;
  amount: number;
  note: string;
};

export type OperationRecordKind =
  | "rawMaterial"
  | "materialConsumption"
  | "workerTask"
  | "productionBatch"
  | "finishedStock"
  | "vehicleDispatch"
  | "vehicleDispatchItem"
  | "customerLedger"
  | "stockMovement"
  | "ledgerTransaction";

export type OperationsData = {
  rawMaterials: RawMaterial[];
  materialConsumptions: MaterialConsumption[];
  workerTasks: WorkerTask[];
  productionBatches: ProductionBatch[];
  finishedStock: FinishedStock[];
  vehicleDispatches: VehicleDispatch[];
  vehicleDispatchItems: VehicleDispatchItem[];
  customerLedgers: CustomerLedger[];
  stockMovements: StockMovement[];
  ledgerTransactions: LedgerTransaction[];
};

type StockHealthSignal = "Out of stock" | "Low stock" | "Return watch" | "Healthy";
type StockLedgerSignal = "Balanced" | "Variance" | "No movement" | "Watch";
type LedgerCollectionPriority = "Urgent" | "High" | "Medium" | "Monitor" | "Clear";

const dataDirectory = path.join(process.cwd(), "data");
const operationsPath = path.join(dataDirectory, "operations.json");

const seedOperations: OperationsData = {
  rawMaterials: [
    { id: "rm-eva", name: "EVA Sheet", unit: "kg", openingStock: 520, used: 180, received: 80, reorderLevel: 180 },
    { id: "rm-sole", name: "PVC Sole", unit: "pair", openingStock: 2200, used: 940, received: 400, reorderLevel: 700 },
    { id: "rm-strap", name: "Synthetic Strap", unit: "meter", openingStock: 1800, used: 650, received: 300, reorderLevel: 500 },
    { id: "rm-glue", name: "Industrial Glue", unit: "liter", openingStock: 95, used: 44, received: 20, reorderLevel: 40 },
  ],
  materialConsumptions: [],
  workerTasks: [
    {
      id: "task-cut-01",
      workerName: "Ramesh BK",
      station: "Cutting",
      batchId: "batch-20260711-01",
      design: "Cloud Step Slippers",
      targetPairs: 320,
      completedPairs: 240,
      status: "In Progress",
      cameraZone: "Camera A - Cutting Table",
    },
    {
      id: "task-sole-01",
      workerName: "Suman Tamang",
      station: "Sole Press",
      batchId: "batch-20260711-02",
      design: "Signature Ladies Sandals",
      targetPairs: 260,
      completedPairs: 260,
      status: "Done",
      cameraZone: "Camera C - Press Line",
    },
    {
      id: "task-pack-01",
      workerName: "Mina Rai",
      station: "Packing",
      batchId: "batch-20260711-03",
      design: "Kids Daily Runner",
      targetPairs: 180,
      completedPairs: 96,
      status: "In Progress",
      cameraZone: "Camera F - Packing",
    },
  ],
  productionBatches: [
    {
      id: "batch-20260711-01",
      design: "Cloud Step Slippers",
      plannedPairs: 500,
      finishedPairs: 260,
      inProgressPairs: 180,
      rejectedPairs: 12,
      rawMaterialUsed: ["EVA Sheet", "Synthetic Strap", "Industrial Glue"],
      status: "Making",
    },
    {
      id: "batch-20260711-02",
      design: "Signature Ladies Sandals",
      plannedPairs: 360,
      finishedPairs: 310,
      inProgressPairs: 35,
      rejectedPairs: 8,
      rawMaterialUsed: ["PVC Sole", "Synthetic Strap", "Industrial Glue"],
      status: "QC",
    },
    {
      id: "batch-20260711-03",
      design: "Kids Daily Runner",
      plannedPairs: 240,
      finishedPairs: 120,
      inProgressPairs: 90,
      rejectedPairs: 5,
      rawMaterialUsed: ["PVC Sole", "EVA Sheet"],
      status: "Packed",
    },
  ],
  finishedStock: [
    { id: "stock-wholesale-slipper", design: "Cloud Step Slippers", channel: "Wholesale", sizeRun: "36-41", stockPairs: 480, soldPairs: 720, returnedPairs: 36 },
    { id: "stock-retail-sandal", design: "Signature Ladies Sandals", channel: "Retail", sizeRun: "36-40", stockPairs: 210, soldPairs: 540, returnedPairs: 18 },
    { id: "stock-online-runner", design: "Kids Daily Runner", channel: "Online", sizeRun: "28-34", stockPairs: 95, soldPairs: 160, returnedPairs: 12 },
  ],
  vehicleDispatches: [
    {
      id: "trip-ktm-01",
      vehicleNumber: "Ba 12 Cha 4455",
      driverName: "Bikash Shrestha",
      marketRoute: "Kathmandu wholesale line",
      loadedPairs: 620,
      returnedPairs: 42,
      cashCollected: 185000,
      chequeCollected: 96000,
      creditAmount: 142000,
      status: "Returned",
    },
    {
      id: "trip-bkt-01",
      vehicleNumber: "Pr 3-01-002 Kha 1180",
      driverName: "Nabin Lama",
      marketRoute: "Bhaktapur retail route",
      loadedPairs: 280,
      returnedPairs: 0,
      cashCollected: 76000,
      chequeCollected: 0,
      creditAmount: 53000,
      status: "In Market",
    },
  ],
  vehicleDispatchItems: [],
  customerLedgers: [
    { id: "ledger-shoes-palace", customerName: "Shoes Palace Wholesale", channel: "Wholesale", phone: "9800000001", cashPaid: 125000, chequePaid: 96000, creditGiven: 180000, balanceDue: 84000, creditLimit: 150000, lastTransaction: "2026-07-11" },
    { id: "ledger-city-footwear", customerName: "City Footwear Retail", channel: "Retail", phone: "9800000002", cashPaid: 64000, chequePaid: 0, creditGiven: 42000, balanceDue: 18000, creditLimit: 0, lastTransaction: "2026-07-10" },
    { id: "ledger-online-cod", customerName: "Online COD Customers", channel: "Online", phone: "Online", cashPaid: 38000, chequePaid: 0, creditGiven: 0, balanceDue: 0, creditLimit: 0, lastTransaction: "2026-07-11" },
  ],
  stockMovements: [],
  ledgerTransactions: [],
};

function createId(prefix: string) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `${prefix}-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function cleanNumber(value: number) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function datePlusDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function sum<T>(items: T[], getValue: (item: T) => number) {
  return items.reduce((total, item) => total + getValue(item), 0);
}

function materialBalance(material: RawMaterial) {
  return material.openingStock + material.received - material.used;
}

function sameDesign(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function stockKey(value: Pick<FinishedStock, "design" | "channel">) {
  return `${value.design.trim().toLowerCase()}::${value.channel}`;
}

function isStockOutMovement(type: StockMovementType) {
  return type === "Dispatch Out" || type === "Sale Out";
}

function assertStockAvailable(
  stock: FinishedStock,
  movement: Pick<StockMovement, "type" | "pairs">,
  action = movement.type,
) {
  if (movement.pairs > stock.stockPairs) {
    throw new Error(
      `${stock.design} ${stock.channel} has only ${stock.stockPairs} pairs. Cannot ${action} ${movement.pairs} pairs.`,
    );
  }
}

function percentage(part: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((part / total) * 100);
}

function daysSince(dateValue: string) {
  const time = new Date(dateValue).getTime();

  if (!Number.isFinite(time)) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
}

function emptyStockMovementTotals(): Record<StockMovementType, number> {
  return {
    "Production In": 0,
    "Dispatch Out": 0,
    "Return In": 0,
    "Sale Out": 0,
    "Market Sale": 0,
    Adjustment: 0,
  };
}

function emptyLedgerTransactionTotals(): Record<LedgerTransactionType, number> {
  return {
    "Cash Payment": 0,
    "Cheque Payment": 0,
    "Credit Sale": 0,
    "Return Adjustment": 0,
    "Manual Adjustment": 0,
  };
}

function emptyChannelTotals(): Record<
  BusinessChannel,
  { stockPairs: number; soldPairs: number; returnedPairs: number }
> {
  return {
    Factory: { stockPairs: 0, soldPairs: 0, returnedPairs: 0 },
    Wholesale: { stockPairs: 0, soldPairs: 0, returnedPairs: 0 },
    Retail: { stockPairs: 0, soldPairs: 0, returnedPairs: 0 },
    Online: { stockPairs: 0, soldPairs: 0, returnedPairs: 0 },
  };
}

function stockHealthSignal(stock: FinishedStock, returnRate: number): StockHealthSignal {
  if (stock.stockPairs <= 0) {
    return "Out of stock";
  }

  if (stock.stockPairs <= Math.max(10, Math.ceil(stock.soldPairs * 0.1))) {
    return "Low stock";
  }

  if (returnRate >= 20) {
    return "Return watch";
  }

  return "Healthy";
}

function stockLedgerSignal({
  movementCount,
  variancePairs,
  healthSignal,
}: {
  movementCount: number;
  variancePairs: number;
  healthSignal: StockHealthSignal;
}): StockLedgerSignal {
  if (movementCount === 0) {
    return "No movement";
  }

  if (variancePairs !== 0) {
    return "Variance";
  }

  if (healthSignal !== "Healthy") {
    return "Watch";
  }

  return "Balanced";
}

function stockLedgerNextAction(signal: StockLedgerSignal) {
  if (signal === "No movement") {
    return "Record opening adjustment or import historical movement trail.";
  }

  if (signal === "Variance") {
    return "Review movement history before stock closing.";
  }

  if (signal === "Watch") {
    return "Plan replenishment, QC review, or return follow-up.";
  }

  return "Ledger matches movement trail.";
}

function ledgerCollectionPriority({
  balanceDue,
  daysOutstanding,
  collectionCoverageRate,
}: {
  balanceDue: number;
  daysOutstanding: number;
  collectionCoverageRate: number;
}): LedgerCollectionPriority {
  if (balanceDue <= 0) {
    return "Clear";
  }

  if (daysOutstanding > 60 || balanceDue >= 100000) {
    return "Urgent";
  }

  if (daysOutstanding > 30 || collectionCoverageRate < 50) {
    return "High";
  }

  if (daysOutstanding > 14 || balanceDue >= 25000) {
    return "Medium";
  }

  return "Monitor";
}

function ledgerCollectionNextAction(priority: LedgerCollectionPriority) {
  if (priority === "Urgent") {
    return "Call today, confirm payment date, and stop extra credit until collected.";
  }

  if (priority === "High") {
    return "Send reminder and collect partial payment within three days.";
  }

  if (priority === "Medium") {
    return "Schedule collection follow-up within this week.";
  }

  if (priority === "Monitor") {
    return "Keep in normal route follow-up.";
  }

  return "No collection follow-up needed.";
}

function ledgerFollowUpDueDate(priority: LedgerCollectionPriority) {
  if (priority === "Urgent") {
    return today();
  }

  if (priority === "High") {
    return datePlusDays(3);
  }

  if (priority === "Medium") {
    return datePlusDays(7);
  }

  if (priority === "Monitor") {
    return datePlusDays(14);
  }

  return "";
}

function normalizeOperationsData(data: Partial<OperationsData>): OperationsData {
  return {
    rawMaterials: (data.rawMaterials ?? seedOperations.rawMaterials).map((material) => ({ ...material })),
    materialConsumptions: (data.materialConsumptions ?? seedOperations.materialConsumptions).map(
      (consumption) => ({ ...consumption }),
    ),
    workerTasks: (data.workerTasks ?? seedOperations.workerTasks).map((task) => ({
      ...task,
      batchId:
        typeof (task as { batchId?: unknown }).batchId === "string"
          ? (task as { batchId: string }).batchId
          : "",
    })),
    productionBatches: (data.productionBatches ?? seedOperations.productionBatches).map((batch) => ({
      ...batch,
      rawMaterialUsed: Array.isArray(batch.rawMaterialUsed) ? [...batch.rawMaterialUsed] : [],
    })),
    finishedStock: (data.finishedStock ?? seedOperations.finishedStock).map((stock) => ({ ...stock })),
    vehicleDispatches: (data.vehicleDispatches ?? seedOperations.vehicleDispatches).map((dispatch) => ({ ...dispatch })),
    vehicleDispatchItems: (data.vehicleDispatchItems ?? seedOperations.vehicleDispatchItems).map((item) => ({
      ...item,
      stockMovementIds: Array.isArray((item as { stockMovementIds?: unknown }).stockMovementIds)
        ? [...(item as { stockMovementIds: string[] }).stockMovementIds]
        : [],
    })),
    customerLedgers: (data.customerLedgers ?? seedOperations.customerLedgers).map((ledger) => ({ ...ledger, creditLimit: cleanNumber(ledger.creditLimit) })),
    stockMovements: (data.stockMovements ?? seedOperations.stockMovements).map((movement) => ({ ...movement })),
    ledgerTransactions: (data.ledgerTransactions ?? seedOperations.ledgerTransactions).map((transaction) => ({
      ...transaction,
    })),
  };
}

async function writeOperationsData(data: OperationsData) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(operationsPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function getOperationsDataFromLocalJson(): Promise<OperationsData> {
  try {
    const content = await readFile(operationsPath, "utf8");
    const parsed = JSON.parse(content) as Partial<OperationsData>;

    return normalizeOperationsData(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return normalizeOperationsData(seedOperations);
    }

    throw error;
  }
}

function createStockMovementRecord(movement: StockMovementInput): StockMovement {
  return {
    ...movement,
    id: createId("MOVE"),
    createdAt: new Date().toISOString(),
    design: movement.design.trim(),
    sizeRun: (movement.sizeRun ?? "").trim() || "Mixed",
    pairs: cleanNumber(movement.pairs),
    note: movement.note.trim(),
  };
}

function findOrCreateFinishedStock(
  data: OperationsData,
  movement: Pick<StockMovement, "design" | "channel" | "sizeRun">,
) {
  const matchingStock = data.finishedStock.filter((stock) => stockKey(stock) === stockKey(movement));
  // Prefer an exact size-run row, then the aggregate "Mixed" row, then any row
  // for this design/channel (this is what keeps range-based stock working).
  const existingStock =
    matchingStock.find((stock) => sameDesign(stock.sizeRun, movement.sizeRun)) ??
    matchingStock.find((stock) => sameDesign(stock.sizeRun, "Mixed")) ??
    matchingStock.find((stock) => stock.sizeRun.includes("-")) ??
    matchingStock[0];

  if (existingStock) {
    return existingStock;
  }

  const stock: FinishedStock = {
    id: createId("STOCK"),
    design: movement.design,
    channel: movement.channel,
    sizeRun: movement.sizeRun.trim() || "Mixed",
    stockPairs: 0,
    soldPairs: 0,
    returnedPairs: 0,
  };

  data.finishedStock.unshift(stock);
  return stock;
}

function applyStockMovementToStock(stock: FinishedStock, movement: Pick<StockMovement, "type" | "pairs">) {
  if (movement.pairs <= 0) {
    throw new Error("Stock movement pairs must be greater than zero.");
  }

  if (isStockOutMovement(movement.type)) {
    assertStockAvailable(stock, movement);
  }

  if (movement.type === "Production In" || movement.type === "Adjustment") {
    stock.stockPairs += movement.pairs;
  }

  if (movement.type === "Dispatch Out") {
    stock.stockPairs -= movement.pairs;
  }

  if (movement.type === "Sale Out") {
    stock.stockPairs -= movement.pairs;
    stock.soldPairs += movement.pairs;
  }

  if (movement.type === "Market Sale") {
    stock.soldPairs += movement.pairs;
  }

  if (movement.type === "Return In") {
    stock.stockPairs += movement.pairs;
    stock.returnedPairs += movement.pairs;
  }
}

function reverseStockMovementFromStock(stock: FinishedStock, movement: Pick<StockMovement, "type" | "pairs">) {
  if (
    (movement.type === "Production In" || movement.type === "Adjustment" || movement.type === "Return In") &&
    movement.pairs > stock.stockPairs
  ) {
    throw new Error(
      `${stock.design} ${stock.channel} stock depends on this movement. Add stock back before deleting it.`,
    );
  }

  if (movement.type === "Production In" || movement.type === "Adjustment") {
    stock.stockPairs -= movement.pairs;
  }

  if (movement.type === "Dispatch Out") {
    stock.stockPairs += movement.pairs;
  }

  if (movement.type === "Sale Out") {
    stock.stockPairs += movement.pairs;
    stock.soldPairs = Math.max(0, stock.soldPairs - movement.pairs);
  }

  if (movement.type === "Market Sale") {
    stock.soldPairs = Math.max(0, stock.soldPairs - movement.pairs);
  }

  if (movement.type === "Return In") {
    stock.stockPairs -= movement.pairs;
    stock.returnedPairs = Math.max(0, stock.returnedPairs - movement.pairs);
  }
}

function addStockMovementToLocalData(data: OperationsData, movement: StockMovement) {
  const stock = findOrCreateFinishedStock(data, movement);
  applyStockMovementToStock(stock, movement);
  data.stockMovements.unshift(movement);
}

function deleteStockMovementFromLocalData(data: OperationsData, id: string) {
  const movement = data.stockMovements.find((item) => item.id === id);

  if (movement) {
    const stock = data.finishedStock.find(
      (item) =>
        item.design.toLowerCase() === movement.design.toLowerCase() &&
        item.channel === movement.channel,
    );

    if (stock) {
      reverseStockMovementFromStock(stock, movement);
    }
  }

  data.vehicleDispatchItems = data.vehicleDispatchItems.map((item) => ({
    ...item,
    stockMovementIds: item.stockMovementIds.filter((movementId) => movementId !== id),
  }));
  data.stockMovements = data.stockMovements.filter((movement) => movement.id !== id);
}

function dispatchItemStockMovements(
  item: Pick<
    VehicleDispatchItem,
    "id" | "vehicleNumber" | "marketRoute" | "design" | "channel" | "sizeRun" | "loadedPairs" | "soldPairs" | "returnedPairs"
  >,
): Array<StockMovementInput> {
  const notePrefix = `Dispatch ${item.vehicleNumber} ${item.marketRoute} item ${item.id}`.trim();
  const movements: Array<StockMovementInput> = [];

  if (item.loadedPairs > 0) {
    movements.push({
      design: item.design,
      channel: item.channel,
      sizeRun: item.sizeRun,
      type: "Dispatch Out",
      pairs: item.loadedPairs,
      note: `${notePrefix} loaded`,
    });
  }

  if (item.returnedPairs > 0) {
    movements.push({
      design: item.design,
      channel: item.channel,
      sizeRun: item.sizeRun,
      type: "Return In",
      pairs: item.returnedPairs,
      note: `${notePrefix} returned`,
    });
  }

  if (item.soldPairs > 0) {
    movements.push({
      design: item.design,
      channel: item.channel,
      sizeRun: item.sizeRun,
      type: "Market Sale",
      pairs: item.soldPairs,
      note: `${notePrefix} sold`,
    });
  }

  return movements;
}

function deleteDispatchItemStockMovementsFromLocalData(data: OperationsData, item: VehicleDispatchItem) {
  for (const movementId of item.stockMovementIds) {
    deleteStockMovementFromLocalData(data, movementId);
  }
}

export async function getOperationsData(): Promise<OperationsData> {
  return runWithDataBackend({
    storeName: "operations",
    localJson: getOperationsDataFromLocalJson,
    postgres: getOperationsDataFromPostgres,
  });
}

export async function addRawMaterial(material: Omit<RawMaterial, "id" | "used">) {
  const record: RawMaterial = {
    ...material,
    id: createId("RM"),
    openingStock: cleanNumber(material.openingStock),
    received: cleanNumber(material.received),
    used: 0,
    reorderLevel: cleanNumber(material.reorderLevel),
  };

  return runWithDataBackend({
    storeName: "operations",
    localJson: async () => {
      const data = await getOperationsDataFromLocalJson();
      data.rawMaterials.unshift(record);
      await writeOperationsData(data);
      return record;
    },
    postgres: () => addRawMaterialToPostgres(material),
  });
}

export async function addRawMaterialReceipt(input: { materialId: string; quantity: number }) {
  const quantity = cleanNumber(input.quantity);

  if (!input.materialId || quantity <= 0) {
    throw new Error("Raw material and positive receipt quantity are required.");
  }

  return runWithDataBackend({
    storeName: "operations",
    localJson: async () => {
      const data = await getOperationsDataFromLocalJson();
      const material = data.rawMaterials.find((item) => item.id === input.materialId);

      if (!material) {
        throw new Error("Raw material was not found.");
      }

      material.received += quantity;
      await writeOperationsData(data);
      return material;
    },
    postgres: () => addRawMaterialReceiptToPostgres({ materialId: input.materialId, quantity }),
  });
}

export async function addProductionBatch(batch: Omit<ProductionBatch, "id">) {
  const record: ProductionBatch = {
    ...batch,
    id: createId("BATCH"),
    plannedPairs: cleanNumber(batch.plannedPairs),
    finishedPairs: cleanNumber(batch.finishedPairs),
    inProgressPairs: cleanNumber(batch.inProgressPairs),
    rejectedPairs: cleanNumber(batch.rejectedPairs),
  };

  return runWithDataBackend({
    storeName: "operations",
    localJson: async () => {
      const data = await getOperationsDataFromLocalJson();
      data.productionBatches.unshift(record);
      await writeOperationsData(data);
      return record;
    },
    postgres: () => addProductionBatchToPostgres(batch),
  });
}

export async function addMaterialConsumption(input: {
  batchId: string;
  materialId: string;
  quantity: number;
  wastage: number;
  note: string;
}) {
  return runWithDataBackend({
    storeName: "operations",
    localJson: async () => {
      const data = await getOperationsDataFromLocalJson();
      const batch = data.productionBatches.find((item) => item.id === input.batchId);
      const material = data.rawMaterials.find((item) => item.id === input.materialId);

      if (!batch) {
        throw new Error("Production batch was not found.");
      }

      if (!material) {
        throw new Error("Raw material was not found.");
      }

      const quantity = cleanNumber(input.quantity);
      const wastage = cleanNumber(input.wastage);

      if (quantity + wastage <= 0) {
        throw new Error("Material consumption quantity or wastage is required.");
      }

      const record: MaterialConsumption = {
        id: createId("USE"),
        createdAt: new Date().toISOString(),
        batchId: batch.id,
        batchDesign: batch.design,
        materialId: material.id,
        materialName: material.name,
        unit: material.unit,
        quantity,
        wastage,
        note: input.note.trim(),
      };

      material.used += quantity + wastage;

      if (!batch.rawMaterialUsed.some((name) => sameDesign(name, material.name))) {
        batch.rawMaterialUsed.push(material.name);
      }

      data.materialConsumptions.unshift(record);
      await writeOperationsData(data);
      return record;
    },
    postgres: () => addMaterialConsumptionToPostgres(input),
  });
}

export async function addWorkerTask(task: Omit<WorkerTask, "id">) {
  return runWithDataBackend({
    storeName: "operations",
    localJson: async () => {
      const data = await getOperationsDataFromLocalJson();
      const batchId = task.batchId.trim();
      const linkedBatch = batchId
        ? data.productionBatches.find((batch) => batch.id === batchId)
        : null;

      if (batchId && !linkedBatch) {
        throw new Error("Production batch was not found.");
      }

      const design = (linkedBatch?.design ?? task.design).trim();

      if (!design) {
        throw new Error("Design name is required.");
      }

      const record: WorkerTask = {
        ...task,
        id: createId("TASK"),
        batchId: linkedBatch?.id ?? "",
        workerName: task.workerName.trim(),
        design,
        targetPairs: cleanNumber(task.targetPairs),
        completedPairs: cleanNumber(task.completedPairs),
        cameraZone: task.cameraZone.trim(),
      };

      data.workerTasks.unshift(record);
      await writeOperationsData(data);
      return record;
    },
    postgres: () => addWorkerTaskToPostgres(task),
  });
}

export async function addFinishedStock(stock: Omit<FinishedStock, "id">) {
  const record: FinishedStock = {
    ...stock,
    id: createId("STOCK"),
    design: stock.design.trim(),
    sizeRun: stock.sizeRun.trim() || "Mixed",
    stockPairs: cleanNumber(stock.stockPairs),
    soldPairs: cleanNumber(stock.soldPairs),
    returnedPairs: cleanNumber(stock.returnedPairs),
  };

  return runWithDataBackend({
    storeName: "operations",
    localJson: async () => {
      const data = await getOperationsDataFromLocalJson();
      const existingStock = data.finishedStock.find(
        (item) =>
          stockKey(item) === stockKey(record) &&
          sameDesign(item.sizeRun, record.sizeRun),
      );

      if (existingStock) {
        existingStock.design = record.design;
        existingStock.channel = record.channel;
        existingStock.sizeRun = record.sizeRun;
        existingStock.stockPairs = record.stockPairs;
        existingStock.soldPairs = record.soldPairs;
        existingStock.returnedPairs = record.returnedPairs;
        await writeOperationsData(data);
        return existingStock;
      }

      data.finishedStock.unshift(record);
      await writeOperationsData(data);
      return record;
    },
    postgres: () => addFinishedStockToPostgres(stock),
  });
}

export async function addVehicleDispatch(dispatch: Omit<VehicleDispatch, "id">) {
  const record: VehicleDispatch = {
    ...dispatch,
    id: createId("TRIP"),
    loadedPairs: cleanNumber(dispatch.loadedPairs),
    returnedPairs: cleanNumber(dispatch.returnedPairs),
    cashCollected: cleanNumber(dispatch.cashCollected),
    chequeCollected: cleanNumber(dispatch.chequeCollected),
    creditAmount: cleanNumber(dispatch.creditAmount),
  };

  return runWithDataBackend({
    storeName: "operations",
    localJson: async () => {
      const data = await getOperationsDataFromLocalJson();
      data.vehicleDispatches.unshift(record);
      await writeOperationsData(data);
      return record;
    },
    postgres: () => addVehicleDispatchToPostgres(dispatch),
  });
}

export async function addVehicleDispatchItem(item: Omit<
  VehicleDispatchItem,
  "id" | "createdAt" | "vehicleNumber" | "marketRoute" | "stockMovementIds"
>) {
  return runWithDataBackend({
    storeName: "operations",
    localJson: async () => {
      const data = await getOperationsDataFromLocalJson();
      const dispatch = data.vehicleDispatches.find((entry) => entry.id === item.dispatchId);

      if (!dispatch) {
        throw new Error("Vehicle dispatch was not found.");
      }

      const loadedPairs = cleanNumber(item.loadedPairs);
      const soldPairs = cleanNumber(item.soldPairs);
      const returnedPairs = cleanNumber(item.returnedPairs);
      const cashCollected = cleanNumber(item.cashCollected);
      const chequeCollected = cleanNumber(item.chequeCollected);
      const creditAmount = cleanNumber(item.creditAmount);

      if (!item.design.trim() || loadedPairs <= 0) {
        throw new Error("Dispatch item design and loaded pair quantity are required.");
      }

      if (soldPairs + returnedPairs > loadedPairs) {
        throw new Error("Sold and returned pairs cannot be greater than loaded pairs.");
      }

      const record: VehicleDispatchItem = {
        ...item,
        id: createId("TRIPITEM"),
        createdAt: new Date().toISOString(),
        vehicleNumber: dispatch.vehicleNumber,
        marketRoute: dispatch.marketRoute,
        design: item.design.trim(),
        sizeRun: item.sizeRun.trim() || "Mixed",
        loadedPairs,
        soldPairs,
        returnedPairs,
        cashCollected,
        chequeCollected,
        creditAmount,
        stockMovementIds: [],
        note: item.note.trim(),
      };

      const stockMovements = dispatchItemStockMovements(record).map(createStockMovementRecord);
      record.stockMovementIds = stockMovements.map((movement) => movement.id);

      dispatch.loadedPairs += loadedPairs;
      dispatch.returnedPairs += returnedPairs;
      dispatch.cashCollected += cashCollected;
      dispatch.chequeCollected += chequeCollected;
      dispatch.creditAmount += creditAmount;

      for (const movement of stockMovements) {
        addStockMovementToLocalData(data, movement);
      }

      data.vehicleDispatchItems.unshift(record);
      await writeOperationsData(data);
      return record;
    },
    postgres: () => addVehicleDispatchItemToPostgres(item),
  });
}

export async function addCustomerLedger(ledger: Omit<CustomerLedger, "id" | "lastTransaction">) {
  const record: CustomerLedger = {
    ...ledger,
    id: createId("LEDGER"),
    cashPaid: cleanNumber(ledger.cashPaid),
    chequePaid: cleanNumber(ledger.chequePaid),
    creditGiven: cleanNumber(ledger.creditGiven),
    balanceDue: cleanNumber(ledger.balanceDue),
    creditLimit: cleanNumber(ledger.creditLimit),
    lastTransaction: new Date().toISOString().slice(0, 10),
  };

  return runWithDataBackend({
    storeName: "operations",
    localJson: async () => {
      const data = await getOperationsDataFromLocalJson();
      data.customerLedgers.unshift(record);
      await writeOperationsData(data);
      return record;
    },
    postgres: () => addCustomerLedgerToPostgres(ledger),
  });
}

export async function addStockMovement(movement: StockMovementInput) {
  const record = createStockMovementRecord(movement);

  return runWithDataBackend({
    storeName: "operations",
    localJson: async () => {
      const data = await getOperationsDataFromLocalJson();
      addStockMovementToLocalData(data, record);
      await writeOperationsData(data);
      return record;
    },
    postgres: () => addStockMovementToPostgres(movement),
  });
}

export async function addLedgerTransaction(
  transaction: Omit<LedgerTransaction, "id" | "createdAt" | "customerName">,
) {
  return runWithDataBackend({
    storeName: "operations",
    localJson: async () => {
      const data = await getOperationsDataFromLocalJson();
      const ledger = data.customerLedgers.find((item) => item.id === transaction.ledgerId);

      if (!ledger) {
        throw new Error("Customer ledger was not found.");
      }

      const amount = cleanNumber(transaction.amount);
      const record: LedgerTransaction = {
        ...transaction,
        id: createId("TXN"),
        createdAt: new Date().toISOString(),
        customerName: ledger.customerName,
        amount,
        note: transaction.note.trim(),
      };

      if (record.type === "Cash Payment") {
        ledger.cashPaid += amount;
        ledger.balanceDue = Math.max(0, ledger.balanceDue - amount);
      }

      if (record.type === "Cheque Payment") {
        ledger.chequePaid += amount;
        ledger.balanceDue = Math.max(0, ledger.balanceDue - amount);
      }

      if (record.type === "Credit Sale") {
        ledger.creditGiven += amount;
        ledger.balanceDue += amount;
      }

      if (record.type === "Return Adjustment") {
        ledger.balanceDue = Math.max(0, ledger.balanceDue - amount);
      }

      if (record.type === "Manual Adjustment") {
        ledger.balanceDue += amount;
      }

      ledger.lastTransaction = today();
      data.ledgerTransactions.unshift(record);
      await writeOperationsData(data);
      return record;
    },
    postgres: () => addLedgerTransactionToPostgres(transaction),
  });
}

export async function updateWorkerTask(id: string, task: Omit<WorkerTask, "id">) {
  return runWithDataBackend({
    storeName: "operations",
    localJson: async () => {
      const data = await getOperationsDataFromLocalJson();
      const record = data.workerTasks.find((item) => item.id === id);

      if (!record) {
        throw new Error("Worker task was not found.");
      }

      const batchId = task.batchId.trim();
      const linkedBatch = batchId
        ? data.productionBatches.find((batch) => batch.id === batchId)
        : null;

      if (batchId && !linkedBatch) {
        throw new Error("Production batch was not found.");
      }

      const design = (linkedBatch?.design ?? task.design).trim();

      if (!design) {
        throw new Error("Design name is required.");
      }

      record.workerName = task.workerName.trim() || record.workerName;
      record.station = task.station;
      record.batchId = linkedBatch?.id ?? "";
      record.design = design || record.design;
      record.targetPairs = cleanNumber(task.targetPairs);
      record.completedPairs = cleanNumber(task.completedPairs);
      record.status = task.status;
      record.cameraZone = task.cameraZone.trim();

      await writeOperationsData(data);
      return record;
    },
    postgres: () => updateWorkerTaskToPostgres(id, task),
  });
}

export async function updateFinishedStock(id: string, stock: Omit<FinishedStock, "id">) {
  return runWithDataBackend({
    storeName: "operations",
    localJson: async () => {
      const data = await getOperationsDataFromLocalJson();
      const record = data.finishedStock.find((item) => item.id === id);

      if (!record) {
        throw new Error("Finished stock was not found.");
      }

      record.design = stock.design.trim() || record.design;
      record.channel = stock.channel;
      record.sizeRun = stock.sizeRun.trim() || "Mixed";
      record.stockPairs = cleanNumber(stock.stockPairs);
      record.soldPairs = cleanNumber(stock.soldPairs);
      record.returnedPairs = cleanNumber(stock.returnedPairs);

      await writeOperationsData(data);
      return record;
    },
    postgres: () => updateFinishedStockToPostgres(id, stock),
  });
}

export async function updateRawMaterial(id: string, material: Omit<RawMaterial, "id">) {
  return runWithDataBackend({
    storeName: "operations",
    localJson: async () => {
      const data = await getOperationsDataFromLocalJson();
      const record = data.rawMaterials.find((item) => item.id === id);

      if (!record) {
        throw new Error("Raw material was not found.");
      }

      record.name = material.name.trim() || record.name;
      record.unit = material.unit;
      record.openingStock = cleanNumber(material.openingStock);
      record.used = cleanNumber(material.used);
      record.received = cleanNumber(material.received);
      record.reorderLevel = cleanNumber(material.reorderLevel);

      await writeOperationsData(data);
      return record;
    },
    postgres: () => updateRawMaterialToPostgres(id, material),
  });
}

export async function updateProductionBatch(id: string, batch: Omit<ProductionBatch, "id">) {
  return runWithDataBackend({
    storeName: "operations",
    localJson: async () => {
      const data = await getOperationsDataFromLocalJson();
      const record = data.productionBatches.find((item) => item.id === id);

      if (!record) {
        throw new Error("Production batch was not found.");
      }

      record.design = batch.design.trim() || record.design;
      record.plannedPairs = cleanNumber(batch.plannedPairs);
      record.finishedPairs = cleanNumber(batch.finishedPairs);
      record.inProgressPairs = cleanNumber(batch.inProgressPairs);
      record.rejectedPairs = cleanNumber(batch.rejectedPairs);
      record.rawMaterialUsed = batch.rawMaterialUsed;
      record.status = batch.status;

      await writeOperationsData(data);
      return record;
    },
    postgres: () => updateProductionBatchToPostgres(id, batch),
  });
}

export async function updateVehicleDispatch(id: string, dispatch: Omit<VehicleDispatch, "id">) {
  return runWithDataBackend({
    storeName: "operations",
    localJson: async () => {
      const data = await getOperationsDataFromLocalJson();
      const record = data.vehicleDispatches.find((item) => item.id === id);

      if (!record) {
        throw new Error("Vehicle dispatch was not found.");
      }

      record.vehicleNumber = dispatch.vehicleNumber.trim() || record.vehicleNumber;
      record.driverName = dispatch.driverName.trim() || record.driverName;
      record.marketRoute = dispatch.marketRoute.trim();
      record.loadedPairs = cleanNumber(dispatch.loadedPairs);
      record.returnedPairs = cleanNumber(dispatch.returnedPairs);
      record.cashCollected = cleanNumber(dispatch.cashCollected);
      record.chequeCollected = cleanNumber(dispatch.chequeCollected);
      record.creditAmount = cleanNumber(dispatch.creditAmount);
      record.status = dispatch.status;

      await writeOperationsData(data);
      return record;
    },
    postgres: () => updateVehicleDispatchToPostgres(id, dispatch),
  });
}

export async function updateCustomerLedger(id: string, ledger: Omit<CustomerLedger, "id" | "lastTransaction">) {
  return runWithDataBackend({
    storeName: "operations",
    localJson: async () => {
      const data = await getOperationsDataFromLocalJson();
      const record = data.customerLedgers.find((item) => item.id === id);

      if (!record) {
        throw new Error("Customer ledger was not found.");
      }

      record.customerName = ledger.customerName.trim() || record.customerName;
      record.channel = ledger.channel;
      record.phone = ledger.phone.trim();
      record.cashPaid = cleanNumber(ledger.cashPaid);
      record.chequePaid = cleanNumber(ledger.chequePaid);
      record.creditGiven = cleanNumber(ledger.creditGiven);
      record.balanceDue = cleanNumber(ledger.balanceDue);
      record.creditLimit = cleanNumber(ledger.creditLimit);
      record.lastTransaction = today();

      await writeOperationsData(data);
      return record;
    },
    postgres: () => updateCustomerLedgerToPostgres(id, ledger),
  });
}

export async function updateProductionBatchStatus(id: string, status: ProductionBatch["status"]) {
  return runWithDataBackend({
    storeName: "operations",
    localJson: async () => {
      const data = await getOperationsDataFromLocalJson();
      const batch = data.productionBatches.find((item) => item.id === id);

      if (!batch) {
        throw new Error("Production batch was not found.");
      }

      batch.status = status;
      await writeOperationsData(data);
      return batch;
    },
    postgres: () => updateProductionBatchStatusToPostgres(id, status),
  });
}

export async function updateVehicleDispatchStatus(id: string, status: VehicleDispatch["status"]) {
  return runWithDataBackend({
    storeName: "operations",
    localJson: async () => {
      const data = await getOperationsDataFromLocalJson();
      const dispatch = data.vehicleDispatches.find((item) => item.id === id);

      if (!dispatch) {
        throw new Error("Vehicle dispatch was not found.");
      }

      dispatch.status = status;
      await writeOperationsData(data);
      return dispatch;
    },
    postgres: () => updateVehicleDispatchStatusToPostgres(id, status),
  });
}

export async function updateWorkerTaskStatus(id: string, status: WorkerTask["status"]) {
  return runWithDataBackend({
    storeName: "operations",
    localJson: async () => {
      const data = await getOperationsDataFromLocalJson();
      const task = data.workerTasks.find((item) => item.id === id);

      if (!task) {
        throw new Error("Worker task was not found.");
      }

      task.status = status;
      await writeOperationsData(data);
      return task;
    },
    postgres: () => updateWorkerTaskStatusToPostgres(id, status),
  });
}

export async function deleteOperationRecord(kind: OperationRecordKind, id: string) {
  return runWithDataBackend({
    storeName: "operations",
    localJson: async () => {
      const data = await getOperationsDataFromLocalJson();

      if (kind === "rawMaterial") {
        data.rawMaterials = data.rawMaterials.filter((material) => material.id !== id);
        data.materialConsumptions = data.materialConsumptions.map((consumption) =>
          consumption.materialId === id ? { ...consumption, materialId: "" } : consumption,
        );
      }

      if (kind === "materialConsumption") {
        const consumption = data.materialConsumptions.find((item) => item.id === id);

        if (consumption) {
          const material = data.rawMaterials.find((item) => item.id === consumption.materialId);

          if (material) {
            material.used = Math.max(0, material.used - consumption.quantity - consumption.wastage);
          }
        }

        data.materialConsumptions = data.materialConsumptions.filter((consumption) => consumption.id !== id);
      }

      if (kind === "workerTask") {
        data.workerTasks = data.workerTasks.filter((task) => task.id !== id);
      }

      if (kind === "productionBatch") {
        const consumptions = data.materialConsumptions.filter((consumption) => consumption.batchId === id);

        for (const consumption of consumptions) {
          const material = data.rawMaterials.find((item) => item.id === consumption.materialId);

          if (material) {
            material.used = Math.max(0, material.used - consumption.quantity - consumption.wastage);
          }
        }

        data.materialConsumptions = data.materialConsumptions.filter((consumption) => consumption.batchId !== id);
        data.workerTasks = data.workerTasks.map((task) =>
          task.batchId === id ? { ...task, batchId: "" } : task,
        );
        data.productionBatches = data.productionBatches.filter((batch) => batch.id !== id);
      }

      if (kind === "finishedStock") {
        data.finishedStock = data.finishedStock.filter((stock) => stock.id !== id);
      }

      if (kind === "vehicleDispatch") {
        const items = data.vehicleDispatchItems.filter((item) => item.dispatchId === id);

        for (const item of items) {
          deleteDispatchItemStockMovementsFromLocalData(data, item);
        }

        data.vehicleDispatchItems = data.vehicleDispatchItems.filter((item) => item.dispatchId !== id);
        data.vehicleDispatches = data.vehicleDispatches.filter((dispatch) => dispatch.id !== id);
      }

      if (kind === "vehicleDispatchItem") {
        const item = data.vehicleDispatchItems.find((entry) => entry.id === id);

        if (item) {
          const dispatch = data.vehicleDispatches.find((entry) => entry.id === item.dispatchId);

          if (dispatch) {
            dispatch.loadedPairs = Math.max(0, dispatch.loadedPairs - item.loadedPairs);
            dispatch.returnedPairs = Math.max(0, dispatch.returnedPairs - item.returnedPairs);
            dispatch.cashCollected = Math.max(0, dispatch.cashCollected - item.cashCollected);
            dispatch.chequeCollected = Math.max(0, dispatch.chequeCollected - item.chequeCollected);
            dispatch.creditAmount = Math.max(0, dispatch.creditAmount - item.creditAmount);
          }

          deleteDispatchItemStockMovementsFromLocalData(data, item);
        }

        data.vehicleDispatchItems = data.vehicleDispatchItems.filter((entry) => entry.id !== id);
      }

      if (kind === "customerLedger") {
        data.customerLedgers = data.customerLedgers.filter((ledger) => ledger.id !== id);
        data.ledgerTransactions = data.ledgerTransactions.filter((transaction) => transaction.ledgerId !== id);
      }

      if (kind === "stockMovement") {
        deleteStockMovementFromLocalData(data, id);
      }

      if (kind === "ledgerTransaction") {
        const transaction = data.ledgerTransactions.find((item) => item.id === id);

        if (transaction) {
          const ledger = data.customerLedgers.find((item) => item.id === transaction.ledgerId);

          if (ledger) {
            if (transaction.type === "Cash Payment") {
              ledger.cashPaid = Math.max(0, ledger.cashPaid - transaction.amount);
              ledger.balanceDue += transaction.amount;
            }

            if (transaction.type === "Cheque Payment") {
              ledger.chequePaid = Math.max(0, ledger.chequePaid - transaction.amount);
              ledger.balanceDue += transaction.amount;
            }

            if (transaction.type === "Credit Sale") {
              ledger.creditGiven = Math.max(0, ledger.creditGiven - transaction.amount);
              ledger.balanceDue = Math.max(0, ledger.balanceDue - transaction.amount);
            }

            if (transaction.type === "Return Adjustment") {
              ledger.balanceDue += transaction.amount;
            }

            if (transaction.type === "Manual Adjustment") {
              ledger.balanceDue = Math.max(0, ledger.balanceDue - transaction.amount);
            }

            ledger.lastTransaction = today();
          }
        }

        data.ledgerTransactions = data.ledgerTransactions.filter((transaction) => transaction.id !== id);
      }

      await writeOperationsData(data);
    },
    postgres: () => deleteOperationRecordFromPostgres(kind, id),
  });
}

export async function getOperationsSnapshot() {
  const data = await getOperationsData();
  const fastMovingStock = [...data.finishedStock].sort((a, b) => b.soldPairs - a.soldPairs);
  const slowMovingStock = [...data.finishedStock].sort((a, b) => a.soldPairs - b.soldPairs);
  const stockMovementTotals = emptyStockMovementTotals();
  const stockMovementGroups = new Map<
    string,
    {
      key: string;
      design: string;
      channel: BusinessChannel;
      totalPairs: number;
      productionIn: number;
      dispatchOut: number;
      returnIn: number;
      saleOut: number;
      marketSale: number;
      adjustment: number;
      netStockFlow: number;
      soldPairs: number;
      returnedPairs: number;
    }
  >();
  const ledgerTransactionTotals = emptyLedgerTransactionTotals();
  const stockByChannel = emptyChannelTotals();
  const totalMaterialQuantity = sum(data.materialConsumptions, (consumption) => consumption.quantity);
  const totalMaterialWastage = sum(data.materialConsumptions, (consumption) => consumption.wastage);
  const dispatchItemTotals = {
    loadedPairs: sum(data.vehicleDispatchItems, (item) => item.loadedPairs),
    soldPairs: sum(data.vehicleDispatchItems, (item) => item.soldPairs),
    returnedPairs: sum(data.vehicleDispatchItems, (item) => item.returnedPairs),
    cashCollected: sum(data.vehicleDispatchItems, (item) => item.cashCollected),
    chequeCollected: sum(data.vehicleDispatchItems, (item) => item.chequeCollected),
    creditAmount: sum(data.vehicleDispatchItems, (item) => item.creditAmount),
  };
  const ledgerAging = {
    due0To30: 0,
    due31To60: 0,
    dueOver60: 0,
    totalDue: 0,
  };

  for (const movement of data.stockMovements) {
    stockMovementTotals[movement.type] += movement.pairs;
    const key = `${movement.design.toLowerCase()}::${movement.channel}`;
    const group =
      stockMovementGroups.get(key) ??
      {
        key,
        design: movement.design,
        channel: movement.channel,
        totalPairs: 0,
        productionIn: 0,
        dispatchOut: 0,
        returnIn: 0,
        saleOut: 0,
        marketSale: 0,
        adjustment: 0,
        netStockFlow: 0,
        soldPairs: 0,
        returnedPairs: 0,
      };

    group.totalPairs += movement.pairs;

    if (movement.type === "Production In") {
      group.productionIn += movement.pairs;
      group.netStockFlow += movement.pairs;
    }

    if (movement.type === "Dispatch Out") {
      group.dispatchOut += movement.pairs;
      group.netStockFlow -= movement.pairs;
    }

    if (movement.type === "Return In") {
      group.returnIn += movement.pairs;
      group.returnedPairs += movement.pairs;
      group.netStockFlow += movement.pairs;
    }

    if (movement.type === "Sale Out") {
      group.saleOut += movement.pairs;
      group.soldPairs += movement.pairs;
      group.netStockFlow -= movement.pairs;
    }

    if (movement.type === "Market Sale") {
      group.marketSale += movement.pairs;
      group.soldPairs += movement.pairs;
    }

    if (movement.type === "Adjustment") {
      group.adjustment += movement.pairs;
      group.netStockFlow += movement.pairs;
    }

    stockMovementGroups.set(key, group);
  }

  for (const transaction of data.ledgerTransactions) {
    ledgerTransactionTotals[transaction.type] += transaction.amount;
  }

  for (const stock of data.finishedStock) {
    stockByChannel[stock.channel].stockPairs += stock.stockPairs;
    stockByChannel[stock.channel].soldPairs += stock.soldPairs;
    stockByChannel[stock.channel].returnedPairs += stock.returnedPairs;
  }

  for (const ledger of data.customerLedgers) {
    if (ledger.balanceDue <= 0) {
      continue;
    }

    ledgerAging.totalDue += ledger.balanceDue;
    const outstandingDays = daysSince(ledger.lastTransaction);

    if (outstandingDays <= 30) {
      ledgerAging.due0To30 += ledger.balanceDue;
    } else if (outstandingDays <= 60) {
      ledgerAging.due31To60 += ledger.balanceDue;
    } else {
      ledgerAging.dueOver60 += ledger.balanceDue;
    }
  }

  const overdueLedgers = data.customerLedgers
    .filter((ledger) => ledger.balanceDue > 0)
    .map((ledger) => ({
      id: ledger.id,
      customerName: ledger.customerName,
      channel: ledger.channel,
      balanceDue: ledger.balanceDue,
      daysOutstanding: daysSince(ledger.lastTransaction),
    }))
    .sort((a, b) => b.daysOutstanding - a.daysOutstanding || b.balanceDue - a.balanceDue)
    .slice(0, 5);
  const ledgerAgingRows = data.customerLedgers
    .map((ledger) => {
      const daysOutstanding = daysSince(ledger.lastTransaction);
      const agingBucket =
        ledger.balanceDue <= 0
          ? "Paid"
          : daysOutstanding <= 30
            ? "0-30 days"
            : daysOutstanding <= 60
              ? "31-60 days"
              : "60+ days";

      return {
        id: ledger.id,
        customerName: ledger.customerName,
        channel: ledger.channel,
        phone: ledger.phone,
        cashPaid: ledger.cashPaid,
        chequePaid: ledger.chequePaid,
        creditGiven: ledger.creditGiven,
        balanceDue: ledger.balanceDue,
        lastTransaction: ledger.lastTransaction,
        daysOutstanding,
        agingBucket,
        collectionTotal: ledger.cashPaid + ledger.chequePaid,
        collectionCoverageRate: percentage(ledger.cashPaid + ledger.chequePaid, ledger.creditGiven),
      };
    })
    .sort((a, b) => b.balanceDue - a.balanceDue || b.daysOutstanding - a.daysOutstanding);
  const ledgerCollectionPriorityRank: Record<LedgerCollectionPriority, number> = {
    Urgent: 0,
    High: 1,
    Medium: 2,
    Monitor: 3,
    Clear: 4,
  };
  const ledgerCollectionFollowups = ledgerAgingRows
    .map((ledger) => {
      const priority = ledgerCollectionPriority({
        balanceDue: ledger.balanceDue,
        daysOutstanding: ledger.daysOutstanding,
        collectionCoverageRate: ledger.collectionCoverageRate,
      });

      return {
        ...ledger,
        priority,
        followUpDueDate: ledgerFollowUpDueDate(priority),
        nextAction: ledgerCollectionNextAction(priority),
      };
    })
    .sort(
      (a, b) =>
        ledgerCollectionPriorityRank[a.priority] - ledgerCollectionPriorityRank[b.priority] ||
        b.balanceDue - a.balanceDue ||
        b.daysOutstanding - a.daysOutstanding,
    );
  const ledgerCollectionSummary = {
    urgentCount: ledgerCollectionFollowups.filter((ledger) => ledger.priority === "Urgent").length,
    highCount: ledgerCollectionFollowups.filter((ledger) => ledger.priority === "High").length,
    mediumCount: ledgerCollectionFollowups.filter((ledger) => ledger.priority === "Medium").length,
    monitorCount: ledgerCollectionFollowups.filter((ledger) => ledger.priority === "Monitor").length,
    clearCount: ledgerCollectionFollowups.filter((ledger) => ledger.priority === "Clear").length,
    urgentDue: sum(
      ledgerCollectionFollowups.filter((ledger) => ledger.priority === "Urgent"),
      (ledger) => ledger.balanceDue,
    ),
    highDue: sum(
      ledgerCollectionFollowups.filter((ledger) => ledger.priority === "High"),
      (ledger) => ledger.balanceDue,
    ),
    totalDue: sum(ledgerCollectionFollowups, (ledger) => ledger.balanceDue),
    dueThisWeek: sum(
      ledgerCollectionFollowups.filter(
        (ledger) => ledger.priority === "Urgent" || ledger.priority === "High" || ledger.priority === "Medium",
      ),
      (ledger) => ledger.balanceDue,
    ),
  };
  const stockMovementByDesignChannel = [...stockMovementGroups.values()].sort(
    (a, b) => b.totalPairs - a.totalPairs,
  );
  const stockHealthRank: Record<StockHealthSignal, number> = {
    "Out of stock": 0,
    "Low stock": 1,
    "Return watch": 2,
    Healthy: 3,
  };
  const stockHealthRows = data.finishedStock
    .map((stock) => {
      const flow = stockMovementGroups.get(stockKey(stock));
      const soldPairs = flow?.soldPairs ?? stock.soldPairs;
      const returnedPairs = flow?.returnedPairs ?? stock.returnedPairs;
      const stockInflow =
        (flow?.productionIn ?? 0) + (flow?.returnIn ?? 0) + (flow?.adjustment ?? 0);
      const stockOutflow = (flow?.dispatchOut ?? 0) + (flow?.saleOut ?? 0);
      const sellThroughRate = percentage(stock.soldPairs, stock.stockPairs + stock.soldPairs);
      const returnRate = percentage(stock.returnedPairs, stock.soldPairs + stock.returnedPairs);
      const signal = stockHealthSignal(stock, returnRate);

      return {
        id: stock.id,
        design: stock.design,
        channel: stock.channel,
        sizeRun: stock.sizeRun,
        stockPairs: stock.stockPairs,
        soldPairs,
        returnedPairs,
        stockInflow,
        stockOutflow,
        netStockFlow: flow?.netStockFlow ?? 0,
        sellThroughRate,
        returnRate,
        signal,
      };
    })
    .sort(
      (a, b) =>
        stockHealthRank[a.signal] - stockHealthRank[b.signal] ||
        a.stockPairs - b.stockPairs ||
        b.soldPairs - a.soldPairs,
    );
  const stockLedgerRank: Record<StockLedgerSignal, number> = {
    Variance: 0,
    "No movement": 1,
    Watch: 2,
    Balanced: 3,
  };
  const stockLedgerRows = data.finishedStock
    .map((stock) => {
      const movements = data.stockMovements.filter((movement) => stockKey(movement) === stockKey(stock));
      const movementTotals = emptyStockMovementTotals();

      for (const movement of movements) {
        movementTotals[movement.type] += movement.pairs;
      }

      const movementStockPairs =
        movementTotals["Production In"] +
        movementTotals["Return In"] +
        movementTotals.Adjustment -
        movementTotals["Dispatch Out"] -
        movementTotals["Sale Out"];
      const variancePairs = stock.stockPairs - movementStockPairs;
      const health = stockHealthRows.find((row) => row.id === stock.id);
      const signal = stockLedgerSignal({
        movementCount: movements.length,
        variancePairs,
        healthSignal: health?.signal ?? "Healthy",
      });

      return {
        id: stock.id,
        design: stock.design,
        channel: stock.channel,
        sizeRun: stock.sizeRun,
        stockPairs: stock.stockPairs,
        soldPairs: stock.soldPairs,
        returnedPairs: stock.returnedPairs,
        movementStockPairs,
        variancePairs,
        movementCount: movements.length,
        lastMovementAt: movements
          .map((movement) => movement.createdAt)
          .sort((a, b) => b.localeCompare(a))[0] ?? "",
        productionIn: movementTotals["Production In"],
        dispatchOut: movementTotals["Dispatch Out"],
        returnIn: movementTotals["Return In"],
        saleOut: movementTotals["Sale Out"],
        marketSale: movementTotals["Market Sale"],
        adjustment: movementTotals.Adjustment,
        sellThroughRate: health?.sellThroughRate ?? 0,
        returnRate: health?.returnRate ?? 0,
        healthSignal: health?.signal ?? "Healthy",
        signal,
        nextAction: stockLedgerNextAction(signal),
      };
    })
    .sort(
      (a, b) =>
        stockLedgerRank[a.signal] - stockLedgerRank[b.signal] ||
        Math.abs(b.variancePairs) - Math.abs(a.variancePairs) ||
        b.stockPairs - a.stockPairs,
    );
  const workerProgressByStation = [...new Set(data.workerTasks.map((task) => task.station))]
    .map((station) => {
      const tasks = data.workerTasks.filter((task) => task.station === station);
      const targetPairs = sum(tasks, (task) => task.targetPairs);
      const completedPairs = sum(tasks, (task) => task.completedPairs);

      return {
        station,
        taskCount: tasks.length,
        targetPairs,
        completedPairs,
        progressRate: percentage(completedPairs, targetPairs),
      };
    })
    .sort((a, b) => b.completedPairs - a.completedPairs);
  const unlinkedWorkerTasks = data.workerTasks
    .filter((task) => !task.batchId)
    .map((task) => ({
      id: task.id,
      workerName: task.workerName,
      station: task.station,
      design: task.design,
      status: task.status,
    }));

  const productionInsights = data.productionBatches
    .map((batch) => {
      const linkedTasks = data.workerTasks.filter(
        (task) => task.batchId === batch.id || (!task.batchId && sameDesign(task.design, batch.design)),
      );
      const linkedConsumptions = data.materialConsumptions.filter(
        (consumption) => consumption.batchId === batch.id,
      );
      const workerTargetPairs = sum(linkedTasks, (task) => task.targetPairs);
      const workerCompletedPairs = sum(linkedTasks, (task) => task.completedPairs);
      const materialQuantity = sum(linkedConsumptions, (consumption) => consumption.quantity);
      const materialWastage = sum(linkedConsumptions, (consumption) => consumption.wastage);
      const missingRawMaterials = batch.rawMaterialUsed.filter(
        (materialName) =>
          !data.rawMaterials.some((material) => sameDesign(material.name, materialName)),
      );

      return {
        id: batch.id,
        design: batch.design,
        status: batch.status,
        linkedTaskCount: linkedTasks.length,
        workerTargetPairs,
        workerCompletedPairs,
        workerProgressRate: percentage(workerCompletedPairs, workerTargetPairs),
        productionCompletionRate: percentage(batch.finishedPairs, batch.plannedPairs),
        rejectRate: percentage(batch.rejectedPairs, batch.plannedPairs),
        materialCount: batch.rawMaterialUsed.length,
        consumptionCount: linkedConsumptions.length,
        materialQuantity,
        materialWastage,
        materialWastageRate: percentage(materialWastage, materialQuantity + materialWastage),
        missingRawMaterials,
      };
    })
    .sort((a, b) => a.productionCompletionRate - b.productionCompletionRate);
  const materialUsage = data.rawMaterials
    .map((material) => {
      const consumptions = data.materialConsumptions.filter(
        (consumption) => consumption.materialId === material.id,
      );
      const quantity = sum(consumptions, (consumption) => consumption.quantity);
      const wastage = sum(consumptions, (consumption) => consumption.wastage);

      return {
        id: material.id,
        name: material.name,
        unit: material.unit,
        balance: materialBalance(material),
        recordedQuantity: quantity,
        recordedWastage: wastage,
        recordedTotal: quantity + wastage,
        stockUsed: material.used,
        wastageRate: percentage(wastage, quantity + wastage),
      };
    })
    .sort((a, b) => b.recordedTotal - a.recordedTotal);
  const dispatchPerformance = data.vehicleDispatches
    .map((dispatch) => {
      const items = data.vehicleDispatchItems.filter((item) => item.dispatchId === dispatch.id);
      const loadedPairs = sum(items, (item) => item.loadedPairs);
      const soldPairs = sum(items, (item) => item.soldPairs);
      const returnedPairs = sum(items, (item) => item.returnedPairs);
      const cashCollected = sum(items, (item) => item.cashCollected);
      const chequeCollected = sum(items, (item) => item.chequeCollected);
      const creditAmount = sum(items, (item) => item.creditAmount);

      return {
        id: dispatch.id,
        vehicleNumber: dispatch.vehicleNumber,
        driverName: dispatch.driverName,
        marketRoute: dispatch.marketRoute,
        status: dispatch.status,
        itemCount: items.length,
        loadedPairs,
        soldPairs,
        returnedPairs,
        returnRate: percentage(returnedPairs, loadedPairs),
        cashCollected,
        chequeCollected,
        creditAmount,
        totalCollection: cashCollected + chequeCollected + creditAmount,
      };
    })
    .sort((a, b) => b.totalCollection - a.totalCollection);

  return {
    summary: {
      plannedPairs: sum(data.productionBatches, (batch) => batch.plannedPairs),
      finishedPairs: sum(data.productionBatches, (batch) => batch.finishedPairs),
      inProgressPairs: sum(data.productionBatches, (batch) => batch.inProgressPairs),
      rejectedPairs: sum(data.productionBatches, (batch) => batch.rejectedPairs),
      stockPairs: sum(data.finishedStock, (stock) => stock.stockPairs),
      soldPairs: sum(data.finishedStock, (stock) => stock.soldPairs),
      returnedPairs: sum(data.finishedStock, (stock) => stock.returnedPairs),
      receivable: sum(data.customerLedgers, (ledger) => ledger.balanceDue),
      cash: sum(data.vehicleDispatches, (dispatch) => dispatch.cashCollected),
      cheque: sum(data.vehicleDispatches, (dispatch) => dispatch.chequeCollected),
      credit: sum(data.vehicleDispatches, (dispatch) => dispatch.creditAmount),
    },
    rawMaterials: data.rawMaterials.map((material) => ({
      ...material,
      balance: materialBalance(material),
      lowStock: materialBalance(material) <= material.reorderLevel,
    })),
    workerTasks: data.workerTasks,
    productionBatches: data.productionBatches,
    materialConsumptions: data.materialConsumptions,
    finishedStock: data.finishedStock,
    vehicleDispatches: data.vehicleDispatches,
    vehicleDispatchItems: data.vehicleDispatchItems,
    customerLedgers: data.customerLedgers,
    stockMovements: data.stockMovements,
    ledgerTransactions: data.ledgerTransactions,
    fastMovingStock,
    slowMovingStock,
    reports: {
      productionInsights,
      stockMovementTotals,
      stockMovementByDesignChannel,
      stockHealthRows,
      stockLedgerRows,
      stockByChannel,
      ledgerAging,
      ledgerAgingRows,
      ledgerCollectionFollowups,
      ledgerCollectionSummary,
      ledgerTransactionTotals,
      overdueLedgers,
      workerProgressByStation,
      unlinkedWorkerTasks,
      materialUsage,
      totalMaterialQuantity,
      totalMaterialWastage,
      totalMaterialUsage: totalMaterialQuantity + totalMaterialWastage,
      dispatchItemTotals,
      dispatchPerformance,
      collectionFromLedgerTransactions:
        ledgerTransactionTotals["Cash Payment"] + ledgerTransactionTotals["Cheque Payment"],
      netLedgerCredit:
        ledgerTransactionTotals["Credit Sale"] -
        ledgerTransactionTotals["Return Adjustment"] +
        ledgerTransactionTotals["Manual Adjustment"],
    },
  };
}

export async function getCustomerLedgerDetail(id: string) {
  const [data, paymentTransactions] = await Promise.all([
    getOperationsData(),
    getPaymentTransactionsByLedgerId(id),
  ]);
  const ledger = data.customerLedgers.find((item) => item.id === id);

  if (!ledger) {
    return null;
  }

  const transactions = data.ledgerTransactions
    .filter((transaction) => transaction.ledgerId === id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const collectionTotal = ledger.cashPaid + ledger.chequePaid;
  const collectionCoverageRate = percentage(collectionTotal, ledger.creditGiven);
  const outstandingDays = daysSince(ledger.lastTransaction);
  const agingBucket =
    ledger.balanceDue <= 0
      ? "Paid"
      : outstandingDays <= 30
        ? "0-30 days"
        : outstandingDays <= 60
          ? "31-60 days"
          : "60+ days";
  const collectionPriority = ledgerCollectionPriority({
    balanceDue: ledger.balanceDue,
    daysOutstanding: outstandingDays,
    collectionCoverageRate,
  });

  return {
    ledger,
    transactions,
    summary: {
      cashPaid: ledger.cashPaid,
      chequePaid: ledger.chequePaid,
      creditGiven: ledger.creditGiven,
      balanceDue: ledger.balanceDue,
      transactionCount: transactions.length,
      transactionTotal: sum(transactions, (transaction) => transaction.amount),
      linkedPaymentCount: paymentTransactions.length,
      linkedPaymentTotal: sum(paymentTransactions, (transaction) => transaction.amount),
      collectionTotal,
      collectionCoverageRate,
      daysOutstanding: outstandingDays,
      agingBucket,
      collectionPriority,
      followUpDueDate: ledgerFollowUpDueDate(collectionPriority),
      nextAction: ledgerCollectionNextAction(collectionPriority),
    },
    paymentTransactions,
  };
}
