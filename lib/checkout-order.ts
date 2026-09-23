import {
  describeSizeShortfalls,
  findInvalidItemOption,
  findSizeShortfalls,
  reservedBySize,
  sizeHoldKey,
  type SizeShortfall,
} from "@/lib/checkout-item-check";
import { evaluateCoupon, getCouponForUpdate, redeemCouponWithExecutor } from "@/lib/coupons";
import { getDataBackend } from "@/lib/data-backend";
import {
  deliveryChargeFor,
  deliveryChargeLine,
  type DeliveryCharge,
  type DeliveryPricing,
} from "@/lib/delivery-fee";
import type { FinishedStock } from "@/lib/operations";
import { computeAuthoritativeOrderTotal } from "@/lib/order-pricing";
import type { CheckoutItemInput } from "@/lib/order-pricing-types";
import {
  describeStockShortfalls,
  UNCONFIRMED_HOLD_HOURS,
  type OrderItem,
  type StockShortfall,
} from "@/lib/order-stock";
import { transactionPostgres, type PostgresExecutor } from "@/lib/postgres/client";
import { formatPrice, type Product } from "@/lib/products";
import {
  recordReferralClaimWithExecutor,
  referralAsCoupon,
  type ReferralLookup,
} from "@/lib/referrals";
import {
  createNewOrderRecord,
  getOrderByCheckoutSubmissionKeyWithExecutor,
  getOrders,
  insertOrderWithExecutor,
  saveOrder,
  type OrderSubmission,
} from "@/lib/submissions";

const STORE = "orders";

type CheckoutOrderInput = {
  checkoutSubmissionKey: string;
  name: string;
  email?: string;
  phone: string;
  address: string;
  delivery: string;
  payment: string;
  items: CheckoutItemInput[];
  submittedCode: string;
  customerUserId?: string;
  referral?: NonNullable<ReferralLookup>;
  /** The storefront catalog, for the sizes and colours each product offers. */
  catalog: Product[];
  /** Size-by-size shelf stock, for designs that are entered that way. */
  finishedStock: FinishedStock[];
  /** The owner's delivery charge, read fresh for this order. */
  deliveryPricing: DeliveryPricing;
};

export type CheckoutOrderPlacement =
  | { ok: true; order: OrderSubmission; replayed: boolean }
  | {
      ok: false;
      reason: "invalid-items" | "stock" | "coupon" | "idempotency";
      message: string;
      shortfalls?: StockShortfall[];
    };

type LockedProductRow = {
  id: string;
  name: string;
  price_value: number | string;
  stock: number | string;
  status: "Active" | "Draft";
};

type ReservedRow = { product_id: string; size: string | null; reserved: number | string };

function cleanCount(value: number | string) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function sameCheckoutBuyer(order: OrderSubmission, input: CheckoutOrderInput) {
  const digits = (value: string) => value.replace(/\D/g, "");
  return digits(order.phone) === digits(input.phone);
}

/** Human-readable copy generated from trusted structured items, never browser text. */
export function canonicalOrderText(items: OrderItem[]) {
  return items
    .map(
      (item, index) =>
        `${index + 1}. ${item.productName} (${item.productId})\n` +
        `   Size: ${item.size} / Color: ${item.color} / Qty: ${item.quantity}\n` +
        `   Line total: ${formatPrice(item.lineTotalPaisa ?? 0)}`,
    )
    .join("\n");
}

/** Applies locked catalog prices to the cart and stores each price snapshot. */
export function priceLockedCheckoutItems(
  items: CheckoutItemInput[],
  products: LockedProductRow[],
) {
  const productById = new Map(products.map((product) => [product.id, product]));
  const orderItems: OrderItem[] = [];
  let subtotalPaisa = 0;

  for (const item of items) {
    const product = productById.get(item.productId);
    if (!product || product.status !== "Active") continue;

    const unitPricePaisa = cleanCount(product.price_value);
    const lineTotalPaisa = unitPricePaisa * item.quantity;
    subtotalPaisa += lineTotalPaisa;
    orderItems.push({
      productId: product.id,
      productName: product.name,
      size: item.size ?? "",
      color: item.color ?? "",
      quantity: item.quantity,
      unitPricePaisa,
      lineTotalPaisa,
    });
  }

  return { orderItems, subtotalPaisa };
}

function invalidItems(message: string): CheckoutOrderPlacement {
  return { ok: false, reason: "invalid-items", message };
}

function stockFailure(shortfalls: StockShortfall[]): CheckoutOrderPlacement {
  return {
    ok: false,
    reason: "stock",
    shortfalls,
    message: `${describeStockShortfalls(shortfalls)}. Please update your cart and try again.`,
  };
}

function sizeStockFailure(shortfalls: SizeShortfall[]): CheckoutOrderPlacement {
  return {
    ok: false,
    reason: "stock",
    message: `${describeSizeShortfalls(shortfalls)}. Please remove it from your cart and choose another size on the product page.`,
  };
}

