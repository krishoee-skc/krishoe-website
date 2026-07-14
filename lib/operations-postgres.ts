import { queryPostgres, transactionPostgres, type PostgresExecutor } from "@/lib/postgres/client";
import type {
  CustomerLedger,
  FinishedStock,
  LedgerTransaction,
  MaterialConsumption,
  OperationRecordKind,
  OperationsData,
  ProductionBatch,
  RawMaterial,
  StockMovement,
  StockMovementInput,
  VehicleDispatch,
  VehicleDispatchItem,
  WorkerTask,
} from "@/lib/operations";

type RawMaterialRow = {
  id: string;
  name: string;
  unit: RawMaterial["unit"];
  opening_stock: number | string;
  used: number | string;
  received: number | string;
  reorder_level: number | string;
};

type WorkerTaskRow = {
  id: string;
  worker_name: string;
  station: WorkerTask["station"];
  batch_id: string | null;
  design: string;
  target_pairs: number | string;
  completed_pairs: number | string;
  status: WorkerTask["status"];
  camera_zone: string;
};

type ProductionBatchRow = {
  id: string;
  design: string;
  planned_pairs: number | string;
  finished_pairs: number | string;
  in_progress_pairs: number | string;
  rejected_pairs: number | string;
  raw_material_used: string[] | null;
  status: ProductionBatch["status"];
};

type MaterialConsumptionRow = {
  id: string;
  created_at: Date | string;
  batch_id: string;
  batch_design: string;
  material_id: string | null;
  material_name: string;
  unit: RawMaterial["unit"];
  quantity: number | string;
  wastage: number | string;
  note: string;
};

type FinishedStockRow = {
  id: string;
  design: string;
  channel: FinishedStock["channel"];
  size_run: string;
  stock_pairs: number | string;
  sold_pairs: number | string;
  returned_pairs: number | string;
};

type VehicleDispatchRow = {
  id: string;
  vehicle_number: string;
  driver_name: string;
  market_route: string;
  loaded_pairs: number | string;
  returned_pairs: number | string;
  cash_collected: number | string;
  cheque_collected: number | string;
  credit_amount: number | string;
  status: VehicleDispatch["status"];
};

type VehicleDispatchItemRow = {
  id: string;
  created_at: Date | string;
  dispatch_id: string;
  vehicle_number: string;
  market_route: string;
  design: string;
  channel: VehicleDispatchItem["channel"];
  size_run: string;
  loaded_pairs: number | string;
  sold_pairs: number | string;
  returned_pairs: number | string;
  cash_collected: number | string;
  cheque_collected: number | string;
  credit_amount: number | string;
  stock_movement_ids: string[] | null;
  note: string;
};

type CustomerLedgerRow = {
  id: string;
  customer_name: string;
  channel: CustomerLedger["channel"];
  phone: string;
  cash_paid: number | string;
  cheque_paid: number | string;
  credit_given: number | string;
  balance_due: number | string;
  credit_limit: number | string | null;
  last_transaction: Date | string;
};

type StockMovementRow = {
  id: string;
  created_at: Date | string;
  design: string;
  channel: StockMovement["channel"];
  size_run: string | null;
  type: StockMovement["type"];
  pairs: number | string;
  note: string;
};

type LedgerTransactionRow = {
  id: string;
  created_at: Date | string;
  ledger_id: string;
  customer_name: string;
  type: LedgerTransaction["type"];
  amount: number | string;
  note: string;
};

