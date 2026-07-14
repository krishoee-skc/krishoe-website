import { requireAdminPermission } from "@/lib/admin-permissions";
import { csvResponse, toCsv } from "@/lib/csv";
import { getOperationsSnapshot } from "@/lib/operations";

export const dynamic = "force-dynamic";

const exportTypes = [
  "production-insights",
  "worker-tasks",
  "material-consumptions",
  "vehicle-dispatch-items",
  "stock-movements",
  "stock-ledger-summary",
  "stock-health",
  "stock-flow-summary",
  "finished-stock",
  "ledger-aging",
  "ledger-followups",
  "ledger-transactions",
] as const;

type ExportType = (typeof exportTypes)[number];

function isExportType(value: string | null): value is ExportType {
  return exportTypes.includes(value as ExportType);
}

function datedFilename(name: string) {
  return `krishoe-${name}-${new Date().toISOString().slice(0, 10)}.csv`;
}

export async function GET(request: Request) {
  await requireAdminPermission("exports:read");

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  if (!isExportType(type)) {
    return Response.json(
      { error: "Invalid operations export type.", validTypes: exportTypes },
      { status: 400 },
    );
  }

  const snapshot = await getOperationsSnapshot();

  if (type === "production-insights") {
    return csvResponse(
      datedFilename("production-insights"),
      toCsv(
        [
          "id",
          "design",
          "status",
          "linkedTaskCount",
          "workerTargetPairs",
          "workerCompletedPairs",
          "workerProgressRate",
          "productionCompletionRate",
          "rejectRate",
          "materialCount",
          "missingRawMaterials",
        ],
        snapshot.reports.productionInsights.map((batch) => [
          batch.id,
          batch.design,
          batch.status,
          batch.linkedTaskCount,
          batch.workerTargetPairs,
          batch.workerCompletedPairs,
          batch.workerProgressRate,
          batch.productionCompletionRate,
          batch.rejectRate,
          batch.materialCount,
          batch.missingRawMaterials.join(", "),
        ]),
      ),
    );
  }

  if (type === "stock-movements") {
    return csvResponse(
      datedFilename("stock-movements"),
      toCsv(
        ["id", "createdAt", "design", "channel", "type", "pairs", "note"],
        snapshot.stockMovements.map((movement) => [
          movement.id,
          movement.createdAt,
          movement.design,
          movement.channel,
          movement.type,
          movement.pairs,
          movement.note,
        ]),
      ),
    );
  }

  if (type === "stock-flow-summary") {
    return csvResponse(
      datedFilename("stock-flow-summary"),
      toCsv(
        [
          "design",
          "channel",
          "totalPairs",
          "productionIn",
          "dispatchOut",
          "returnIn",
          "saleOut",
          "marketSale",
          "adjustment",
          "netStockFlow",
          "soldPairs",
          "returnedPairs",
        ],
        snapshot.reports.stockMovementByDesignChannel.map((flow) => [
          flow.design,
          flow.channel,
          flow.totalPairs,
          flow.productionIn,
          flow.dispatchOut,
          flow.returnIn,
          flow.saleOut,
          flow.marketSale,
          flow.adjustment,
          flow.netStockFlow,
          flow.soldPairs,
          flow.returnedPairs,
        ]),
      ),
    );
  }

  if (type === "stock-ledger-summary") {
    return csvResponse(
      datedFilename("stock-ledger-summary"),
      toCsv(
        [
          "id",
          "design",
          "channel",
          "sizeRun",
          "bookStockPairs",
          "movementStockPairs",
          "variancePairs",
          "movementCount",
          "lastMovementAt",
          "productionIn",
          "dispatchOut",
          "returnIn",
          "saleOut",
          "marketSale",
          "adjustment",
          "soldPairs",
          "returnedPairs",
          "sellThroughRate",
          "returnRate",
          "healthSignal",
          "ledgerSignal",
          "nextAction",
        ],
        snapshot.reports.stockLedgerRows.map((row) => [
          row.id,
          row.design,
          row.channel,
          row.sizeRun,
          row.stockPairs,
          row.movementStockPairs,
          row.variancePairs,
          row.movementCount,
          row.lastMovementAt,
          row.productionIn,
          row.dispatchOut,
          row.returnIn,
          row.saleOut,
          row.marketSale,
          row.adjustment,
          row.soldPairs,
          row.returnedPairs,
          row.sellThroughRate,
          row.returnRate,
          row.healthSignal,
          row.signal,
          row.nextAction,
        ]),
      ),
    );
  }

  if (type === "stock-health") {
    return csvResponse(
      datedFilename("stock-health"),
      toCsv(
        [
          "id",
          "design",
          "channel",
          "sizeRun",
          "stockPairs",
          "soldPairs",
          "returnedPairs",
          "stockInflow",
          "stockOutflow",
          "netStockFlow",
          "sellThroughRate",
          "returnRate",
          "signal",
        ],
        snapshot.reports.stockHealthRows.map((stock) => [
          stock.id,
          stock.design,
          stock.channel,
          stock.sizeRun,
          stock.stockPairs,
          stock.soldPairs,
          stock.returnedPairs,
          stock.stockInflow,
          stock.stockOutflow,
          stock.netStockFlow,
          stock.sellThroughRate,
          stock.returnRate,
          stock.signal,
        ]),
      ),
    );
  }

  if (type === "vehicle-dispatch-items") {
    return csvResponse(
      datedFilename("vehicle-dispatch-items"),
      toCsv(
        [
          "id",
          "createdAt",
          "dispatchId",
          "vehicleNumber",
          "marketRoute",
          "design",
          "channel",
          "sizeRun",
          "loadedPairs",
          "soldPairs",
          "returnedPairs",
          "cashCollected",
          "chequeCollected",
          "creditAmount",
          "stockMovementIds",
          "note",
        ],
        snapshot.vehicleDispatchItems.map((item) => [
          item.id,
          item.createdAt,
          item.dispatchId,
          item.vehicleNumber,
          item.marketRoute,
          item.design,
          item.channel,
          item.sizeRun,
          item.loadedPairs,
          item.soldPairs,
          item.returnedPairs,
          item.cashCollected,
          item.chequeCollected,
          item.creditAmount,
          item.stockMovementIds.join("|"),
          item.note,
        ]),
      ),
    );
  }

  if (type === "material-consumptions") {
    return csvResponse(
      datedFilename("material-consumptions"),
      toCsv(
        [
          "id",
          "createdAt",
          "batchId",
          "batchDesign",
          "materialId",
          "materialName",
          "unit",
          "quantity",
          "wastage",
          "note",
        ],
        snapshot.materialConsumptions.map((consumption) => [
          consumption.id,
          consumption.createdAt,
          consumption.batchId,
          consumption.batchDesign,
          consumption.materialId,
          consumption.materialName,
          consumption.unit,
          consumption.quantity,
          consumption.wastage,
          consumption.note,
        ]),
      ),
    );
  }

  if (type === "worker-tasks") {
    return csvResponse(
      datedFilename("worker-tasks"),
      toCsv(
        [
          "id",
          "workerName",
          "station",
          "batchId",
          "design",
          "targetPairs",
          "completedPairs",
          "status",
          "cameraZone",
        ],
        snapshot.workerTasks.map((task) => [
          task.id,
          task.workerName,
          task.station,
          task.batchId,
          task.design,
          task.targetPairs,
          task.completedPairs,
          task.status,
          task.cameraZone,
        ]),
      ),
    );
  }

  if (type === "finished-stock") {
    return csvResponse(
      datedFilename("finished-stock"),
      toCsv(
        ["id", "design", "channel", "sizeRun", "stockPairs", "soldPairs", "returnedPairs"],
        snapshot.finishedStock.map((stock) => [
          stock.id,
          stock.design,
          stock.channel,
          stock.sizeRun,
          stock.stockPairs,
          stock.soldPairs,
          stock.returnedPairs,
        ]),
      ),
    );
  }

  if (type === "ledger-aging") {
    return csvResponse(
      datedFilename("ledger-aging"),
      toCsv(
        [
          "id",
          "customerName",
          "channel",
          "phone",
          "cashPaid",
          "chequePaid",
          "creditGiven",
          "balanceDue",
          "lastTransaction",
          "daysOutstanding",
          "agingBucket",
        ],
        snapshot.reports.ledgerAgingRows.map((ledger) => [
          ledger.id,
          ledger.customerName,
          ledger.channel,
          ledger.phone,
          ledger.cashPaid,
          ledger.chequePaid,
          ledger.creditGiven,
          ledger.balanceDue,
          ledger.lastTransaction,
          ledger.daysOutstanding,
          ledger.agingBucket,
        ]),
      ),
    );
  }

  if (type === "ledger-followups") {
    return csvResponse(
      datedFilename("ledger-followups"),
      toCsv(
        [
          "id",
          "customerName",
          "channel",
          "phone",
          "balanceDue",
          "creditGiven",
          "collectionTotal",
          "collectionCoverageRate",
          "lastTransaction",
          "daysOutstanding",
          "agingBucket",
          "priority",
          "followUpDueDate",
          "nextAction",
        ],
        snapshot.reports.ledgerCollectionFollowups.map((ledger) => [
          ledger.id,
          ledger.customerName,
          ledger.channel,
          ledger.phone,
          ledger.balanceDue,
          ledger.creditGiven,
          ledger.collectionTotal,
          ledger.collectionCoverageRate,
          ledger.lastTransaction,
          ledger.daysOutstanding,
          ledger.agingBucket,
          ledger.priority,
          ledger.followUpDueDate,
          ledger.nextAction,
        ]),
      ),
    );
  }

  return csvResponse(
    datedFilename("ledger-transactions"),
    toCsv(
      ["id", "createdAt", "ledgerId", "customerName", "type", "amount", "note"],
      snapshot.ledgerTransactions.map((transaction) => [
        transaction.id,
        transaction.createdAt,
        transaction.ledgerId,
        transaction.customerName,
        transaction.type,
        transaction.amount,
        transaction.note,
      ]),
    ),
  );
}
