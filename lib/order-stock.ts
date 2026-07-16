import type { Product } from "@/lib/products";
import type { CheckoutItemInput } from "@/lib/order-pricing-types";

export type StockShortfall = {
  productId: string;
  productName: string;
  requested: number;
  available: number;
};

// Deliberately free of any server-only import (no product store, no fs, no pg)
// so the cart can run the exact same availability rule the checkout enforces.
// If this drifts, the shop tells a customer one thing and the server another.
export function findStockShortfalls(
  products: Product[],
  items: CheckoutItemInput[],
): StockShortfall[] {
  const productById = new Map(products.map((product) => [product.id, product]));
  const requestedById = new Map<string, number>();

  for (const item of items) {
    requestedById.set(item.productId, (requestedById.get(item.productId) ?? 0) + item.quantity);
  }

  const shortfalls: StockShortfall[] = [];

  for (const [productId, requested] of requestedById) {
    const product = productById.get(productId);

    // Unknown products are reported by matchedItems/unknownItems, not here.
    if (!product) {
      continue;
    }

    const available = Math.max(0, product.stock);

    if (requested > available) {
      shortfalls.push({
        productId,
        productName: product.name,
        requested,
        available,
      });
    }
  }

  return shortfalls;
}

export function describeStockShortfalls(shortfalls: StockShortfall[]) {
  return shortfalls
    .map((shortfall) =>
      shortfall.available === 0
        ? `${shortfall.productName} is out of stock`
        : `${shortfall.productName} has only ${shortfall.available} left (you asked for ${shortfall.requested})`,
    )
    .join(". ");
}