function createId(prefix: string) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `${prefix}-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function cleanNumber(value: number) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function cleanText(value: string) {
  return value.trim();
}

function isStockOutMovement(type: StockMovement["type"]) {
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

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isoDate(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function dateOnly(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
}

function rawMaterialFromRow(row: RawMaterialRow): RawMaterial {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    openingStock: cleanNumber(Number(row.opening_stock)),
    used: cleanNumber(Number(row.used)),
    received: cleanNumber(Number(row.received)),
    reorderLevel: cleanNumber(Number(row.reorder_level)),
  };
}

function workerTaskFromRow(row: WorkerTaskRow): WorkerTask {
  return {
    id: row.id,
    workerName: row.worker_name,
    station: row.station,
    batchId: row.batch_id ?? "",
    design: row.design,
    targetPairs: cleanNumber(Number(row.target_pairs)),
    completedPairs: cleanNumber(Number(row.completed_pairs)),
    status: row.status,
    cameraZone: row.camera_zone,
  };
}

function productionBatchFromRow(row: ProductionBatchRow): ProductionBatch {
  return {
    id: row.id,
    design: row.design,
    plannedPairs: cleanNumber(Number(row.planned_pairs)),
    finishedPairs: cleanNumber(Number(row.finished_pairs)),
    inProgressPairs: cleanNumber(Number(row.in_progress_pairs)),
    rejectedPairs: cleanNumber(Number(row.rejected_pairs)),
    rawMaterialUsed: Array.isArray(row.raw_material_used) ? row.raw_material_used : [],
    status: row.status,
  };
}

function materialConsumptionFromRow(row: MaterialConsumptionRow): MaterialConsumption {
  return {
    id: row.id,
    createdAt: isoDate(row.created_at),
    batchId: row.batch_id,
    batchDesign: row.batch_design,
    materialId: row.material_id ?? "",
    materialName: row.material_name,
    unit: row.unit,
    quantity: cleanNumber(Number(row.quantity)),
    wastage: cleanNumber(Number(row.wastage)),
    note: row.note,
  };
}

function finishedStockFromRow(row: FinishedStockRow): FinishedStock {
  return {
    id: row.id,
    design: row.design,
    channel: row.channel,
    sizeRun: row.size_run,
    stockPairs: cleanNumber(Number(row.stock_pairs)),
    soldPairs: cleanNumber(Number(row.sold_pairs)),
    returnedPairs: cleanNumber(Number(row.returned_pairs)),
  };
}

function vehicleDispatchFromRow(row: VehicleDispatchRow): VehicleDispatch {
  return {
    id: row.id,
    vehicleNumber: row.vehicle_number,
    driverName: row.driver_name,
    marketRoute: row.market_route,
    loadedPairs: cleanNumber(Number(row.loaded_pairs)),
    returnedPairs: cleanNumber(Number(row.returned_pairs)),
    cashCollected: cleanNumber(Number(row.cash_collected)),
    chequeCollected: cleanNumber(Number(row.cheque_collected)),
    creditAmount: cleanNumber(Number(row.credit_amount)),
    status: row.status,
  };
}

function vehicleDispatchItemFromRow(row: VehicleDispatchItemRow): VehicleDispatchItem {
  return {
    id: row.id,
    createdAt: isoDate(row.created_at),
    dispatchId: row.dispatch_id,
    vehicleNumber: row.vehicle_number,
    marketRoute: row.market_route,
    design: row.design,
    channel: row.channel,
    sizeRun: row.size_run,
    loadedPairs: cleanNumber(Number(row.loaded_pairs)),
    soldPairs: cleanNumber(Number(row.sold_pairs)),
    returnedPairs: cleanNumber(Number(row.returned_pairs)),
    cashCollected: cleanNumber(Number(row.cash_collected)),
    chequeCollected: cleanNumber(Number(row.cheque_collected)),
    creditAmount: cleanNumber(Number(row.credit_amount)),
    stockMovementIds: Array.isArray(row.stock_movement_ids) ? row.stock_movement_ids : [],
    note: row.note,
  };
}

function customerLedgerFromRow(row: CustomerLedgerRow): CustomerLedger {
  return {
    id: row.id,
    customerName: row.customer_name,
    channel: row.channel,
    phone: row.phone,
    cashPaid: cleanNumber(Number(row.cash_paid)),
    chequePaid: cleanNumber(Number(row.cheque_paid)),
    creditGiven: cleanNumber(Number(row.credit_given)),
    balanceDue: cleanNumber(Number(row.balance_due)),
    creditLimit: cleanNumber(Number(row.credit_limit)),
    lastTransaction: dateOnly(row.last_transaction),
  };
}

function stockMovementFromRow(row: StockMovementRow): StockMovement {
  return {
    id: row.id,
    createdAt: isoDate(row.created_at),
    design: row.design,
    channel: row.channel,
    sizeRun: row.size_run ?? "Mixed",
    type: row.type,
    pairs: cleanNumber(Number(row.pairs)),
    note: row.note,
  };
}

function ledgerTransactionFromRow(row: LedgerTransactionRow): LedgerTransaction {
  return {
    id: row.id,
    createdAt: isoDate(row.created_at),
    ledgerId: row.ledger_id,
    customerName: row.customer_name,
    type: row.type,
    amount: cleanNumber(Number(row.amount)),
    note: row.note,
  };
}

export async function getOperationsDataFromPostgres(): Promise<OperationsData> {
  const [
    rawMaterials,
    workerTasks,
    productionBatches,
    materialConsumptions,
    finishedStock,
    vehicleDispatches,
    vehicleDispatchItems,
    customerLedgers,
    stockMovements,
    ledgerTransactions,
  ] = await Promise.all([
    queryPostgres<RawMaterialRow>(
      "operations",
      "SELECT id, name, unit, opening_stock, used, received, reorder_level FROM raw_materials ORDER BY name ASC",
    ),
    queryPostgres<WorkerTaskRow>(
      "operations",
      "SELECT id, worker_name, station, batch_id, design, target_pairs, completed_pairs, status, camera_zone FROM worker_tasks ORDER BY created_at DESC",
    ),
    queryPostgres<ProductionBatchRow>(
      "operations",
      "SELECT id, design, planned_pairs, finished_pairs, in_progress_pairs, rejected_pairs, raw_material_used, status FROM production_batches ORDER BY created_at DESC",
    ),
    queryPostgres<MaterialConsumptionRow>(
      "operations",
      "SELECT id, created_at, batch_id, batch_design, material_id, material_name, unit, quantity, wastage, note FROM material_consumptions ORDER BY created_at DESC",
    ),
    queryPostgres<FinishedStockRow>(
      "operations",
      "SELECT id, design, channel, size_run, stock_pairs, sold_pairs, returned_pairs FROM finished_stock ORDER BY created_at DESC",
    ),
    queryPostgres<VehicleDispatchRow>(
      "operations",
      "SELECT id, vehicle_number, driver_name, market_route, loaded_pairs, returned_pairs, cash_collected, cheque_collected, credit_amount, status FROM vehicle_dispatches ORDER BY created_at DESC",
    ),
    queryPostgres<VehicleDispatchItemRow>(
      "operations",
      "SELECT id, created_at, dispatch_id, vehicle_number, market_route, design, channel, size_run, loaded_pairs, sold_pairs, returned_pairs, cash_collected, cheque_collected, credit_amount, stock_movement_ids, note FROM vehicle_dispatch_items ORDER BY created_at DESC",
    ),
    queryPostgres<CustomerLedgerRow>(
      "operations",
      "SELECT id, customer_name, channel, phone, cash_paid, cheque_paid, credit_given, balance_due, credit_limit, last_transaction FROM customer_ledgers ORDER BY updated_at DESC",
    ),
    queryPostgres<StockMovementRow>(
      "operations",
      "SELECT id, created_at, design, channel, size_run, type, pairs, note FROM stock_movements ORDER BY created_at DESC",
    ),
    queryPostgres<LedgerTransactionRow>(
      "operations",
      "SELECT id, created_at, ledger_id, customer_name, type, amount, note FROM ledger_transactions ORDER BY created_at DESC",
    ),
  ]);

  return {
    rawMaterials: rawMaterials.map(rawMaterialFromRow),
    materialConsumptions: materialConsumptions.map(materialConsumptionFromRow),
    workerTasks: workerTasks.map(workerTaskFromRow),
    productionBatches: productionBatches.map(productionBatchFromRow),
    finishedStock: finishedStock.map(finishedStockFromRow),
    vehicleDispatches: vehicleDispatches.map(vehicleDispatchFromRow),
    vehicleDispatchItems: vehicleDispatchItems.map(vehicleDispatchItemFromRow),
    customerLedgers: customerLedgers.map(customerLedgerFromRow),
    stockMovements: stockMovements.map(stockMovementFromRow),
    ledgerTransactions: ledgerTransactions.map(ledgerTransactionFromRow),
  };
}

export async function addRawMaterialToPostgres(
  material: Omit<RawMaterial, "id" | "used">,
) {
  const rows = await queryPostgres<RawMaterialRow>(
    "operations",
    `
      INSERT INTO raw_materials (id, name, unit, opening_stock, used, received, reorder_level)
      VALUES ($1, $2, $3, $4, 0, $5, $6)
      RETURNING id, name, unit, opening_stock, used, received, reorder_level
    `,
    [
      createId("RM"),
      cleanText(material.name),
      material.unit,
      cleanNumber(material.openingStock),
      cleanNumber(material.received),
      cleanNumber(material.reorderLevel),
    ],
  );

  return rawMaterialFromRow(rows[0]);
}

export async function addRawMaterialReceiptToPostgres(input: {
  materialId: string;
  quantity: number;
}) {
  const rows = await queryPostgres<RawMaterialRow>(
    "operations",
    `
      UPDATE raw_materials
      SET received = received + $2
      WHERE id = $1
      RETURNING id, name, unit, opening_stock, used, received, reorder_level
    `,
    [cleanText(input.materialId), cleanNumber(input.quantity)],
  );

  if (!rows[0]) {
    throw new Error("Raw material was not found.");
  }

  return rawMaterialFromRow(rows[0]);
}

export async function addProductionBatchToPostgres(batch: Omit<ProductionBatch, "id">) {
  const rows = await queryPostgres<ProductionBatchRow>(
    "operations",
    `
      INSERT INTO production_batches (
        id, design, planned_pairs, finished_pairs, in_progress_pairs, rejected_pairs, raw_material_used, status, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
      RETURNING id, design, planned_pairs, finished_pairs, in_progress_pairs, rejected_pairs, raw_material_used, status
    `,
    [
      createId("BATCH"),
      cleanText(batch.design),
      cleanNumber(batch.plannedPairs),
      cleanNumber(batch.finishedPairs),
      cleanNumber(batch.inProgressPairs),
      cleanNumber(batch.rejectedPairs),
      batch.rawMaterialUsed.filter(Boolean),
      batch.status,
    ],
  );

  return productionBatchFromRow(rows[0]);
}

export async function addMaterialConsumptionToPostgres(input: {
  batchId: string;
  materialId: string;
  quantity: number;
  wastage: number;
  note: string;
}) {
  return transactionPostgres("operations", async (db) => {
    const batchRows = await db.query<ProductionBatchRow>(
      `
        SELECT id, design, planned_pairs, finished_pairs, in_progress_pairs, rejected_pairs, raw_material_used, status
        FROM production_batches
        WHERE id = $1
        LIMIT 1
        FOR UPDATE
      `,
      [input.batchId],
    );

    if (!batchRows[0]) {
      throw new Error("Production batch was not found.");
    }

    const materialRows = await db.query<RawMaterialRow>(
      `
        SELECT id, name, unit, opening_stock, used, received, reorder_level
        FROM raw_materials
        WHERE id = $1
        LIMIT 1
        FOR UPDATE
      `,
      [input.materialId],
    );

    if (!materialRows[0]) {
      throw new Error("Raw material was not found.");
    }

    const batch = productionBatchFromRow(batchRows[0]);
    const material = rawMaterialFromRow(materialRows[0]);
    const quantity = cleanNumber(input.quantity);
    const wastage = cleanNumber(input.wastage);

    if (quantity + wastage <= 0) {
      throw new Error("Material consumption quantity or wastage is required.");
    }

    const nextRawMaterialUsed = batch.rawMaterialUsed.some((name) => cleanText(name).toLowerCase() === material.name.toLowerCase())
      ? batch.rawMaterialUsed
      : [...batch.rawMaterialUsed, material.name];

    await db.query<RawMaterialRow>(
      `
        UPDATE raw_materials
        SET used = used + $2
        WHERE id = $1
        RETURNING id
      `,
      [material.id, quantity + wastage],
    );

    await db.query<ProductionBatchRow>(
      `
        UPDATE production_batches
        SET raw_material_used = $2, updated_at = now()
        WHERE id = $1
        RETURNING id
      `,
      [batch.id, nextRawMaterialUsed],
    );

    const rows = await db.query<MaterialConsumptionRow>(
      `
        INSERT INTO material_consumptions (
          id, created_at, batch_id, batch_design, material_id, material_name, unit, quantity, wastage, note
        )
        VALUES ($1, now(), $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, created_at, batch_id, batch_design, material_id, material_name, unit, quantity, wastage, note
      `,
      [
        createId("USE"),
        batch.id,
        batch.design,
        material.id,
        material.name,
        material.unit,
        quantity,
        wastage,
        cleanText(input.note),
      ],
    );

    return materialConsumptionFromRow(rows[0]);
  });
}

export async function addWorkerTaskToPostgres(task: Omit<WorkerTask, "id">) {
  return transactionPostgres("operations", async (db) => {
    const batchId = cleanText(task.batchId);
    let design = cleanText(task.design);

    if (batchId) {
      const batchRows = await db.query<ProductionBatchRow>(
        `
          SELECT id, design, planned_pairs, finished_pairs, in_progress_pairs, rejected_pairs, raw_material_used, status
          FROM production_batches
          WHERE id = $1
          LIMIT 1
        `,
        [batchId],
      );

      if (!batchRows[0]) {
        throw new Error("Production batch was not found.");
      }

      design = batchRows[0].design;
    }

    if (!design) {
      throw new Error("Design name is required.");
    }

    const rows = await db.query<WorkerTaskRow>(
      `
        INSERT INTO worker_tasks (
          id, worker_name, station, batch_id, design, target_pairs, completed_pairs, status, camera_zone, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
        RETURNING id, worker_name, station, batch_id, design, target_pairs, completed_pairs, status, camera_zone
      `,
      [
        createId("TASK"),
        cleanText(task.workerName),
        task.station,
        batchId || null,
        design,
        cleanNumber(task.targetPairs),
        cleanNumber(task.completedPairs),
        task.status,
        cleanText(task.cameraZone),
      ],
    );

    return workerTaskFromRow(rows[0]);
  });
}

export async function addFinishedStockToPostgres(stock: Omit<FinishedStock, "id">) {
  const rows = await queryPostgres<FinishedStockRow>(
    "operations",
    `
      INSERT INTO finished_stock (
        id, design, channel, size_run, stock_pairs, sold_pairs, returned_pairs, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, now())
      ON CONFLICT (design, channel, size_run) DO UPDATE SET
        stock_pairs = EXCLUDED.stock_pairs,
        sold_pairs = EXCLUDED.sold_pairs,
        returned_pairs = EXCLUDED.returned_pairs,
        updated_at = now()
      RETURNING id, design, channel, size_run, stock_pairs, sold_pairs, returned_pairs
    `,
    [
      createId("STOCK"),
      cleanText(stock.design),
      stock.channel,
      cleanText(stock.sizeRun) || "Mixed",
      cleanNumber(stock.stockPairs),
      cleanNumber(stock.soldPairs),
      cleanNumber(stock.returnedPairs),
    ],
  );

  return finishedStockFromRow(rows[0]);
}

export async function addVehicleDispatchToPostgres(dispatch: Omit<VehicleDispatch, "id">) {
  const rows = await queryPostgres<VehicleDispatchRow>(
    "operations",
    `
      INSERT INTO vehicle_dispatches (
        id, vehicle_number, driver_name, market_route, loaded_pairs, returned_pairs,
        cash_collected, cheque_collected, credit_amount, status, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
      RETURNING id, vehicle_number, driver_name, market_route, loaded_pairs, returned_pairs,
        cash_collected, cheque_collected, credit_amount, status
    `,
    [
      createId("TRIP"),
      cleanText(dispatch.vehicleNumber),
      cleanText(dispatch.driverName),
      cleanText(dispatch.marketRoute),
      cleanNumber(dispatch.loadedPairs),
      cleanNumber(dispatch.returnedPairs),
      cleanNumber(dispatch.cashCollected),
      cleanNumber(dispatch.chequeCollected),
      cleanNumber(dispatch.creditAmount),
      dispatch.status,
    ],
  );

  return vehicleDispatchFromRow(rows[0]);
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

export async function addVehicleDispatchItemToPostgres(item: Omit<
  VehicleDispatchItem,
  "id" | "createdAt" | "vehicleNumber" | "marketRoute" | "stockMovementIds"
>) {
  return transactionPostgres("operations", async (db) => {
    const dispatchRows = await db.query<VehicleDispatchRow>(
      `
        SELECT id, vehicle_number, driver_name, market_route, loaded_pairs, returned_pairs,
          cash_collected, cheque_collected, credit_amount, status
        FROM vehicle_dispatches
        WHERE id = $1
        LIMIT 1
        FOR UPDATE
      `,
      [item.dispatchId],
    );

    if (!dispatchRows[0]) {
      throw new Error("Vehicle dispatch was not found.");
    }

    const dispatch = vehicleDispatchFromRow(dispatchRows[0]);
    const loadedPairs = cleanNumber(item.loadedPairs);
    const soldPairs = cleanNumber(item.soldPairs);
    const returnedPairs = cleanNumber(item.returnedPairs);
    const cashCollected = cleanNumber(item.cashCollected);
    const chequeCollected = cleanNumber(item.chequeCollected);
    const creditAmount = cleanNumber(item.creditAmount);
    const design = cleanText(item.design);
    const recordId = createId("TRIPITEM");

    if (!design || loadedPairs <= 0) {
      throw new Error("Dispatch item design and loaded pair quantity are required.");
    }

    if (soldPairs + returnedPairs > loadedPairs) {
      throw new Error("Sold and returned pairs cannot be greater than loaded pairs.");
    }

    await db.query<VehicleDispatchRow>(
      `
        UPDATE vehicle_dispatches
        SET loaded_pairs = loaded_pairs + $2,
          returned_pairs = returned_pairs + $3,
          cash_collected = cash_collected + $4,
          cheque_collected = cheque_collected + $5,
          credit_amount = credit_amount + $6,
          updated_at = now()
        WHERE id = $1
        RETURNING id
      `,
      [
        dispatch.id,
        loadedPairs,
        returnedPairs,
        cashCollected,
        chequeCollected,
        creditAmount,
      ],
    );

    const stockMovementIds: string[] = [];
    const dispatchItemForStockMovements = {
      id: recordId,
      vehicleNumber: dispatch.vehicleNumber,
      marketRoute: dispatch.marketRoute,
      design,
      channel: item.channel,
      sizeRun: cleanText(item.sizeRun ?? "") || "Mixed",
      loadedPairs,
      soldPairs,
      returnedPairs,
    } satisfies Pick<
      VehicleDispatchItem,
      "id" | "vehicleNumber" | "marketRoute" | "design" | "channel" | "sizeRun" | "loadedPairs" | "soldPairs" | "returnedPairs"
    >;

    for (const movement of dispatchItemStockMovements(dispatchItemForStockMovements)) {
      const stockMovement = await insertStockMovement(db, movement);
      stockMovementIds.push(stockMovement.id);
    }

    const rows = await db.query<VehicleDispatchItemRow>(
      `
        INSERT INTO vehicle_dispatch_items (
          id, created_at, dispatch_id, vehicle_number, market_route, design, channel, size_run,
          loaded_pairs, sold_pairs, returned_pairs, cash_collected, cheque_collected, credit_amount, stock_movement_ids, note
        )
        VALUES ($1, now(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id, created_at, dispatch_id, vehicle_number, market_route, design, channel, size_run,
          loaded_pairs, sold_pairs, returned_pairs, cash_collected, cheque_collected, credit_amount, stock_movement_ids, note
      `,
      [
        recordId,
        dispatch.id,
        dispatch.vehicleNumber,
        dispatch.marketRoute,
        design,
        item.channel,
        cleanText(item.sizeRun) || "Mixed",
        loadedPairs,
        soldPairs,
        returnedPairs,
        cashCollected,
        chequeCollected,
        creditAmount,
        stockMovementIds,
        cleanText(item.note),
      ],
    );

    return vehicleDispatchItemFromRow(rows[0]);
  });
}

export async function addCustomerLedgerToPostgres(
  ledger: Omit<CustomerLedger, "id" | "lastTransaction">,
) {
  const rows = await queryPostgres<CustomerLedgerRow>(
    "operations",
    `
      INSERT INTO customer_ledgers (
        id, customer_name, channel, phone, cash_paid, cheque_paid, credit_given, balance_due, credit_limit, last_transaction, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
      RETURNING id, customer_name, channel, phone, cash_paid, cheque_paid, credit_given, balance_due, credit_limit, last_transaction
    `,
    [
      createId("LEDGER"),
      cleanText(ledger.customerName),
      ledger.channel,
      cleanText(ledger.phone),
      cleanNumber(ledger.cashPaid),
      cleanNumber(ledger.chequePaid),
      cleanNumber(ledger.creditGiven),
      cleanNumber(ledger.balanceDue),
      cleanNumber(ledger.creditLimit),
      today(),
    ],
  );

  return customerLedgerFromRow(rows[0]);
}

function applyStockMovement(stock: FinishedStock, movement: Pick<StockMovement, "type" | "pairs">) {
  const nextStock = { ...stock };

  if (movement.pairs <= 0) {
    throw new Error("Stock movement pairs must be greater than zero.");
  }

  if (isStockOutMovement(movement.type)) {
    assertStockAvailable(nextStock, movement);
  }

  if (movement.type === "Production In" || movement.type === "Adjustment") {
    nextStock.stockPairs += movement.pairs;
  }

  if (movement.type === "Dispatch Out") {
    nextStock.stockPairs -= movement.pairs;
  }

  if (movement.type === "Sale Out") {
    nextStock.stockPairs -= movement.pairs;
    nextStock.soldPairs += movement.pairs;
  }

  if (movement.type === "Market Sale") {
    nextStock.soldPairs += movement.pairs;
  }

  if (movement.type === "Return In") {
    nextStock.stockPairs += movement.pairs;
    nextStock.returnedPairs += movement.pairs;
  }

  return nextStock;
}

function reverseStockMovement(stock: FinishedStock, movement: Pick<StockMovement, "type" | "pairs">) {
  const nextStock = { ...stock };

  if (
    (movement.type === "Production In" || movement.type === "Adjustment" || movement.type === "Return In") &&
    movement.pairs > nextStock.stockPairs
  ) {
    throw new Error(
      `${nextStock.design} ${nextStock.channel} stock depends on this movement. Add stock back before deleting it.`,
    );
  }

  if (movement.type === "Production In" || movement.type === "Adjustment") {
    nextStock.stockPairs -= movement.pairs;
  }

  if (movement.type === "Dispatch Out") {
    nextStock.stockPairs += movement.pairs;
  }

  if (movement.type === "Sale Out") {
    nextStock.stockPairs += movement.pairs;
    nextStock.soldPairs = Math.max(0, nextStock.soldPairs - movement.pairs);
  }

  if (movement.type === "Market Sale") {
    nextStock.soldPairs = Math.max(0, nextStock.soldPairs - movement.pairs);
  }

  if (movement.type === "Return In") {
    nextStock.stockPairs -= movement.pairs;
    nextStock.returnedPairs = Math.max(0, nextStock.returnedPairs - movement.pairs);
  }

  return nextStock;
}

async function findOrCreateFinishedStock(
  db: PostgresExecutor,
  movement: Pick<StockMovement, "design" | "channel" | "sizeRun">,
) {
  const sizeRun = (movement.sizeRun ?? "").trim() || "Mixed";
  // Prefer an exact size-run row, then the aggregate "Mixed" row, then any row
  // for this design/channel — this keeps range-based stock rows working while
  // letting size-specific rows take over once the owner adds them.
  const existingRows = await db.query<FinishedStockRow>(
    `
      SELECT id, design, channel, size_run, stock_pairs, sold_pairs, returned_pairs
      FROM finished_stock
      WHERE lower(design) = lower($1) AND channel = $2
      ORDER BY
        CASE
          WHEN size_run = $3 THEN 0
          WHEN size_run = 'Mixed' THEN 1
          WHEN size_run LIKE '%-%' THEN 2
          ELSE 3
        END,
        created_at DESC
      LIMIT 1
      FOR UPDATE
    `,
    [movement.design, movement.channel, sizeRun],
  );

  if (existingRows[0]) {
    return finishedStockFromRow(existingRows[0]);
  }

  const createdRows = await db.query<FinishedStockRow>(
    `
      INSERT INTO finished_stock (id, design, channel, size_run, stock_pairs, sold_pairs, returned_pairs, updated_at)
      VALUES ($1, $2, $3, $4, 0, 0, 0, now())
      RETURNING id, design, channel, size_run, stock_pairs, sold_pairs, returned_pairs
    `,
    [createId("STOCK"), movement.design, movement.channel, sizeRun],
  );

  return finishedStockFromRow(createdRows[0]);
}

async function updateFinishedStockTotals(db: PostgresExecutor, stock: FinishedStock) {
  await db.query<FinishedStockRow>(
    `
      UPDATE finished_stock
      SET stock_pairs = $2, sold_pairs = $3, returned_pairs = $4, updated_at = now()
      WHERE id = $1
      RETURNING id
    `,
    [stock.id, stock.stockPairs, stock.soldPairs, stock.returnedPairs],
  );
}

export async function addStockMovementToPostgres(movement: StockMovementInput) {
  return transactionPostgres("operations", (db) => insertStockMovement(db, movement));
}

export async function insertStockMovement(
  db: PostgresExecutor,
  movement: StockMovementInput,
) {
  const createdAt = new Date();
  const record: StockMovement = {
    ...movement,
    id: createId("MOVE"),
    createdAt: createdAt.toISOString(),
    design: cleanText(movement.design),
    sizeRun: cleanText(movement.sizeRun ?? "") || "Mixed",
    pairs: cleanNumber(movement.pairs),
    note: cleanText(movement.note),
  };

  const stock = await findOrCreateFinishedStock(db, record);
  await updateFinishedStockTotals(db, applyStockMovement(stock, record));

  const rows = await db.query<StockMovementRow>(
    `
      INSERT INTO stock_movements (id, created_at, design, channel, size_run, type, pairs, note)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, created_at, design, channel, size_run, type, pairs, note
    `,
    [
      record.id,
      createdAt,
      record.design,
      record.channel,
      record.sizeRun,
      record.type,
      record.pairs,
      record.note,
    ],
  );

  return stockMovementFromRow(rows[0]);
}

function applyLedgerTransaction(
  ledger: CustomerLedger,
  transaction: Pick<LedgerTransaction, "type" | "amount">,
) {
  const nextLedger = { ...ledger };

  if (transaction.type === "Cash Payment") {
    nextLedger.cashPaid += transaction.amount;
    nextLedger.balanceDue = Math.max(0, nextLedger.balanceDue - transaction.amount);
  }

  if (transaction.type === "Cheque Payment") {
    nextLedger.chequePaid += transaction.amount;
    nextLedger.balanceDue = Math.max(0, nextLedger.balanceDue - transaction.amount);
  }

  if (transaction.type === "Credit Sale") {
    nextLedger.creditGiven += transaction.amount;
    nextLedger.balanceDue += transaction.amount;
  }

  if (transaction.type === "Return Adjustment") {
    nextLedger.balanceDue = Math.max(0, nextLedger.balanceDue - transaction.amount);
  }

  if (transaction.type === "Manual Adjustment") {
    nextLedger.balanceDue += transaction.amount;
  }

  nextLedger.lastTransaction = today();
  return nextLedger;
}

function reverseLedgerTransaction(
  ledger: CustomerLedger,
  transaction: Pick<LedgerTransaction, "type" | "amount">,
) {
  const nextLedger = { ...ledger };

  if (transaction.type === "Cash Payment") {
    nextLedger.cashPaid = Math.max(0, nextLedger.cashPaid - transaction.amount);
    nextLedger.balanceDue += transaction.amount;
  }

  if (transaction.type === "Cheque Payment") {
    nextLedger.chequePaid = Math.max(0, nextLedger.chequePaid - transaction.amount);
    nextLedger.balanceDue += transaction.amount;
  }

  if (transaction.type === "Credit Sale") {
    nextLedger.creditGiven = Math.max(0, nextLedger.creditGiven - transaction.amount);
    nextLedger.balanceDue = Math.max(0, nextLedger.balanceDue - transaction.amount);
  }

  if (transaction.type === "Return Adjustment") {
    nextLedger.balanceDue += transaction.amount;
  }

  if (transaction.type === "Manual Adjustment") {
    nextLedger.balanceDue = Math.max(0, nextLedger.balanceDue - transaction.amount);
  }

  nextLedger.lastTransaction = today();
  return nextLedger;
}

async function updateCustomerLedgerTotals(db: PostgresExecutor, ledger: CustomerLedger) {
  await db.query<CustomerLedgerRow>(
    `
      UPDATE customer_ledgers
      SET cash_paid = $2, cheque_paid = $3, credit_given = $4, balance_due = $5, last_transaction = $6, updated_at = now()
      WHERE id = $1
      RETURNING id
    `,
    [
      ledger.id,
      ledger.cashPaid,
      ledger.chequePaid,
      ledger.creditGiven,
      ledger.balanceDue,
      ledger.lastTransaction,
    ],
  );
}

export async function insertLedgerTransaction(
  db: PostgresExecutor,
  transaction: Omit<LedgerTransaction, "id" | "createdAt" | "customerName">,
) {
  const ledgerRows = await db.query<CustomerLedgerRow>(
    `
      SELECT id, customer_name, channel, phone, cash_paid, cheque_paid, credit_given, balance_due, credit_limit, last_transaction
      FROM customer_ledgers
      WHERE id = $1
      LIMIT 1
      FOR UPDATE
    `,
    [transaction.ledgerId],
  );

  if (!ledgerRows[0]) {
    throw new Error("Customer ledger was not found.");
  }

  const ledger = customerLedgerFromRow(ledgerRows[0]);
  const record: LedgerTransaction = {
    ...transaction,
    id: createId("TXN"),
    createdAt: new Date().toISOString(),
    customerName: ledger.customerName,
    amount: cleanNumber(transaction.amount),
    note: cleanText(transaction.note),
  };

  await updateCustomerLedgerTotals(db, applyLedgerTransaction(ledger, record));

  const rows = await db.query<LedgerTransactionRow>(
    `
      INSERT INTO ledger_transactions (id, created_at, ledger_id, customer_name, type, amount, note)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, created_at, ledger_id, customer_name, type, amount, note
    `,
    [
      record.id,
      new Date(record.createdAt),
      record.ledgerId,
      record.customerName,
      record.type,
      record.amount,
      record.note,
    ],
  );

  return ledgerTransactionFromRow(rows[0]);
}

export async function addLedgerTransactionToPostgres(
  transaction: Omit<LedgerTransaction, "id" | "createdAt" | "customerName">,
) {
  return transactionPostgres("operations", (db) => insertLedgerTransaction(db, transaction));
}

export async function updateWorkerTaskToPostgres(id: string, task: Omit<WorkerTask, "id">) {
  return transactionPostgres("operations", async (db) => {
    const batchId = cleanText(task.batchId);
    let design = cleanText(task.design);

    if (batchId) {
      const batchRows = await db.query<ProductionBatchRow>(
        `
          SELECT id, design, planned_pairs, finished_pairs, in_progress_pairs, rejected_pairs, raw_material_used, status
          FROM production_batches
          WHERE id = $1
          LIMIT 1
        `,
        [batchId],
      );

      if (!batchRows[0]) {
        throw new Error("Production batch was not found.");
      }

      design = batchRows[0].design;
    }

    if (!design) {
      throw new Error("Design name is required.");
    }

    const rows = await db.query<WorkerTaskRow>(
      `
        UPDATE worker_tasks
        SET worker_name = $2, station = $3, batch_id = $4, design = $5, target_pairs = $6,
          completed_pairs = $7, status = $8, camera_zone = $9, updated_at = now()
        WHERE id = $1
        RETURNING id, worker_name, station, batch_id, design, target_pairs, completed_pairs, status, camera_zone
      `,
      [
        id,
        cleanText(task.workerName),
        task.station,
        batchId || null,
        design,
        cleanNumber(task.targetPairs),
        cleanNumber(task.completedPairs),
        task.status,
        cleanText(task.cameraZone),
      ],
    );

    if (!rows[0]) {
      throw new Error("Worker task was not found.");
    }

    return workerTaskFromRow(rows[0]);
  });
}

export async function updateFinishedStockToPostgres(id: string, stock: Omit<FinishedStock, "id">) {
  const rows = await queryPostgres<FinishedStockRow>(
    "operations",
    `
      UPDATE finished_stock
      SET design = $2, channel = $3, size_run = $4, stock_pairs = $5, sold_pairs = $6,
        returned_pairs = $7, updated_at = now()
      WHERE id = $1
      RETURNING id, design, channel, size_run, stock_pairs, sold_pairs, returned_pairs
    `,
    [
      id,
      cleanText(stock.design),
      stock.channel,
      cleanText(stock.sizeRun) || "Mixed",
      cleanNumber(stock.stockPairs),
      cleanNumber(stock.soldPairs),
      cleanNumber(stock.returnedPairs),
    ],
  );

  if (!rows[0]) {
    throw new Error("Finished stock was not found.");
  }

  return finishedStockFromRow(rows[0]);
}

export async function updateRawMaterialToPostgres(id: string, material: Omit<RawMaterial, "id">) {
  const rows = await queryPostgres<RawMaterialRow>(
    "operations",
    `
      UPDATE raw_materials
      SET name = $2, unit = $3, opening_stock = $4, used = $5, received = $6, reorder_level = $7
      WHERE id = $1
      RETURNING id, name, unit, opening_stock, used, received, reorder_level
    `,
    [
      id,
      cleanText(material.name),
      material.unit,
      cleanNumber(material.openingStock),
      cleanNumber(material.used),
      cleanNumber(material.received),
      cleanNumber(material.reorderLevel),
    ],
  );

  if (!rows[0]) {
    throw new Error("Raw material was not found.");
  }

  return rawMaterialFromRow(rows[0]);
}

export async function updateProductionBatchToPostgres(id: string, batch: Omit<ProductionBatch, "id">) {
  const rows = await queryPostgres<ProductionBatchRow>(
    "operations",
    `
      UPDATE production_batches
      SET design = $2, planned_pairs = $3, finished_pairs = $4, in_progress_pairs = $5,
        rejected_pairs = $6, raw_material_used = $7, status = $8, updated_at = now()
      WHERE id = $1
      RETURNING id, design, planned_pairs, finished_pairs, in_progress_pairs, rejected_pairs, raw_material_used, status
    `,
    [
      id,
      cleanText(batch.design),
      cleanNumber(batch.plannedPairs),
      cleanNumber(batch.finishedPairs),
      cleanNumber(batch.inProgressPairs),
      cleanNumber(batch.rejectedPairs),
      batch.rawMaterialUsed.filter(Boolean),
      batch.status,
    ],
  );

  if (!rows[0]) {
    throw new Error("Production batch was not found.");
  }

  return productionBatchFromRow(rows[0]);
}

export async function updateVehicleDispatchToPostgres(
  id: string,
  dispatch: Omit<VehicleDispatch, "id">,
) {
  const rows = await queryPostgres<VehicleDispatchRow>(
    "operations",
    `
      UPDATE vehicle_dispatches
      SET vehicle_number = $2, driver_name = $3, market_route = $4, loaded_pairs = $5,
        returned_pairs = $6, cash_collected = $7, cheque_collected = $8, credit_amount = $9,
        status = $10, updated_at = now()
      WHERE id = $1
      RETURNING id, vehicle_number, driver_name, market_route, loaded_pairs, returned_pairs,
        cash_collected, cheque_collected, credit_amount, status
    `,
    [
      id,
      cleanText(dispatch.vehicleNumber),
      cleanText(dispatch.driverName),
      cleanText(dispatch.marketRoute),
      cleanNumber(dispatch.loadedPairs),
      cleanNumber(dispatch.returnedPairs),
      cleanNumber(dispatch.cashCollected),
      cleanNumber(dispatch.chequeCollected),
      cleanNumber(dispatch.creditAmount),
      dispatch.status,
    ],
  );

  if (!rows[0]) {
    throw new Error("Vehicle dispatch was not found.");
  }

  return vehicleDispatchFromRow(rows[0]);
}

export async function updateCustomerLedgerToPostgres(
  id: string,
  ledger: Omit<CustomerLedger, "id" | "lastTransaction">,
) {
  const rows = await queryPostgres<CustomerLedgerRow>(
    "operations",
    `
      UPDATE customer_ledgers
      SET customer_name = $2, channel = $3, phone = $4, cash_paid = $5, cheque_paid = $6,
        credit_given = $7, balance_due = $8, credit_limit = $9, last_transaction = $10, updated_at = now()
      WHERE id = $1
      RETURNING id, customer_name, channel, phone, cash_paid, cheque_paid, credit_given, balance_due, credit_limit, last_transaction
    `,
    [
      id,
      cleanText(ledger.customerName),
      ledger.channel,
      cleanText(ledger.phone),
      cleanNumber(ledger.cashPaid),
      cleanNumber(ledger.chequePaid),
      cleanNumber(ledger.creditGiven),
      cleanNumber(ledger.balanceDue),
      cleanNumber(ledger.creditLimit),
      today(),
    ],
  );

  if (!rows[0]) {
    throw new Error("Customer ledger was not found.");
  }

  return customerLedgerFromRow(rows[0]);
}

export async function updateProductionBatchStatusToPostgres(
  id: string,
  status: ProductionBatch["status"],
) {
  const rows = await queryPostgres<ProductionBatchRow>(
    "operations",
    `
      UPDATE production_batches
      SET status = $2, updated_at = now()
      WHERE id = $1
      RETURNING id, design, planned_pairs, finished_pairs, in_progress_pairs, rejected_pairs, raw_material_used, status
    `,
    [id, status],
  );

  if (!rows[0]) {
    throw new Error("Production batch was not found.");
  }

  return productionBatchFromRow(rows[0]);
}

export async function updateVehicleDispatchStatusToPostgres(
  id: string,
  status: VehicleDispatch["status"],
) {
  const rows = await queryPostgres<VehicleDispatchRow>(
    "operations",
    `
      UPDATE vehicle_dispatches
      SET status = $2, updated_at = now()
      WHERE id = $1
      RETURNING id, vehicle_number, driver_name, market_route, loaded_pairs, returned_pairs,
        cash_collected, cheque_collected, credit_amount, status
    `,
    [id, status],
  );

  if (!rows[0]) {
    throw new Error("Vehicle dispatch was not found.");
  }

  return vehicleDispatchFromRow(rows[0]);
}

export async function updateWorkerTaskStatusToPostgres(id: string, status: WorkerTask["status"]) {
  const rows = await queryPostgres<WorkerTaskRow>(
    "operations",
    `
      UPDATE worker_tasks
      SET status = $2, updated_at = now()
      WHERE id = $1
      RETURNING id, worker_name, station, batch_id, design, target_pairs, completed_pairs, status, camera_zone
    `,
    [id, status],
  );

  if (!rows[0]) {
    throw new Error("Worker task was not found.");
  }

  return workerTaskFromRow(rows[0]);
}

async function deleteStockMovement(db: PostgresExecutor, id: string) {
  const movementRows = await db.query<StockMovementRow>(
    `
      SELECT id, created_at, design, channel, type, pairs, note
      FROM stock_movements
      WHERE id = $1
      LIMIT 1
      FOR UPDATE
    `,
    [id],
  );
  const movement = movementRows[0] ? stockMovementFromRow(movementRows[0]) : null;

  if (movement) {
    const stockRows = await db.query<FinishedStockRow>(
      `
        SELECT id, design, channel, size_run, stock_pairs, sold_pairs, returned_pairs
        FROM finished_stock
        WHERE lower(design) = lower($1) AND channel = $2
        ORDER BY CASE WHEN size_run = 'Mixed' THEN 0 ELSE 1 END, created_at DESC
        LIMIT 1
        FOR UPDATE
      `,
      [movement.design, movement.channel],
    );

    if (stockRows[0]) {
      await updateFinishedStockTotals(
        db,
        reverseStockMovement(finishedStockFromRow(stockRows[0]), movement),
      );
    }
  }

  await db.query<{ id: string }>(
    `
      UPDATE vehicle_dispatch_items
      SET stock_movement_ids = array_remove(stock_movement_ids, $1)
      WHERE $1 = ANY(stock_movement_ids)
      RETURNING id
    `,
    [id],
  );
  await db.query<{ id: string }>("DELETE FROM stock_movements WHERE id = $1 RETURNING id", [id]);
}

async function deleteLedgerTransaction(db: PostgresExecutor, id: string) {
  const transactionRows = await db.query<LedgerTransactionRow>(
    `
      SELECT id, created_at, ledger_id, customer_name, type, amount, note
      FROM ledger_transactions
      WHERE id = $1
      LIMIT 1
      FOR UPDATE
    `,
    [id],
  );
  const transaction = transactionRows[0] ? ledgerTransactionFromRow(transactionRows[0]) : null;

  if (transaction) {
    const ledgerRows = await db.query<CustomerLedgerRow>(
      `
        SELECT id, customer_name, channel, phone, cash_paid, cheque_paid, credit_given, balance_due, credit_limit, last_transaction
        FROM customer_ledgers
        WHERE id = $1
        LIMIT 1
        FOR UPDATE
      `,
      [transaction.ledgerId],
    );

    if (ledgerRows[0]) {
      await updateCustomerLedgerTotals(
        db,
        reverseLedgerTransaction(customerLedgerFromRow(ledgerRows[0]), transaction),
      );
    }
  }

  await db.query<{ id: string }>("DELETE FROM ledger_transactions WHERE id = $1 RETURNING id", [id]);
}

async function deleteMaterialConsumption(db: PostgresExecutor, id: string) {
  const rows = await db.query<MaterialConsumptionRow>(
    `
      SELECT id, created_at, batch_id, batch_design, material_id, material_name, unit, quantity, wastage, note
      FROM material_consumptions
      WHERE id = $1
      LIMIT 1
      FOR UPDATE
    `,
    [id],
  );
  const consumption = rows[0] ? materialConsumptionFromRow(rows[0]) : null;

  if (consumption?.materialId) {
    await db.query<{ id: string }>(
      `
        UPDATE raw_materials
        SET used = greatest(0, used - $2)
        WHERE id = $1
        RETURNING id
      `,
      [consumption.materialId, consumption.quantity + consumption.wastage],
    );
  }

  await db.query<{ id: string }>("DELETE FROM material_consumptions WHERE id = $1 RETURNING id", [id]);
}

async function deleteVehicleDispatchItem(db: PostgresExecutor, id: string) {
  const rows = await db.query<VehicleDispatchItemRow>(
    `
      SELECT id, created_at, dispatch_id, vehicle_number, market_route, design, channel, size_run,
        loaded_pairs, sold_pairs, returned_pairs, cash_collected, cheque_collected, credit_amount, stock_movement_ids, note
      FROM vehicle_dispatch_items
      WHERE id = $1
      LIMIT 1
      FOR UPDATE
    `,
    [id],
  );
  const item = rows[0] ? vehicleDispatchItemFromRow(rows[0]) : null;

  if (item) {
    for (const movementId of item.stockMovementIds) {
      await deleteStockMovement(db, movementId);
    }

    await db.query<{ id: string }>(
      `
        UPDATE vehicle_dispatches
        SET loaded_pairs = greatest(0, loaded_pairs - $2),
          returned_pairs = greatest(0, returned_pairs - $3),
          cash_collected = greatest(0, cash_collected - $4),
          cheque_collected = greatest(0, cheque_collected - $5),
          credit_amount = greatest(0, credit_amount - $6),
          updated_at = now()
        WHERE id = $1
        RETURNING id
      `,
      [
        item.dispatchId,
        item.loadedPairs,
        item.returnedPairs,
        item.cashCollected,
        item.chequeCollected,
        item.creditAmount,
      ],
    );
  }

  await db.query<{ id: string }>("DELETE FROM vehicle_dispatch_items WHERE id = $1 RETURNING id", [id]);
}

async function deleteVehicleDispatch(db: PostgresExecutor, id: string) {
  const itemRows = await db.query<{ id: string }>(
    `
      SELECT id
      FROM vehicle_dispatch_items
      WHERE dispatch_id = $1
      ORDER BY created_at DESC
      FOR UPDATE
    `,
    [id],
  );

  for (const item of itemRows) {
    await deleteVehicleDispatchItem(db, item.id);
  }

  await db.query<{ id: string }>("DELETE FROM vehicle_dispatches WHERE id = $1 RETURNING id", [id]);
}

async function deleteProductionBatch(db: PostgresExecutor, id: string) {
  const rows = await db.query<MaterialConsumptionRow>(
    `
      SELECT id, created_at, batch_id, batch_design, material_id, material_name, unit, quantity, wastage, note
      FROM material_consumptions
      WHERE batch_id = $1
      FOR UPDATE
    `,
    [id],
  );

  for (const row of rows) {
    const consumption = materialConsumptionFromRow(row);

    if (consumption.materialId) {
      await db.query<{ id: string }>(
        `
          UPDATE raw_materials
          SET used = greatest(0, used - $2)
          WHERE id = $1
          RETURNING id
        `,
        [consumption.materialId, consumption.quantity + consumption.wastage],
      );
    }
  }

  await db.query<{ id: string }>("DELETE FROM material_consumptions WHERE batch_id = $1 RETURNING id", [id]);
  await db.query<{ id: string }>("DELETE FROM production_batches WHERE id = $1 RETURNING id", [id]);
}

export async function deleteOperationRecordFromPostgres(kind: OperationRecordKind, id: string) {
  if (kind === "stockMovement") {
    await transactionPostgres("operations", (db) => deleteStockMovement(db, id));
    return;
  }

  if (kind === "ledgerTransaction") {
    await transactionPostgres("operations", (db) => deleteLedgerTransaction(db, id));
    return;
  }

  if (kind === "materialConsumption") {
    await transactionPostgres("operations", (db) => deleteMaterialConsumption(db, id));
    return;
  }

  if (kind === "vehicleDispatchItem") {
    await transactionPostgres("operations", (db) => deleteVehicleDispatchItem(db, id));
    return;
  }

  if (kind === "vehicleDispatch") {
    await transactionPostgres("operations", (db) => deleteVehicleDispatch(db, id));
    return;
  }

  if (kind === "productionBatch") {
    await transactionPostgres("operations", (db) => deleteProductionBatch(db, id));
    return;
  }

  const tableByKind: Record<
    Exclude<
      OperationRecordKind,
      | "stockMovement"
      | "ledgerTransaction"
      | "materialConsumption"
      | "vehicleDispatchItem"
      | "vehicleDispatch"
      | "productionBatch"
    >,
    string
  > = {
    rawMaterial: "raw_materials",
    workerTask: "worker_tasks",
    finishedStock: "finished_stock",
    customerLedger: "customer_ledgers",
  };

  await queryPostgres<{ id: string }>(
    "operations",
    `DELETE FROM ${tableByKind[kind]} WHERE id = $1 RETURNING id`,
    [id],
  );
}
