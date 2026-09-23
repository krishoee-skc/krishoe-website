import type { FinishedStock } from "@/lib/operations";
import type { CheckoutItemInput } from "@/lib/order-pricing-types";
import { orderHoldsStock, type ReservingOrder } from "@/lib/order-stock";
import type { Product } from "@/lib/products";
import { availableBySize, isSizeTracked } from "@/lib/stock-by-size";

/**
 * What checkout must know about the size and colour of each pair.
 *
 * Checkout priced a pair and counted its stock by product alone. The size was a
 * free-text field the browser filled in: a cart saved before a size was dropped,
 * or a request typed by hand, could order a size the shoe does not come in; and
 * a size the product page showed as sold out could still be ordered, because
 * only the page — never the server — looked at stock size by size. The customer
 * learnt on the phone that their pair did not exist.
 */

export type SizeShortfall = {
  productId: string;
  productName: string;
  size: string;
  requested: number;
  available: number;
};

export function sizeHoldKey(productId: string, size: string) {
  return `${productId}\u0000${size.trim()}`;
}

/**
 * The first item whose size or colour the product does not offer, as a message
 * the customer can act on; "" when every item is one the shop sells.
 */
export function findInvalidItemOption(items: CheckoutItemInput[], products: Product[]) {
  const productById = new Map(products.map((product) => [product.id, product]));

  for (const item of items) {
    const product = productById.get(item.productId);
    // Unknown or withdrawn products are refused by the caller with their own message.
    if (!product) continue;

    const size = (item.size ?? "").trim();
    if (!product.sizes.some((offered) => offered.trim() === size)) {
      return `${product.name} does not come in size ${size || "(none)"}. Please remove it from your cart and add it again from the product page.`;
    }

    const color = (item.color ?? "").trim();
    if (!product.colors.some((offered) => offered.trim() === color)) {
      return `${product.name} does not come in ${color || "that colour"}. Please remove it from your cart and add it again from the product page.`;
    }
  }

  return "";
}

/** Pairs held by open orders, per product and size — the same hold rule as by product. */
export function reservedBySize(orders: ReservingOrder[], now: Date = new Date()) {
  const reserved = new Map<string, number>();

  for (const order of orders) {
    if (!orderHoldsStock(order.status, order.createdAt, now)) continue;

    for (const item of order.items) {
      const key = sizeHoldKey(item.productId, item.size);
      reserved.set(key, (reserved.get(key) ?? 0) + item.quantity);
    }
  }

  return reserved;
}

/**
 * Sizes asked for beyond what is on the shelf in that size.
 *
 * Judged only for a design whose stock is fully entered size by size — the same
 * gate the product page uses to disable a size. A design still carrying a
 * "Mixed" pile cannot say which sizes it holds, so it is left to the product
 * total, exactly as before: a stock read must never refuse a pair the shop has.
 */
export function findSizeShortfalls(
  items: CheckoutItemInput[],
  products: Product[],
  finishedStock: FinishedStock[],
  reserved: Map<string, number> = new Map(),
): SizeShortfall[] {
  const productById = new Map(products.map((product) => [product.id, product]));
  const requested = new Map<string, { productId: string; size: string; quantity: number }>();

  for (const item of items) {
    const size = (item.size ?? "").trim();
    const key = sizeHoldKey(item.productId, size);
    const current = requested.get(key);
    requested.set(key, {
      productId: item.productId,
      size,
      quantity: (current?.quantity ?? 0) + item.quantity,
    });
  }

  const shortfalls: SizeShortfall[] = [];

  for (const [key, want] of requested) {
    const product = productById.get(want.productId);
    if (!product || !isSizeTracked(finishedStock, product.name)) continue;

    const onShelf = availableBySize(finishedStock, product.name).get(want.size) ?? 0;
    const available = Math.max(0, onShelf - (reserved.get(key) ?? 0));

    if (want.quantity > available) {
      shortfalls.push({
        productId: want.productId,
        productName: product.name,
        size: want.size,
        requested: want.quantity,
        available,
      });
    }
  }

  return shortfalls;
}

export function describeSizeShortfalls(shortfalls: SizeShortfall[]) {
  return shortfalls
    .map((shortfall) =>
      shortfall.available === 0
        ? `${shortfall.productName} in size ${shortfall.size} is sold out`
        : `${shortfall.productName} has only ${shortfall.available} left in size ${shortfall.size} (you asked for ${shortfall.requested})`,
    )
    .join(". ");
}
