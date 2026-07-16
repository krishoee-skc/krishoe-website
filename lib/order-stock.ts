import type { Product } from "@/lib/products";
import type { CheckoutItemInput } from "@/lib/order-pricing-types";

export type StockShortfall = {
  productId: string;
  productName: string;
  requested: number;
  available: number;
};

export type OrderItem = {
  productId: string;
  productName: string;
  size: string;
  color: string;
  quantity: number;
};

// An order holds its pairs from the moment it is placed until it is resolved.
// Closed means the goods went out, Cancelled means they never will — either
// way the hold ends, so only these two statuses release stock.
export type ReservingOrder = {
  status: "New" | "Contacted" | "Closed" | "Cancelled";
  items: OrderItem[];
};

export function orderHoldsStock(status: ReservingOrder["status"]) {
  return status === "New" || status === "Contacted";
}

// Pairs spoken for by orders that are still open, per product.
export function reservedByProduct(orders: ReservingOrder[]) {
  const reserved = new Map<string, number>();

  for (const order of orders) {
    if (!orderHoldsStock(order.status)) {
      continue;
    }

    for (const item of order.items) {
      reserved.set(item.productId, (reserved.get(item.productId) ?? 0) + item.quantity);
    }
  }

  return reserved;
}

// Deliberately free of any server-only import (no product store, no fs, no pg)
// so the cart can run the exact same availability rule the checkout enforces.
// If this drifts, the shop tells a customer one thing and the server another.
export function findStockShortfalls(
  products: Product[],
  items: CheckoutItemInput[],
  // Pairs already held by open orders. Catalog stock alone would let two
  // customers both pass on the same last pairs.
  reserved: Map<string, number> = new Map(),
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

    const available = Math.max(0, product.stock - (reserved.get(productId) ?? 0));

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
