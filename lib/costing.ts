import { getCostingSettings, type CostingSettings, type ProductionStation } from "@/lib/costing-settings";
import { getProducts } from "@/lib/product-store";
import type { Product } from "@/lib/products";
import {
  getOperationsData,
  type FinishedStock,
  type MaterialConsumption,
  type ProductionBatch,
  type WorkerTask,
} from "@/lib/operations";
import { getPosInvoices, type PosInvoice, type PosInvoiceItem } from "@/lib/pos";
import { getPurchasingData, type PurchaseInvoice } from "@/lib/purchasing";

export type MaterialCostRate = {
  materialId: string;
  materialName: string;
  unit: string;
  purchasedQuantity: number;
  purchaseTotal: number;
  averageUnitCost: number;
  invoiceCount: number;
};

export type RawMaterialStockValuationRow = {
  materialId: string;
  materialName: string;
  unit: string;
  openingStock: number;
  received: number;
  used: number;
  balance: number;
  reorderLevel: number;
  averageUnitCost: number;
  stockValue: number;
  reorderShortage: number;
  reorderValue: number;
  invoiceCount: number;
  lowStock: boolean;
  hasPurchaseRate: boolean;
};

export type FinishedStockValuationSignal =
  | "Profit ready"
  | "Needs cost"
  | "Needs price"
  | "Loss risk"
  | "No stock";

export type FinishedStockPriceSource = "POS average" | "Catalog price" | "Missing";

export type CatalogStockReconciliationSignal =
  | "Matched"
  | "Catalog high"
  | "Catalog low"
  | "No operations stock"
  | "No catalog product";

export type FinishedStockValuationRow = {
  stockId: string;
  design: string;
  channel: FinishedStock["channel"];
  sizeRun: string;
  stockPairs: number;
  soldPairs: number;
  returnedPairs: number;
  unitCostPerPair: number;
  catalogPrice: number;
  averageSalePrice: number;
  priceSource: FinishedStockPriceSource;
  stockValue: number;
  potentialRevenue: number;
  potentialGrossProfit: number;
  potentialMarginRate: number;
  missingCostData: boolean;
  missingPriceData: boolean;
  signal: FinishedStockValuationSignal;
};

export type CatalogStockReconciliationRow = {
  key: string;
  productId: string;
  sku: string;
  productName: string;
  productStatus: Product["status"] | "Missing";
  operationsDesign: string;
  catalogStock: number;
  operationsStockPairs: number;
  stockDelta: number;
  catalogPrice: number;
  channelBreakdown: string;
  signal: CatalogStockReconciliationSignal;
};

export type BatchCostingRow = {
  batchId: string;
  design: string;
  status: ProductionBatch["status"];
  plannedPairs: number;
  finishedPairs: number;
  rejectedPairs: number;
  materialCost: number;
  laborCost: number;
  overheadCost: number;
  totalProductionCost: number;
  unitCostPerPair: number;
  consumptionCount: number;
  laborTaskCount: number;
  missingCostMaterials: string[];
  missingLaborStations: ProductionStation[];
  missingOverheadRate: boolean;
};

export type DesignCostingRow = {
  design: string;
  batchCount: number;
  plannedPairs: number;
  finishedPairs: number;
  rejectedPairs: number;
  materialCost: number;
  laborCost: number;
  overheadCost: number;
  productionCost: number;
  unitCostPerPair: number;
  soldPairs: number;
  returnedPairs: number;
  netPairs: number;
  netRevenue: number;
  estimatedCogs: number;
  grossProfit: number;
  grossMarginRate: number;
  missingCostData: boolean;
};

export type CostingPeriodRow = {
  label: "Today" | "This month" | "This year";
  soldPairs: number;
  returnedPairs: number;
  netPairs: number;
  revenue: number;
  estimatedCogs: number;
  grossProfit: number;
  grossMarginRate: number;
};

