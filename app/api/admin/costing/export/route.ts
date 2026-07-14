import { requireAdminPermission } from "@/lib/admin-permissions";
import { getCostingSnapshot } from "@/lib/costing";
import { csvResponse, toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

const exportTypes = [
  "designs",
  "materials",
  "stock-valuation",
  "finished-stock-value",
  "catalog-stock-sync",
  "batches",
  "periods",
] as const;
type ExportType = (typeof exportTypes)[number];

function isExportType(value: string | null): value is ExportType {
  return exportTypes.includes(value as ExportType);
}

function datedFilename(name: string) {
  return `krishoe-costing-${name}-${new Date().toISOString().slice(0, 10)}.csv`;
}

export async function GET(request: Request) {
  await requireAdminPermission("exports:read");

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "designs";

  if (!isExportType(type)) {
    return Response.json(
      { error: "Invalid costing export type.", validTypes: exportTypes },
      { status: 400 },
    );
  }

  const costing = await getCostingSnapshot();

  if (type === "materials") {
    return csvResponse(
      datedFilename("materials"),
      toCsv(
        [
          "materialId",
          "materialName",
          "unit",
          "purchasedQuantity",
          "purchaseTotal",
          "averageUnitCost",
          "invoiceCount",
        ],
        costing.materialCostRates.map((row) => [
          row.materialId,
          row.materialName,
          row.unit,
          row.purchasedQuantity,
          row.purchaseTotal,
          row.averageUnitCost,
          row.invoiceCount,
        ]),
      ),
    );
  }

  if (type === "batches") {
    return csvResponse(
      datedFilename("batches"),
      toCsv(
        [
          "batchId",
          "design",
          "status",
          "plannedPairs",
          "finishedPairs",
          "rejectedPairs",
          "materialCost",
          "laborCost",
          "overheadCost",
          "totalProductionCost",
          "unitCostPerPair",
          "consumptionCount",
          "laborTaskCount",
          "missingCostMaterials",
          "missingLaborStations",
          "missingOverheadRate",
        ],
        costing.batchCosting.map((row) => [
          row.batchId,
          row.design,
          row.status,
          row.plannedPairs,
          row.finishedPairs,
          row.rejectedPairs,
          row.materialCost,
          row.laborCost,
          row.overheadCost,
          row.totalProductionCost,
          row.unitCostPerPair,
          row.consumptionCount,
          row.laborTaskCount,
          row.missingCostMaterials.join("|"),
          row.missingLaborStations.join("|"),
          row.missingOverheadRate ? "yes" : "no",
        ]),
      ),
    );
  }

  if (type === "stock-valuation") {
    return csvResponse(
      datedFilename("stock-valuation"),
      toCsv(
        [
          "materialId",
          "materialName",
          "unit",
          "openingStock",
          "received",
          "used",
          "balance",
          "reorderLevel",
          "averageUnitCost",
          "stockValue",
          "reorderShortage",
          "reorderValue",
          "invoiceCount",
          "lowStock",
          "hasPurchaseRate",
        ],
        costing.rawMaterialStockValuation.map((row) => [
          row.materialId,
          row.materialName,
          row.unit,
          row.openingStock,
          row.received,
          row.used,
          row.balance,
          row.reorderLevel,
          row.averageUnitCost,
          row.stockValue,
          row.reorderShortage,
          row.reorderValue,
          row.invoiceCount,
          row.lowStock ? "yes" : "no",
          row.hasPurchaseRate ? "yes" : "no",
        ]),
      ),
    );
  }

  if (type === "finished-stock-value") {
    return csvResponse(
      datedFilename("finished-stock-value"),
      toCsv(
        [
          "stockId",
          "design",
          "channel",
          "sizeRun",
          "stockPairs",
          "soldPairs",
          "returnedPairs",
          "unitCostPerPair",
          "catalogPrice",
          "averageSalePrice",
          "priceSource",
          "stockValue",
          "potentialRevenue",
          "potentialGrossProfit",
          "potentialMarginRate",
          "missingCostData",
          "missingPriceData",
          "signal",
        ],
        costing.finishedStockValuation.map((row) => [
          row.stockId,
          row.design,
          row.channel,
          row.sizeRun,
          row.stockPairs,
          row.soldPairs,
          row.returnedPairs,
          row.unitCostPerPair,
          row.catalogPrice,
          row.averageSalePrice,
          row.priceSource,
          row.stockValue,
          row.potentialRevenue,
          row.potentialGrossProfit,
          row.potentialMarginRate,
          row.missingCostData ? "yes" : "no",
          row.missingPriceData ? "yes" : "no",
          row.signal,
        ]),
      ),
    );
  }

  if (type === "catalog-stock-sync") {
    return csvResponse(
      datedFilename("catalog-stock-sync"),
      toCsv(
        [
          "key",
          "productId",
          "sku",
          "productName",
          "productStatus",
          "operationsDesign",
          "catalogStock",
          "operationsStockPairs",
          "stockDelta",
          "catalogPrice",
          "channelBreakdown",
          "signal",
        ],
        costing.catalogStockReconciliation.map((row) => [
          row.key,
          row.productId,
          row.sku,
          row.productName,
          row.productStatus,
          row.operationsDesign,
          row.catalogStock,
          row.operationsStockPairs,
          row.stockDelta,
          row.catalogPrice,
          row.channelBreakdown,
          row.signal,
        ]),
      ),
    );
  }

  if (type === "periods") {
    return csvResponse(
      datedFilename("periods"),
      toCsv(
        [
          "label",
          "soldPairs",
          "returnedPairs",
          "netPairs",
          "revenue",
          "estimatedCogs",
          "grossProfit",
          "grossMarginRate",
        ],
        costing.periodReports.map((row) => [
          row.label,
          row.soldPairs,
          row.returnedPairs,
          row.netPairs,
          row.revenue,
          row.estimatedCogs,
          row.grossProfit,
          row.grossMarginRate,
        ]),
      ),
    );
  }

  return csvResponse(
    datedFilename("designs"),
    toCsv(
      [
        "design",
        "batchCount",
        "plannedPairs",
        "finishedPairs",
        "rejectedPairs",
        "materialCost",
        "laborCost",
        "overheadCost",
        "productionCost",
        "unitCostPerPair",
        "soldPairs",
        "returnedPairs",
        "netPairs",
        "netRevenue",
        "estimatedCogs",
        "grossProfit",
        "grossMarginRate",
        "missingCostData",
      ],
      costing.designCosting.map((row) => [
        row.design,
        row.batchCount,
        row.plannedPairs,
        row.finishedPairs,
        row.rejectedPairs,
        row.materialCost,
        row.laborCost,
        row.overheadCost,
        row.productionCost,
        row.unitCostPerPair,
        row.soldPairs,
        row.returnedPairs,
        row.netPairs,
        row.netRevenue,
        row.estimatedCogs,
        row.grossProfit,
        row.grossMarginRate,
        row.missingCostData ? "yes" : "no",
      ]),
    ),
  );
}
