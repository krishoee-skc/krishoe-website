import type { OperationsData } from "@/lib/operations";
import type { Product } from "@/lib/products";

export type ReadyStockOrigin = "Manufactured" | "Purchased" | "Mixed" | "Opening / Adjustment";

export type ReadyStockOverviewRow = OperationsData["finishedStock"][number] & {
  origin: ReadyStockOrigin;
};

function stockFlowKey(value: { design: string; channel: string }) {
  return `${value.design.trim().toLowerCase()}::${value.channel}`;
}

function readyStockOrigin(productionIn: number, purchaseIn: number): ReadyStockOrigin {
  if (productionIn > 0 && purchaseIn > 0) return "Mixed";
  if (productionIn > 0) return "Manufactured";
  if (purchaseIn > 0) return "Purchased";
  return "Opening / Adjustment";
}

export function buildStockOverview(data: OperationsData, products: Product[]) {
  const sourceFlow = new Map<string, { productionIn: number; purchaseIn: number }>();

  for (const movement of data.stockMovements) {
    if (movement.type !== "Production In" && movement.type !== "Purchase In") continue;
    const key = stockFlowKey(movement);
    const current = sourceFlow.get(key) ?? { productionIn: 0, purchaseIn: 0 };

    if (movement.type === "Production In") current.productionIn += movement.pairs;
    if (movement.type === "Purchase In") current.purchaseIn += movement.pairs;
    sourceFlow.set(key, current);
  }

  const readyStock: ReadyStockOverviewRow[] = data.finishedStock
    .map((stock) => {
      const flow = sourceFlow.get(stockFlowKey(stock)) ?? { productionIn: 0, purchaseIn: 0 };
      return { ...stock, origin: readyStockOrigin(flow.productionIn, flow.purchaseIn) };
    })
    .sort((left, right) => right.stockPairs - left.stockPairs || left.design.localeCompare(right.design));

  const rawMaterials = data.rawMaterials
    .map((material) => {
      const onHand = material.openingStock + material.received - material.used;
      return {
        ...material,
        onHand,
        needsReorder: onHand <= material.reorderLevel,
      };
    })
    .sort((left, right) => Number(right.needsReorder) - Number(left.needsReorder) || left.onHand - right.onHand);

  const byOrigin = (origin: ReadyStockOrigin) => readyStock.filter((row) => row.origin === origin);
  const sumPairs = (rows: ReadyStockOverviewRow[]) => rows.reduce((total, row) => total + row.stockPairs, 0);
  const manufactured = byOrigin("Manufactured");
  const purchased = byOrigin("Purchased");
  const mixed = byOrigin("Mixed");
  const opening = byOrigin("Opening / Adjustment");

  return {
    rawMaterials,
    readyStock,
    manufactured,
    purchased,
    mixed,
    opening,
    recentMovements: data.stockMovements.slice(0, 20),
    summary: {
      rawMaterialItems: rawMaterials.length,
      rawMaterialReorderItems: rawMaterials.filter((row) => row.needsReorder).length,
      readyPairs: sumPairs(readyStock),
      manufacturedPairs: sumPairs(manufactured),
      purchasedPairs: sumPairs(purchased),
      mixedPairs: sumPairs(mixed),
      openingPairs: sumPairs(opening),
      sellableCatalogPairs: products.reduce((total, product) => total + product.stock, 0),
      catalogDesigns: products.length,
    },
  };
}