/**
 * Pairs after any discount, plus delivery. The order text carries the delivery
 * line too, so the order desk and the customer's confirmation email both say
 * what the total is made of.
 */
function orderMoney(
  items: OrderItem[],
  subtotalPaisa: number,
  discountPaisa: number,
  input: CheckoutOrderInput,
) {
  const goodsPaisa = Math.max(0, subtotalPaisa - discountPaisa);
  const delivery: DeliveryCharge = deliveryChargeFor(input.deliveryPricing, input.delivery, goodsPaisa);
  return {
    totalPaisa: goodsPaisa + delivery.feePaisa,
    orderText: `${canonicalOrderText(items)}\n${deliveryChargeLine(delivery)}`,
  };
}

async function placeCheckoutOrderPostgres(
  db: PostgresExecutor,
  input: CheckoutOrderInput,
): Promise<CheckoutOrderPlacement> {
  // A transaction-scoped lock closes the gap between looking for a retry and
  // inserting it. The unique index is the permanent second line of defence.
  await db.query(
    "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
    ["checkout-order", input.checkoutSubmissionKey],
  );

  const existing = await getOrderByCheckoutSubmissionKeyWithExecutor(
    db,
    input.checkoutSubmissionKey,
  );
  if (existing) {
    return sameCheckoutBuyer(existing, input)
      ? { ok: true, order: existing, replayed: true }
      : {
          ok: false,
          reason: "idempotency",
          message: "This checkout retry key belongs to a different order. Please refresh and try again.",
        };
  }

  const productIds = [...new Set(input.items.map((item) => item.productId))].sort();
  const products = await db.query<LockedProductRow>(
    `SELECT id, name, price_value, stock, status
       FROM products
      WHERE id = ANY($1::text[])
      ORDER BY id
      FOR UPDATE`,
    [productIds],
  );

  const activeIds = new Set(
    products.filter((product) => product.status === "Active").map((product) => product.id),
  );
  if (activeIds.size !== productIds.length) {
    return invalidItems("One or more cart items are no longer available. Please refresh and try again.");
  }

  const invalidOption = findInvalidItemOption(input.items, input.catalog);
  if (invalidOption) return invalidItems(invalidOption);

  // The hold rule from lib/order-stock.ts (orderHoldsStock), in SQL: a
  // Contacted order holds its pairs, a New one only for its first
  // UNCONFIRMED_HOLD_HOURS. Grouped by size as well, for the size-wise check.
  const reservedRows = await db.query<ReservedRow>(
    `SELECT oi.product_id, oi.size, sum(oi.quantity)::bigint AS reserved
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
      WHERE oi.product_id = ANY($1::text[])
        AND (
          o.status = 'Contacted'
          OR (o.status = 'New' AND o.created_at > now() - make_interval(hours => $2::int))
        )
      GROUP BY oi.product_id, oi.size`,
    [productIds, UNCONFIRMED_HOLD_HOURS],
  );
  const reserved = new Map<string, number>();
  const reservedSizes = new Map<string, number>();
  for (const row of reservedRows) {
    const count = cleanCount(row.reserved);
    reserved.set(row.product_id, (reserved.get(row.product_id) ?? 0) + count);
    const sizeKey = sizeHoldKey(row.product_id, row.size ?? "");
    reservedSizes.set(sizeKey, (reservedSizes.get(sizeKey) ?? 0) + count);
  }
  const requested = new Map<string, number>();
  for (const item of input.items) {
    requested.set(item.productId, (requested.get(item.productId) ?? 0) + item.quantity);
  }

  const shortfalls = products.flatMap((product): StockShortfall[] => {
    const requestedCount = requested.get(product.id) ?? 0;
    const available = Math.max(0, cleanCount(product.stock) - (reserved.get(product.id) ?? 0));
    return requestedCount > available
      ? [{ productId: product.id, productName: product.name, requested: requestedCount, available }]
      : [];
  });
  if (shortfalls.length > 0) return stockFailure(shortfalls);

  const sizeShortfalls = findSizeShortfalls(
    input.items,
    input.catalog,
    input.finishedStock,
    reservedSizes,
  );
  if (sizeShortfalls.length > 0) return sizeStockFailure(sizeShortfalls);

  const priced = priceLockedCheckoutItems(input.items, products);
  if (priced.orderItems.length !== input.items.length || priced.subtotalPaisa <= 0) {
    return invalidItems("We couldn't verify the items in your cart. Please refresh and try again.");
  }

  const referralCoupon = input.referral
    ? referralAsCoupon(input.referral, input.customerUserId)
    : null;
  const coupon = input.submittedCode
    ? referralCoupon ?? (await getCouponForUpdate(db, input.submittedCode))
    : null;
  const couponCheck = input.submittedCode
    ? evaluateCoupon(coupon, priced.subtotalPaisa)
    : null;

  if (couponCheck && !couponCheck.ok) {
    return { ok: false, reason: "coupon", message: couponCheck.reason };
  }

  const discountPaisa = couponCheck?.ok ? couponCheck.discountPaisa : 0;
  const { totalPaisa, orderText } = orderMoney(
    priced.orderItems,
    priced.subtotalPaisa,
    discountPaisa,
    input,
  );

  if (couponCheck?.ok && !referralCoupon) {
    const redeemed = await redeemCouponWithExecutor(db, couponCheck.coupon.code);
    if (!redeemed) {
      return {
        ok: false,
        reason: "coupon",
        message: "This code was just fully used. Please remove it or choose another code.",
      };
    }
  }

  const record = createNewOrderRecord(
    {
      name: input.name,
      email: input.email,
      phone: input.phone,
      address: input.address,
      delivery: input.delivery,
      payment: input.payment,
      order: orderText,
      items: priced.orderItems,
      total: formatPrice(totalPaisa),
      subtotalPaisa: priced.subtotalPaisa,
      totalPaisa,
      checkoutSubmissionKey: input.checkoutSubmissionKey,
      couponCode: couponCheck?.ok ? couponCheck.coupon.code : undefined,
      discountPaisa,
    },
    input.customerUserId,
  );
  const saved = await insertOrderWithExecutor(db, record);

  if (couponCheck?.ok && input.referral && referralCoupon) {
    await recordReferralClaimWithExecutor(db, {
      orderId: saved.id,
      code: input.referral.code,
      referrerUserId: input.referral.referrerUserId,
      friendUserId: input.customerUserId,
    });
  }

  return { ok: true, order: saved, replayed: false };
}

