import { designKey } from "@/lib/design-name";
import type { OperationsData } from "@/lib/operations";
import type { Product } from "@/lib/products";

export type ReadyStockOrigin = "Manufactured" | "Purchased" | "Mixed" | "Opening / Adjustment";

export type CatalogStockWarning = {
  productId: string;
  productName: string;
  sku: string;
  websiteStock: number;
};

/**
 * Products the shop would sell that trace to no ready-stock pool.
 *
 * The catalog's stock is meant to be the selling face of a real pool — every
 * sellable pair having come from factory production or a purchase, so "in stock
 * on the website" always means "there is a pair to send". A product carrying
 * website stock that matches no finished-stock design has drifted from that: the
 * number promises pairs the ready-stock count cannot account for. That is the
 * exact shape of the drift that once had the shop apologise to a customer for a
 * shoe it actually had — caught here so the owner sees it and decides (log the
 * production or purchase that backs it, or take the phantom number down), rather
 * than the code silently zeroing stock that might be real and unlogged.
 *
 * Draft products are left out — they are not on sale — and matching uses the one
 * canonical design key, so a mere spelling or spacing difference is not read as
 * "no pool".
 */
export function catalogStockWarnings(
  products: Product[],
  finishedStock: OperationsData["finishedStock"],
): CatalogStockWarning[] {
  const poolKeys = new Set(finishedStock.map((row) => designKey(row.design)));

  return products
    .filter((product) => product.status === "Active" && product.stock > 0)
    .filter((product) => {
      const keys = [product.name, product.sku, product.id].map(designKey).filter(Boolean);
      return !keys.some((key) => poolKeys.has(key));
    })
    .map((product) => ({
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      websiteStock: product.stock,
    }))
    .sort((left, right) => right.websiteStock - left.websiteStock);
}

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
