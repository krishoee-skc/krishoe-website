import { getProducts } from "@/lib/product-store";
import { formatPrice } from "@/lib/products";
import { findStockShortfalls } from "@/lib/order-stock";
import type { CheckoutItemInput } from "@/lib/order-pricing-types";

export type { CheckoutItemInput };
export { findStockShortfalls, describeStockShortfalls, type StockShortfall } from "@/lib/order-stock";

// Parse the structured cart items submitted by checkout. Anything malformed is
// dropped so a tampered payload cannot smuggle in a fake price.
export function parseCheckoutItems(raw: string): CheckoutItemInput[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => {
        const record = (item ?? {}) as Record<string, unknown>;
        return {
          productId: typeof record.productId === "string" ? record.productId.trim() : "",
          quantity: Math.max(0, Math.round(Number(record.quantity) || 0)),
        };
      })
      .filter((item) => item.productId && item.quantity > 0);
  } catch {
    return [];
  }
}

// Recompute an order's total on the SERVER from catalog prices. The client-
// submitted total is never trusted — only the productId + quantity are used,
// and the price comes from the server-side product store. This makes total
// tampering impossible: a request can only ever be charged the real catalog
// price for real products.
export async function computeAuthoritativeOrderTotal(items: CheckoutItemInput[]) {
  const products = await getProducts();
  const priceById = new Map(products.map((product) => [product.id, product.priceValue]));

  let totalPaisa = 0;
  let matchedItems = 0;
  let unknownItems = 0;

  for (const item of items) {
    const price = priceById.get(item.productId);

    if (price === undefined) {
      unknownItems += 1;
      continue;
    }

    totalPaisa += price * item.quantity;
    matchedItems += 1;
  }

  return {
    totalPaisa,
    totalLabel: formatPrice(totalPaisa),
    matchedItems,
    unknownItems,
    // Checked here rather than in a second pass so availability is judged
    // against the same catalog read the price came from.
    shortfalls: findStockShortfalls(products, items),
  };
}