let localCheckoutQueue: Promise<void> = Promise.resolve();

function inLocalCheckoutQueue<T>(run: () => Promise<T>): Promise<T> {
  const result = localCheckoutQueue.catch(() => undefined).then(run);
  localCheckoutQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function placeCheckoutOrderLocal(input: CheckoutOrderInput): Promise<CheckoutOrderPlacement> {
  return inLocalCheckoutQueue(async () => {
    const existing = (await getOrders()).find(
      (order) => order.checkoutSubmissionKey === input.checkoutSubmissionKey,
    );
    if (existing) {
      return sameCheckoutBuyer(existing, input)
        ? { ok: true as const, order: existing, replayed: true }
        : {
            ok: false as const,
            reason: "idempotency" as const,
            message: "This checkout retry key belongs to a different order. Please refresh and try again.",
          };
    }

    const pricing = await computeAuthoritativeOrderTotal(input.items);
    if (
      pricing.matchedItems !== input.items.length ||
      pricing.unknownItems > 0 ||
      pricing.totalPaisa <= 0
    ) {
      return invalidItems("We couldn't verify the items in your cart. Please refresh and try again.");
    }
    const invalidOption = findInvalidItemOption(input.items, input.catalog);
    if (invalidOption) return invalidItems(invalidOption);
    if (pricing.shortfalls.length > 0) return stockFailure(pricing.shortfalls);

    const sizeShortfalls = findSizeShortfalls(
      input.items,
      input.catalog,
      input.finishedStock,
      reservedBySize(await getOrders()),
    );
    if (sizeShortfalls.length > 0) return sizeStockFailure(sizeShortfalls);

    const referralCoupon = input.referral
      ? referralAsCoupon(input.referral, input.customerUserId)
      : null;
    if (input.submittedCode && !referralCoupon) {
      return {
        ok: false,
        reason: "coupon",
        message: "Discount codes require the PostgreSQL checkout backend.",
      };
    }
    const couponCheck = referralCoupon
      ? evaluateCoupon(referralCoupon, pricing.totalPaisa)
      : null;
    if (couponCheck && !couponCheck.ok) {
      return { ok: false, reason: "coupon", message: couponCheck.reason };
    }

    const discountPaisa = couponCheck?.ok ? couponCheck.discountPaisa : 0;
    const { totalPaisa, orderText } = orderMoney(
      pricing.orderItems,
      pricing.totalPaisa,
      discountPaisa,
      input,
    );
    const order = await saveOrder(
      {
        name: input.name,
        email: input.email,
        phone: input.phone,
        address: input.address,
        delivery: input.delivery,
        payment: input.payment,
        order: orderText,
        items: pricing.orderItems,
        total: formatPrice(totalPaisa),
        subtotalPaisa: pricing.totalPaisa,
        totalPaisa,
        checkoutSubmissionKey: input.checkoutSubmissionKey,
        couponCode: couponCheck?.ok ? couponCheck.coupon.code : undefined,
        discountPaisa,
      },
      input.customerUserId,
    );
    return { ok: true, order, replayed: false };
  });
}

export async function placeCheckoutOrder(
  input: CheckoutOrderInput,
): Promise<CheckoutOrderPlacement> {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(input.checkoutSubmissionKey)) {
    return {
      ok: false,
      reason: "idempotency",
      message: "This checkout page is stale. Please refresh it and try again.",
    };
  }

  return getDataBackend() === "postgres"
    ? transactionPostgres(STORE, (db) => placeCheckoutOrderPostgres(db, input))
    : placeCheckoutOrderLocal(input);
}