export type CostingSnapshot = {
  summary: {
    materialPurchaseCost: number;
    materialCost: number;
    laborCost: number;
    overheadCost: number;
    productionCost: number;
    salesRevenue: number;
    estimatedCogs: number;
    grossProfit: number;
    grossMarginRate: number;
    missingCostDesigns: number;
    pricedMaterialCount: number;
    rawMaterialStockValue: number;
    lowStockMaterialValue: number;
    unpricedStockMaterialCount: number;
    finishedStockValue: number;
    finishedStockPotentialRevenue: number;
    finishedStockPotentialProfit: number;
    finishedStockMissingCostCount: number;
    finishedStockMissingPriceCount: number;
    catalogStockMismatchCount: number;
    catalogStockUnmatchedProductCount: number;
    catalogStockUnmatchedOperationsCount: number;
    catalogStockDeltaPairs: number;
  };
  settings: CostingSettings;
  materialCostRates: MaterialCostRate[];
  rawMaterialStockValuation: RawMaterialStockValuationRow[];
  finishedStockValuation: FinishedStockValuationRow[];
  catalogStockReconciliation: CatalogStockReconciliationRow[];
  batchCosting: BatchCostingRow[];
  designCosting: DesignCostingRow[];
  periodReports: CostingPeriodRow[];
};

type DesignSalesGroup = {
  design: string;
  soldPairs: number;
  returnedPairs: number;
  netRevenue: number;
};

function cleanNumber(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value * 100) / 100) : 0;
}

function roundMoney(value: number) {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function roundRate(value: number) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

function normalizeDesign(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized || "Unknown design";
}

function designKey(value: string) {
  return normalizeDesign(value).toLowerCase();
}

function sum<T>(items: T[], selector: (item: T) => number) {
  return items.reduce((total, item) => total + selector(item), 0);
}

export function marginRate(profit: number, revenue: number) {
  if (revenue <= 0) {
    return 0;
  }

  return Math.round((profit / revenue) * 1000) / 10;
}

function isSameDay(value: string) {
  return value.slice(0, 10) === new Date().toISOString().slice(0, 10);
}

function isSameMonth(value: string) {
  return value.slice(0, 7) === new Date().toISOString().slice(0, 7);
}

function isSameYear(value: string) {
  return value.slice(0, 4) === new Date().toISOString().slice(0, 4);
}

export function overheadPerPair(settings: CostingSettings) {
  const monthlyAllocation =
    settings.monthlyCapacityPairs > 0
      ? settings.monthlyFixedOverhead / settings.monthlyCapacityPairs
      : 0;

  return roundRate(
    settings.factoryOverheadPerPair +
      settings.electricityPerPair +
      settings.rentPerPair +
      settings.miscellaneousPerPair +
      monthlyAllocation,
  );
}

// Average unit cost per raw material, from what was actually paid for it.
//
// Trading goods invoices are deliberately skipped. They are finished pairs
// bought to resell, not an input to a production batch: they carry no
// materialId, and their materialName is a shoe design. Left in, each one
// becomes a fake material keyed by design name, inflates materialPurchaseCost
// with money that never bought material, and collides on the empty materialId.
export function buildMaterialCostRates(purchaseInvoices: PurchaseInvoice[]) {
  const groups = new Map<string, MaterialCostRate>();

  for (const invoice of purchaseInvoices) {
    if (invoice.kind === "Trading Goods") {
      continue;
    }

    const key = invoice.materialId || invoice.materialName.toLowerCase();
    const existing = groups.get(key) ?? {
      materialId: invoice.materialId,
      materialName: invoice.materialName,
      unit: invoice.unit,
      purchasedQuantity: 0,
      purchaseTotal: 0,
      averageUnitCost: 0,
      invoiceCount: 0,
    };

    existing.purchasedQuantity += cleanNumber(invoice.quantity);
    existing.purchaseTotal += cleanNumber(invoice.total);
    existing.invoiceCount += 1;
    existing.averageUnitCost =
      existing.purchasedQuantity > 0
        ? roundRate(existing.purchaseTotal / existing.purchasedQuantity)
        : 0;

    groups.set(key, existing);
  }

  return [...groups.values()].sort((a, b) => b.purchaseTotal - a.purchaseTotal);
}

function rawMaterialBalance(material: { openingStock: number; received: number; used: number }) {
  return cleanNumber(material.openingStock) + cleanNumber(material.received) - cleanNumber(material.used);
}

function buildRawMaterialStockValuation(
  rawMaterials: Awaited<ReturnType<typeof getOperationsData>>["rawMaterials"],
  materialRatesById: Map<string, MaterialCostRate>,
) {
  return rawMaterials
    .map((material) => {
      const rate = materialRatesById.get(material.id);
      const balance = Math.max(0, rawMaterialBalance(material));
      const reorderShortage = Math.max(0, cleanNumber(material.reorderLevel) - balance);
      const averageUnitCost = rate?.averageUnitCost ?? 0;

      return {
        materialId: material.id,
        materialName: material.name,
        unit: material.unit,
        openingStock: cleanNumber(material.openingStock),
        received: cleanNumber(material.received),
        used: cleanNumber(material.used),
        balance,
        reorderLevel: cleanNumber(material.reorderLevel),
        averageUnitCost,
        stockValue: roundMoney(balance * averageUnitCost),
        reorderShortage,
        reorderValue: roundMoney(reorderShortage * averageUnitCost),
        invoiceCount: rate?.invoiceCount ?? 0,
        lowStock: balance <= cleanNumber(material.reorderLevel),
        hasPurchaseRate: averageUnitCost > 0,
      } satisfies RawMaterialStockValuationRow;
    })
    .sort((a, b) => {
      if (a.lowStock !== b.lowStock) return a.lowStock ? -1 : 1;
      if (a.hasPurchaseRate !== b.hasPurchaseRate) return a.hasPurchaseRate ? 1 : -1;
      return b.stockValue - a.stockValue;
    });
}

function consumptionCost(
  consumption: MaterialConsumption,
  materialRatesById: Map<string, MaterialCostRate>,
) {
  const materialRate = materialRatesById.get(consumption.materialId);

  if (!materialRate || materialRate.averageUnitCost <= 0) {
    return { cost: 0, missingMaterial: consumption.materialName };
  }

  const consumedQuantity = cleanNumber(consumption.quantity) + cleanNumber(consumption.wastage);
  return { cost: consumedQuantity * materialRate.averageUnitCost, missingMaterial: "" };
}

function buildBatchCosting(
  productionBatches: ProductionBatch[],
  materialConsumptions: MaterialConsumption[],
  workerTasks: WorkerTask[],
  materialRatesById: Map<string, MaterialCostRate>,
  settings: CostingSettings,
) {
  const consumptionsByBatch = new Map<string, MaterialConsumption[]>();
  const tasksByBatch = new Map<string, WorkerTask[]>();
  const batchOverheadPerPair = overheadPerPair(settings);

  for (const consumption of materialConsumptions) {
    const rows = consumptionsByBatch.get(consumption.batchId) ?? [];
    rows.push(consumption);
    consumptionsByBatch.set(consumption.batchId, rows);
  }

  for (const task of workerTasks) {
    const rows = tasksByBatch.get(task.batchId) ?? [];
    rows.push(task);
    tasksByBatch.set(task.batchId, rows);
  }

  return productionBatches
    .map((batch) => {
      const consumptions = consumptionsByBatch.get(batch.id) ?? [];
      const tasks = tasksByBatch.get(batch.id) ?? [];
      const missingCostMaterials = new Set<string>();
      const missingLaborStations = new Set<ProductionStation>();
      const materialCost = sum(consumptions, (consumption) => {
        const result = consumptionCost(consumption, materialRatesById);

        if (result.missingMaterial) {
          missingCostMaterials.add(result.missingMaterial);
        }

        return result.cost;
      });
      const laborCost = sum(tasks, (task) => {
        const completedPairs = cleanNumber(task.completedPairs);
        const rate = settings.laborRates[task.station];

        if (completedPairs > 0 && rate <= 0) {
          missingLaborStations.add(task.station);
        }

        return completedPairs * rate;
      });
      const productionPairs = batch.finishedPairs > 0 ? batch.finishedPairs : batch.plannedPairs;
      const overheadCost = productionPairs * batchOverheadPerPair;
      const totalProductionCost = materialCost + laborCost + overheadCost;

      return {
        batchId: batch.id,
        design: normalizeDesign(batch.design),
        status: batch.status,
        plannedPairs: cleanNumber(batch.plannedPairs),
        finishedPairs: cleanNumber(batch.finishedPairs),
        rejectedPairs: cleanNumber(batch.rejectedPairs),
        materialCost: roundMoney(materialCost),
        laborCost: roundMoney(laborCost),
        overheadCost: roundMoney(overheadCost),
        totalProductionCost: roundMoney(totalProductionCost),
        unitCostPerPair: productionPairs > 0 ? roundRate(totalProductionCost / productionPairs) : 0,
        consumptionCount: consumptions.length,
        laborTaskCount: tasks.length,
        missingCostMaterials: [...missingCostMaterials].sort(),
        missingLaborStations: [...missingLaborStations].sort(),
        missingOverheadRate: productionPairs > 0 && batchOverheadPerPair <= 0,
      };
    })
    .sort((a, b) => b.totalProductionCost - a.totalProductionCost);
}

function allocatedLineRevenue(invoice: PosInvoice, item: PosInvoiceItem) {
  const itemSubtotal = sum(invoice.items, (row) => cleanNumber(row.lineTotal));

  if (itemSubtotal <= 0) {
    return cleanNumber(item.lineTotal);
  }

  return cleanNumber(item.lineTotal) * (cleanNumber(invoice.total) / itemSubtotal);
}

function buildDesignSales(posInvoices: PosInvoice[]) {
  const salesGroups = new Map<string, DesignSalesGroup>();

  for (const invoice of posInvoices) {
    if (invoice.status === "Voided") {
      continue;
    }

    for (const item of invoice.items) {
      const design = normalizeDesign(item.design || item.sku);
      const key = designKey(design);
      const group = salesGroups.get(key) ?? {
        design,
        soldPairs: 0,
        returnedPairs: 0,
        netRevenue: 0,
      };
      const quantity = cleanNumber(item.quantity);
      const revenue = allocatedLineRevenue(invoice, item);

      if (invoice.kind === "Return") {
        group.returnedPairs += quantity;
        group.netRevenue -= revenue;
      } else {
        group.soldPairs += quantity;
        group.netRevenue += revenue;
      }

      salesGroups.set(key, group);
    }
  }

  return salesGroups;
}

export function buildDesignCosting(batchCosting: BatchCostingRow[], designSales: Map<string, DesignSalesGroup>) {
  const groups = new Map<string, DesignCostingRow>();

  for (const batch of batchCosting) {
    const key = designKey(batch.design);
    const existing = groups.get(key) ?? {
      design: batch.design,
      batchCount: 0,
      plannedPairs: 0,
      finishedPairs: 0,
      rejectedPairs: 0,
      materialCost: 0,
      laborCost: 0,
      overheadCost: 0,
      productionCost: 0,
      unitCostPerPair: 0,
      soldPairs: 0,
      returnedPairs: 0,
      netPairs: 0,
      netRevenue: 0,
      estimatedCogs: 0,
      grossProfit: 0,
      grossMarginRate: 0,
      missingCostData: false,
    };

    existing.batchCount += 1;
    existing.plannedPairs += batch.plannedPairs;
    existing.finishedPairs += batch.finishedPairs;
    existing.rejectedPairs += batch.rejectedPairs;
    existing.materialCost += batch.materialCost;
    existing.laborCost += batch.laborCost;
    existing.overheadCost += batch.overheadCost;
    existing.productionCost += batch.totalProductionCost;
    existing.missingCostData =
      existing.missingCostData ||
      batch.missingCostMaterials.length > 0 ||
      batch.missingLaborStations.length > 0 ||
      batch.missingOverheadRate;
    groups.set(key, existing);
  }

  for (const [key, sale] of designSales.entries()) {
    const existing = groups.get(key) ?? {
      design: sale.design,
      batchCount: 0,
      plannedPairs: 0,
      finishedPairs: 0,
      rejectedPairs: 0,
      materialCost: 0,
      laborCost: 0,
      overheadCost: 0,
      productionCost: 0,
      unitCostPerPair: 0,
      soldPairs: 0,
      returnedPairs: 0,
      netPairs: 0,
      netRevenue: 0,
      estimatedCogs: 0,
      grossProfit: 0,
      grossMarginRate: 0,
      missingCostData: true,
    };

    existing.soldPairs += sale.soldPairs;
    existing.returnedPairs += sale.returnedPairs;
    existing.netRevenue += sale.netRevenue;
    groups.set(key, existing);
  }

  return [...groups.values()]
    .map((row) => {
      const costingPairs = row.finishedPairs > 0 ? row.finishedPairs : row.plannedPairs;
      const unitCostPerPair = costingPairs > 0 ? roundRate(row.productionCost / costingPairs) : 0;
      const netPairs = row.soldPairs - row.returnedPairs;
      const estimatedCogs = Math.max(0, netPairs) * unitCostPerPair;
      const grossProfit = row.netRevenue - estimatedCogs;

      return {
        ...row,
        materialCost: roundMoney(row.materialCost),
        laborCost: roundMoney(row.laborCost),
        overheadCost: roundMoney(row.overheadCost),
        productionCost: roundMoney(row.productionCost),
        unitCostPerPair,
        netPairs,
        netRevenue: roundMoney(row.netRevenue),
        estimatedCogs: roundMoney(estimatedCogs),
        grossProfit: roundMoney(grossProfit),
        grossMarginRate: marginRate(grossProfit, row.netRevenue),
        missingCostData: row.missingCostData || (row.soldPairs > 0 && unitCostPerPair <= 0),
      };
    })
    .sort((a, b) => b.netRevenue - a.netRevenue);
}

function buildPeriodReport(
  label: CostingPeriodRow["label"],
  posInvoices: PosInvoice[],
  shouldInclude: (createdAt: string) => boolean,
  unitCostByDesign: Map<string, number>,
) {
  let soldPairs = 0;
  let returnedPairs = 0;
  let revenue = 0;
  let estimatedCogs = 0;

  for (const invoice of posInvoices) {
    if (invoice.status === "Voided" || !shouldInclude(invoice.createdAt)) {
      continue;
    }

    for (const item of invoice.items) {
      const quantity = cleanNumber(item.quantity);
      const lineRevenue = allocatedLineRevenue(invoice, item);
      const unitCost = unitCostByDesign.get(designKey(item.design || item.sku)) ?? 0;

      if (invoice.kind === "Return") {
        returnedPairs += quantity;
        revenue -= lineRevenue;
        estimatedCogs -= quantity * unitCost;
      } else {
        soldPairs += quantity;
        revenue += lineRevenue;
        estimatedCogs += quantity * unitCost;
      }
    }
  }

  const grossProfit = revenue - estimatedCogs;

  return {
    label,
    soldPairs,
    returnedPairs,
    netPairs: soldPairs - returnedPairs,
    revenue: roundMoney(revenue),
    estimatedCogs: roundMoney(estimatedCogs),
    grossProfit: roundMoney(grossProfit),
    grossMarginRate: marginRate(grossProfit, revenue),
  };
}

function buildPeriodReports(posInvoices: PosInvoice[], designCosting: DesignCostingRow[]) {
  const unitCostByDesign = new Map(
    designCosting.map((row) => [designKey(row.design), row.unitCostPerPair]),
  );

  return [
    buildPeriodReport("Today", posInvoices, isSameDay, unitCostByDesign),
    buildPeriodReport("This month", posInvoices, isSameMonth, unitCostByDesign),
    buildPeriodReport("This year", posInvoices, isSameYear, unitCostByDesign),
  ];
}

function buildCatalogPriceByDesign(products: Product[]) {
  const priceByDesign = new Map<string, { price: number; productId: string; sku: string }>();

  for (const product of products) {
    const price = roundRate(product.priceValue / 100);

    if (price <= 0) {
      continue;
    }

    for (const keySource of [product.name, product.sku, product.id]) {
      const key = designKey(keySource);

      if (!priceByDesign.has(key)) {
        priceByDesign.set(key, {
          price,
          productId: product.id,
          sku: product.sku,
        });
      }
    }
  }

  return priceByDesign;
}

function productAliasKeys(product: Product) {
  return [...new Set([product.name, product.sku, product.id].map(designKey))];
}

function stockReconciliationSignal(
  catalogStock: number,
  operationsStockPairs: number,
  hasOperationsStock: boolean,
): CatalogStockReconciliationSignal {
  if (!hasOperationsStock) return "No operations stock";
  if (catalogStock === operationsStockPairs) return "Matched";
  return catalogStock > operationsStockPairs ? "Catalog high" : "Catalog low";
}

function buildCatalogStockReconciliation(
  products: Product[],
  finishedStock: FinishedStock[],
) {
  const signalRank: Record<CatalogStockReconciliationSignal, number> = {
    "No catalog product": 0,
    "No operations stock": 1,
    "Catalog high": 2,
    "Catalog low": 3,
    Matched: 4,
  };
  const stockGroups = new Map<
    string,
    {
      key: string;
      design: string;
      stockPairs: number;
      channelTotals: Map<FinishedStock["channel"], number>;
    }
  >();

  for (const stock of finishedStock) {
    const key = designKey(stock.design);
    const group =
      stockGroups.get(key) ??
      {
        key,
        design: normalizeDesign(stock.design),
        stockPairs: 0,
        channelTotals: new Map<FinishedStock["channel"], number>(),
      };

    group.stockPairs += cleanNumber(stock.stockPairs);
    group.channelTotals.set(
      stock.channel,
      (group.channelTotals.get(stock.channel) ?? 0) + cleanNumber(stock.stockPairs),
    );
    stockGroups.set(key, group);
  }

  const matchedOperationKeys = new Set<string>();
  const productRows: CatalogStockReconciliationRow[] = products.map((product) => {
    const matchedGroups = productAliasKeys(product)
      .map((key) => stockGroups.get(key))
      .filter((group): group is NonNullable<typeof group> => Boolean(group));
    const uniqueGroups = [...new Map(matchedGroups.map((group) => [group.key, group])).values()];
    const operationsStockPairs = sum(uniqueGroups, (group) => group.stockPairs);
    const channelBreakdown = uniqueGroups
      .flatMap((group) =>
        [...group.channelTotals.entries()].map(([channel, pairs]) => `${channel}: ${pairs}`),
      )
      .join(" | ");

    for (const group of uniqueGroups) {
      matchedOperationKeys.add(group.key);
    }

    return {
      key: `product:${product.id}`,
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      productStatus: product.status,
      operationsDesign: uniqueGroups.map((group) => group.design).join(" | "),
      catalogStock: cleanNumber(product.stock),
      operationsStockPairs,
      stockDelta: cleanNumber(product.stock) - operationsStockPairs,
      catalogPrice: roundRate(product.priceValue / 100),
      channelBreakdown: channelBreakdown || "-",
      signal: stockReconciliationSignal(cleanNumber(product.stock), operationsStockPairs, uniqueGroups.length > 0),
    } satisfies CatalogStockReconciliationRow;
  });

  const operationsOnlyRows: CatalogStockReconciliationRow[] = [...stockGroups.values()]
    .filter((group) => !matchedOperationKeys.has(group.key))
    .map((group) => ({
      key: `operations:${group.key}`,
      productId: "",
      sku: "",
      productName: "",
      productStatus: "Missing",
      operationsDesign: group.design,
      catalogStock: 0,
      operationsStockPairs: group.stockPairs,
      stockDelta: -group.stockPairs,
      catalogPrice: 0,
      channelBreakdown: [...group.channelTotals.entries()]
        .map(([channel, pairs]) => `${channel}: ${pairs}`)
        .join(" | "),
      signal: "No catalog product",
    }) satisfies CatalogStockReconciliationRow);

  return productRows.concat(operationsOnlyRows).sort((a, b) => {
    if (a.signal !== b.signal) return signalRank[a.signal] - signalRank[b.signal];
    return Math.abs(b.stockDelta) - Math.abs(a.stockDelta);
  });
}

function finishedStockSignal({
  stockPairs,
  missingCostData,
  missingPriceData,
  potentialGrossProfit,
}: Pick<
  FinishedStockValuationRow,
  "stockPairs" | "missingCostData" | "missingPriceData" | "potentialGrossProfit"
>): FinishedStockValuationSignal {
  if (stockPairs <= 0) return "No stock";
  if (missingCostData) return "Needs cost";
  if (missingPriceData) return "Needs price";
  if (potentialGrossProfit < 0) return "Loss risk";
  return "Profit ready";
}

function buildFinishedStockValuation(
  finishedStock: FinishedStock[],
  designCosting: DesignCostingRow[],
  products: Product[],
) {
  const signalRank: Record<FinishedStockValuationSignal, number> = {
    "Needs cost": 0,
    "Needs price": 1,
    "Loss risk": 2,
    "Profit ready": 3,
    "No stock": 4,
  };
  const designCostByKey = new Map(designCosting.map((row) => [designKey(row.design), row]));
  const catalogPriceByDesign = buildCatalogPriceByDesign(products);

  return finishedStock
    .map((stock) => {
      const design = normalizeDesign(stock.design);
      const designCost = designCostByKey.get(designKey(design));
      const catalogPrice = catalogPriceByDesign.get(designKey(design))?.price ?? 0;
      const stockPairs = cleanNumber(stock.stockPairs);
      const unitCostPerPair = designCost?.unitCostPerPair ?? 0;
      const posAverageSalePrice =
        designCost && designCost.netPairs > 0
          ? roundRate(designCost.netRevenue / designCost.netPairs)
          : 0;
      const averageSalePrice = posAverageSalePrice > 0 ? posAverageSalePrice : catalogPrice;
      const priceSource: FinishedStockPriceSource =
        posAverageSalePrice > 0 ? "POS average" : catalogPrice > 0 ? "Catalog price" : "Missing";
      const stockValue = roundMoney(stockPairs * unitCostPerPair);
      const potentialRevenue = averageSalePrice > 0 ? roundMoney(stockPairs * averageSalePrice) : 0;
      const potentialGrossProfit =
        averageSalePrice > 0 && unitCostPerPair > 0 ? roundMoney(potentialRevenue - stockValue) : 0;
      const missingCostData = !designCost || designCost.missingCostData || unitCostPerPair <= 0;
      const missingPriceData = averageSalePrice <= 0;
      const rowWithoutSignal = {
        stockId: stock.id,
        design,
        channel: stock.channel,
        sizeRun: stock.sizeRun,
        stockPairs,
        soldPairs: cleanNumber(stock.soldPairs),
        returnedPairs: cleanNumber(stock.returnedPairs),
        unitCostPerPair,
        catalogPrice,
        averageSalePrice,
        priceSource,
        stockValue,
        potentialRevenue,
        potentialGrossProfit,
        potentialMarginRate: marginRate(potentialGrossProfit, potentialRevenue),
        missingCostData,
        missingPriceData,
      };

      return {
        ...rowWithoutSignal,
        signal: finishedStockSignal(rowWithoutSignal),
      } satisfies FinishedStockValuationRow;
    })
    .sort((a, b) => {
      if (a.signal !== b.signal) return signalRank[a.signal] - signalRank[b.signal];
      return b.stockValue - a.stockValue;
    });
}

export async function getCostingSnapshot(): Promise<CostingSnapshot> {
  const [operations, purchasing, posInvoices, settings, products] = await Promise.all([
    getOperationsData(),
    getPurchasingData(),
    getPosInvoices(),
    getCostingSettings(),
    getProducts({ includeDrafts: true }),
  ]);
  const materialCostRates = buildMaterialCostRates(purchasing.purchaseInvoices);
  const materialRatesById = new Map(materialCostRates.map((rate) => [rate.materialId, rate]));
  const rawMaterialStockValuation = buildRawMaterialStockValuation(operations.rawMaterials, materialRatesById);
  const batchCosting = buildBatchCosting(
    operations.productionBatches,
    operations.materialConsumptions,
    operations.workerTasks,
    materialRatesById,
    settings,
  );
  const designSales = buildDesignSales(posInvoices);
  const designCosting = buildDesignCosting(batchCosting, designSales);
  const finishedStockValuation = buildFinishedStockValuation(operations.finishedStock, designCosting, products);
  const catalogStockReconciliation = buildCatalogStockReconciliation(products, operations.finishedStock);
  const periodReports = buildPeriodReports(posInvoices, designCosting);
  const salesRevenue = sum(designCosting, (row) => row.netRevenue);
  const estimatedCogs = sum(designCosting, (row) => row.estimatedCogs);
  const grossProfit = salesRevenue - estimatedCogs;

  return {
    summary: {
      materialPurchaseCost: roundMoney(sum(materialCostRates, (row) => row.purchaseTotal)),
      materialCost: roundMoney(sum(batchCosting, (row) => row.materialCost)),
      laborCost: roundMoney(sum(batchCosting, (row) => row.laborCost)),
      overheadCost: roundMoney(sum(batchCosting, (row) => row.overheadCost)),
      productionCost: roundMoney(sum(batchCosting, (row) => row.totalProductionCost)),
      salesRevenue: roundMoney(salesRevenue),
      estimatedCogs: roundMoney(estimatedCogs),
      grossProfit: roundMoney(grossProfit),
      grossMarginRate: marginRate(grossProfit, salesRevenue),
      missingCostDesigns: designCosting.filter((row) => row.missingCostData).length,
      pricedMaterialCount: materialCostRates.filter((row) => row.averageUnitCost > 0).length,
      rawMaterialStockValue: roundMoney(sum(rawMaterialStockValuation, (row) => row.stockValue)),
      lowStockMaterialValue: roundMoney(sum(rawMaterialStockValuation, (row) => row.reorderValue)),
      unpricedStockMaterialCount: rawMaterialStockValuation.filter(
        (row) => row.balance > 0 && !row.hasPurchaseRate,
      ).length,
      finishedStockValue: roundMoney(sum(finishedStockValuation, (row) => row.stockValue)),
      finishedStockPotentialRevenue: roundMoney(sum(finishedStockValuation, (row) => row.potentialRevenue)),
      finishedStockPotentialProfit: roundMoney(sum(finishedStockValuation, (row) => row.potentialGrossProfit)),
      finishedStockMissingCostCount: finishedStockValuation.filter(
        (row) => row.stockPairs > 0 && row.missingCostData,
      ).length,
      finishedStockMissingPriceCount: finishedStockValuation.filter(
        (row) => row.stockPairs > 0 && row.missingPriceData,
      ).length,
      catalogStockMismatchCount: catalogStockReconciliation.filter((row) => row.signal !== "Matched").length,
      catalogStockUnmatchedProductCount: catalogStockReconciliation.filter(
        (row) => row.signal === "No operations stock",
      ).length,
      catalogStockUnmatchedOperationsCount: catalogStockReconciliation.filter(
        (row) => row.signal === "No catalog product",
      ).length,
      catalogStockDeltaPairs: sum(catalogStockReconciliation, (row) => Math.abs(row.stockDelta)),
    },
    settings,
    materialCostRates,
    rawMaterialStockValuation,
    finishedStockValuation,
    catalogStockReconciliation,
    batchCosting,
    designCosting,
    periodReports,
  };
}
