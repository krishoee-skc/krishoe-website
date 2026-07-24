import { readFile } from "node:fs/promises";
import { writeFileAtomic } from "@/lib/atomic-json";
import path from "node:path";
import { runWithDataBackend } from "@/lib/data-backend";
import { queryPostgres, transactionPostgres } from "@/lib/postgres/client";
import type { OrderItem } from "@/lib/order-stock";

export type { OrderItem };

// Closed means the goods went out and a POS invoice recorded the sale.
// Cancelled means they never will. Both end an order, but only Cancelled
// returns the pairs to stock — see orderHoldsStock in lib/order-stock.ts.
export type OrderStatus = "New" | "Contacted" | "Closed" | "Cancelled";
export type PaymentStatus = "Unpaid" | "Pending" | "Paid" | "Failed" | "Refunded";
export type PaymentProvider = "manual" | "cod" | "esewa" | "khalti" | "bank" | "cash";

export type OrderSubmission = {
  id: string;
  createdAt: string;
  customerUserId?: string;
  name: string;
  email?: string;
  phone: string;
  address: string;
  delivery: string;
  payment: string;
  order: string;
  // What was ordered, structurally. `order` above is the same thing written as
  // a sentence for humans; it cannot be counted, so it cannot reserve stock.
  // Orders placed before this existed have an empty list.
  items: OrderItem[];
  total: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentProvider: PaymentProvider;
  paymentReference?: string;
  paymentTransactionId?: string;
  paymentCallbackId?: string;
  paymentVerifiedAt?: string;
  paymentLedgerId?: string;
  paymentLedgerTransactionId?: string;
};

export type ContactSubmission = {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  message: string;
  status: "New" | "Replied";
};

// Defined in lib/order-constants (a plain module) so the client dropdowns can
// import them without pulling this server-only file's node:fs/pg into the
// bundle. Imported for the guards below and re-exported so existing imports
// from "@/lib/submissions" keep working.
import {
  orderStatuses,
  paymentStatuses,
  paymentProviders,
  contactStatuses,
} from "@/lib/order-constants";

export { orderStatuses, paymentStatuses, paymentProviders, contactStatuses };

const dataDirectory = path.join(process.cwd(), "data");
const ordersPath = path.join(dataDirectory, "orders.json");
const messagesPath = path.join(dataDirectory, "messages.json");

type OrderItemRow = {
  order_id: string;
  product_id: string;
  product_name: string;
  size: string;
  color: string;
  quantity: number | string;
};

type OrderRow = {
  id: string;
  created_at: Date | string;
  customer_user_id: string | null;
  name: string;
  email: string | null;
  phone: string;
  address: string;
  delivery: string;
  payment: string;
  order_text: string;
  total: string;
  status: string;
  payment_status: string;
  payment_provider: string;
  payment_reference: string;
  payment_transaction_id: string;
  payment_callback_id: string | null;
  payment_verified_at: Date | string | null;
  payment_ledger_id: string | null;
  payment_ledger_transaction_id: string | null;
};

type ContactMessageRow = {
  id: string;
  created_at: Date | string;
  name: string;
  email: string;
  message: string;
  status: string;
};

function createId(prefix: string) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `${prefix}-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

async function writeJsonFile<T>(filePath: string, value: T) {
  await writeFileAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function isoDate(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeEmail(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizePhone(value?: string) {
  return value?.replace(/\D/g, "") ?? "";
}

function optionalIsoDate(value: Date | string | null | undefined) {
  if (!value) {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function normalizeOrderStatus(value: unknown): OrderStatus {
  return orderStatuses.includes(value as OrderStatus) ? (value as OrderStatus) : "New";
}

function normalizePaymentStatus(value: unknown): PaymentStatus {
  return paymentStatuses.includes(value as PaymentStatus) ? (value as PaymentStatus) : "Unpaid";
}

function paymentProviderFromPreference(payment: string): PaymentProvider {
  const normalized = payment.toLowerCase();

  if (normalized.includes("esewa") && !normalized.includes("khalti")) {
    return "esewa";
  }

  if (normalized.includes("khalti") && !normalized.includes("esewa")) {
    return "khalti";
  }

  if (normalized.includes("bank") || normalized.includes("qr")) {
    return "bank";
  }

  if (normalized.includes("cod") || normalized.includes("cash on delivery")) {
    return "cod";
  }

  if (normalized.includes("cash") || normalized.includes("pickup")) {
    return "cash";
  }

  return "manual";
}

function normalizePaymentProvider(value: unknown, payment: string): PaymentProvider {
  return paymentProviders.includes(value as PaymentProvider)
    ? (value as PaymentProvider)
    : paymentProviderFromPreference(payment);
}

export function normalizeOrderItems(value: unknown): OrderItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const record = (entry ?? {}) as Record<string, unknown>;
      return {
        productId: typeof record.productId === "string" ? record.productId.trim() : "",
        productName: typeof record.productName === "string" ? record.productName.trim() : "",
        size: typeof record.size === "string" ? record.size.trim() : "",
        color: typeof record.color === "string" ? record.color.trim() : "",
        quantity: Math.max(0, Math.round(Number(record.quantity) || 0)),
      };
    })
    // A line with no product or no pairs reserves nothing and would only skew
    // the counts.
    .filter((item) => item.productId && item.quantity > 0);
}

function normalizeOrder(order: OrderSubmission): OrderSubmission {
  return {
    ...order,
    customerUserId: optionalText(order.customerUserId),
    items: normalizeOrderItems(order.items),
    status: normalizeOrderStatus(order.status),
    paymentStatus: normalizePaymentStatus(order.paymentStatus),
    paymentProvider: normalizePaymentProvider(order.paymentProvider, order.payment ?? ""),
    paymentReference: optionalText(order.paymentReference),
    paymentTransactionId: optionalText(order.paymentTransactionId),
    paymentCallbackId: optionalText(order.paymentCallbackId),
    paymentVerifiedAt: optionalIsoDate(order.paymentVerifiedAt),
    paymentLedgerId: optionalText(order.paymentLedgerId),
    paymentLedgerTransactionId: optionalText(order.paymentLedgerTransactionId),
  };
}

// Items live in their own table, so callers that need them fill them in after
// this. An order read without its items reserves nothing, never negative stock.
function orderFromRow(row: OrderRow): OrderSubmission {
  return {
    items: [],
    id: row.id,
    createdAt: isoDate(row.created_at),
    customerUserId: optionalText(row.customer_user_id),
    name: row.name,
    email: row.email ?? undefined,
    phone: row.phone,
    address: row.address,
    delivery: row.delivery,
    payment: row.payment,
    order: row.order_text,
    total: row.total,
    status: normalizeOrderStatus(row.status),
    paymentStatus: normalizePaymentStatus(row.payment_status),
    paymentProvider: normalizePaymentProvider(row.payment_provider, row.payment),
    paymentReference: optionalText(row.payment_reference),
    paymentTransactionId: optionalText(row.payment_transaction_id),
    paymentCallbackId: optionalText(row.payment_callback_id),
    paymentVerifiedAt: optionalIsoDate(row.payment_verified_at),
    paymentLedgerId: optionalText(row.payment_ledger_id),
    paymentLedgerTransactionId: optionalText(row.payment_ledger_transaction_id),
  };
}

function contactMessageFromRow(row: ContactMessageRow): ContactSubmission {
  return {
    id: row.id,
    createdAt: isoDate(row.created_at),
    name: row.name,
    email: row.email,
    message: row.message,
    status: contactStatuses.includes(row.status as ContactSubmission["status"])
      ? (row.status as ContactSubmission["status"])
      : "New",
  };
}

async function getOrdersFromLocalJson() {
  const orders = await readJsonFile<OrderSubmission[]>(ordersPath, []);
  return orders.map(normalizeOrder);
}

async function getOrdersFromPostgres() {
  const rows = await queryPostgres<OrderRow>(
    "orders",
    `
      SELECT
        id,
        created_at,
        customer_user_id,
        name,
        email,
        phone,
        address,
        delivery,
        payment,
        order_text,
        total,
        status,
        payment_status,
        payment_provider,
        payment_reference,
        payment_transaction_id,
        payment_callback_id,
        payment_verified_at,
        payment_ledger_id,
        payment_ledger_transaction_id
      FROM orders
      ORDER BY created_at DESC
    `,
  );

  // Fetched in one query and grouped in memory rather than per order, which
  // would be a query per row on a page that lists every order.
  const itemRows = await queryPostgres<OrderItemRow>(
    "orders",
    `
      SELECT order_id, product_id, product_name, size, color, quantity
      FROM order_items
    `,
  );

  const itemsByOrderId = new Map<string, OrderItem[]>();

  for (const row of itemRows) {
    const items = itemsByOrderId.get(row.order_id) ?? [];
    items.push({
      productId: row.product_id,
      productName: row.product_name,
      size: row.size,
      color: row.color,
      quantity: Number(row.quantity) || 0,
    });
    itemsByOrderId.set(row.order_id, items);
  }

  return rows.map((row) => ({
    ...orderFromRow(row),
    items: itemsByOrderId.get(row.id) ?? [],
  }));
}

export async function getOrders() {
  return runWithDataBackend({
    storeName: "orders",
    localJson: getOrdersFromLocalJson,
    postgres: getOrdersFromPostgres,
  });
}

export async function getOrderById(id: string) {
  const orders = await getOrders();
  return orders.find((order) => order.id === id) ?? null;
}

export function orderMatchesCustomer(
  order: OrderSubmission,
  customer: { userId?: string; email?: string; phone?: string },
) {
  const email = normalizeEmail(customer.email);
  const phone = normalizePhone(customer.phone);
  const emailMatches = email && normalizeEmail(order.email) === email;
  const phoneMatches = phone.length >= 6 && normalizePhone(order.phone) === phone;
  const userIdMatches = customer.userId && order.customerUserId === customer.userId;

  return Boolean(userIdMatches || emailMatches || phoneMatches);
}

export async function getOrdersForCustomer(customer: { userId?: string; email?: string; phone?: string }) {
  const orders = await getOrders();
  return orders.filter((order) => orderMatchesCustomer(order, customer));
}

export async function getOrderByPaymentReference(paymentReference: string) {
  const normalizedReference = optionalText(paymentReference);

  if (!normalizedReference) {
    return null;
  }

  const orders = await getOrders();
  return orders.find((order) => order.paymentReference === normalizedReference) ?? null;
}

export async function saveOrder(
  order: Omit<
    OrderSubmission,
    | "id"
    | "createdAt"
    | "customerUserId"
    | "status"
    | "paymentStatus"
    | "paymentProvider"
    | "paymentReference"
    | "paymentTransactionId"
    | "paymentCallbackId"
    | "paymentVerifiedAt"
    | "paymentLedgerId"
    | "paymentLedgerTransactionId"
  >,
  customerUserId?: string,
) {
  const record: OrderSubmission = {
    ...order,
    id: createId("KRS-ORD"),
    createdAt: new Date().toISOString(),
    customerUserId: optionalText(customerUserId),
    status: "New",
    paymentStatus: "Unpaid",
    paymentProvider: paymentProviderFromPreference(order.payment),
  };

  return runWithDataBackend({
    storeName: "orders",
    localJson: async () => {
      const orders = await getOrdersFromLocalJson();
      await writeJsonFile(ordersPath, [record, ...orders]);
      return record;
    },
    postgres: async () =>
      // The items are what reserve stock, so an order must never land without
      // them. One transaction keeps the pair whole.
      transactionPostgres("orders", async (db) => {
      const rows = await db.query<OrderRow>(
        `
          INSERT INTO orders (
            id,
            created_at,
            customer_user_id,
            name,
            email,
            phone,
            address,
            delivery,
            payment,
            order_text,
            total,
            status,
            payment_status,
            payment_provider,
            payment_reference,
            payment_transaction_id,
            payment_callback_id,
            payment_verified_at,
            payment_ledger_id,
            payment_ledger_transaction_id
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
          )
          RETURNING
            id,
            created_at,
            customer_user_id,
            name,
            email,
            phone,
            address,
            delivery,
            payment,
            order_text,
            total,
            status,
            payment_status,
            payment_provider,
            payment_reference,
            payment_transaction_id,
            payment_callback_id,
            payment_verified_at,
            payment_ledger_id,
            payment_ledger_transaction_id
        `,
        [
          record.id,
          new Date(record.createdAt),
          record.customerUserId ?? null,
          record.name,
          record.email ?? null,
          record.phone,
          record.address,
          record.delivery,
          record.payment,
          record.order,
          record.total,
          record.status,
          record.paymentStatus,
          record.paymentProvider,
          record.paymentReference ?? "",
          record.paymentTransactionId ?? "",
          record.paymentCallbackId ?? null,
          record.paymentVerifiedAt ? new Date(record.paymentVerifiedAt) : null,
          record.paymentLedgerId ?? null,
          record.paymentLedgerTransactionId ?? null,
        ],
      );

      for (const item of record.items) {
        await db.query(
          `
            INSERT INTO order_items (id, order_id, product_id, product_name, size, color, quantity)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            createId("KRS-ITEM"),
            record.id,
            item.productId,
            item.productName,
            item.size,
            item.color,
            item.quantity,
          ],
        );
      }

      return { ...orderFromRow(rows[0]), items: record.items };
      }),
  });
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  return runWithDataBackend({
    storeName: "orders",
    localJson: async () => {
      const orders = await getOrdersFromLocalJson();
      const nextOrders = orders.map((order) =>
        order.id === id ? { ...order, status } : order,
      );

      await writeJsonFile(ordersPath, nextOrders);
    },
    postgres: async () => {
      await queryPostgres<{ id: string }>(
        "orders",
        "UPDATE orders SET status = $2 WHERE id = $1 RETURNING id",
        [id, status],
      );
    },
  });
}

export type OrderPaymentUpdate = {
  status: PaymentStatus;
  provider: PaymentProvider;
  reference?: string;
  transactionId?: string;
  callbackId?: string;
  verifiedAt?: string;
  ledgerId?: string;
  ledgerTransactionId?: string;
};

export async function updateOrderPayment(id: string, payment: OrderPaymentUpdate) {
  const hasLedgerIdUpdate = typeof payment.ledgerId === "string";
  const nextPayment = {
    status: normalizePaymentStatus(payment.status),
    provider: normalizePaymentProvider(payment.provider, ""),
    reference: optionalText(payment.reference) ?? "",
    transactionId: optionalText(payment.transactionId) ?? "",
    callbackId: optionalText(payment.callbackId),
    verifiedAt: optionalIsoDate(payment.verifiedAt),
    ledgerId: optionalText(payment.ledgerId),
    ledgerTransactionId: optionalText(payment.ledgerTransactionId),
  };
  const paidVerifiedAt = new Date().toISOString();

  return runWithDataBackend({
    storeName: "orders",
    localJson: async () => {
      const orders = await getOrdersFromLocalJson();
      let updatedOrder: OrderSubmission | null = null;
      const nextOrders = orders.map((order) =>
        order.id === id
          ? (updatedOrder = {
              ...order,
              paymentStatus: nextPayment.status,
              paymentProvider: nextPayment.provider,
              paymentReference: optionalText(nextPayment.reference),
              paymentTransactionId: optionalText(nextPayment.transactionId),
              paymentCallbackId: nextPayment.callbackId,
              paymentVerifiedAt:
                nextPayment.verifiedAt ??
                (nextPayment.status === "Paid"
                  ? order.paymentVerifiedAt ?? paidVerifiedAt
                  : undefined),
              paymentLedgerId: hasLedgerIdUpdate ? nextPayment.ledgerId : order.paymentLedgerId,
              paymentLedgerTransactionId:
                hasLedgerIdUpdate && !nextPayment.ledgerId
                  ? undefined
                  : nextPayment.ledgerId || !hasLedgerIdUpdate
                  ? nextPayment.ledgerTransactionId ?? order.paymentLedgerTransactionId
                  : undefined,
            })
          : order,
      );

      if (!updatedOrder) {
        throw new Error("Order was not found.");
      }

      await writeJsonFile(ordersPath, nextOrders);
      return updatedOrder;
    },
    postgres: async () => {
      const rows = await queryPostgres<OrderRow>(
        "orders",
        `
          UPDATE orders
          SET
            payment_status = $2,
            payment_provider = $3,
            payment_reference = $4,
            payment_transaction_id = $5,
            payment_callback_id = $6,
            payment_verified_at = CASE
              WHEN $7::timestamptz IS NOT NULL THEN $7::timestamptz
              WHEN $2 = 'Paid' THEN coalesce(payment_verified_at, now())
              ELSE NULL
            END,
            payment_ledger_id = CASE
              WHEN $10 THEN $8
              ELSE payment_ledger_id
            END,
            payment_ledger_transaction_id = CASE
              WHEN $10 AND $8 IS NULL THEN NULL
              ELSE coalesce($9, payment_ledger_transaction_id)
            END
          WHERE id = $1
          RETURNING
            id,
            created_at,
            name,
            email,
            phone,
            address,
            delivery,
            payment,
            order_text,
            total,
            status,
            payment_status,
            payment_provider,
            payment_reference,
            payment_transaction_id,
            payment_callback_id,
            payment_verified_at,
            payment_ledger_id,
            payment_ledger_transaction_id
        `,
        [
          id,
          nextPayment.status,
          nextPayment.provider,
          nextPayment.reference,
          nextPayment.transactionId,
          nextPayment.callbackId ?? null,
          nextPayment.verifiedAt ? new Date(nextPayment.verifiedAt) : null,
          nextPayment.ledgerId ?? null,
          nextPayment.ledgerTransactionId ?? null,
          hasLedgerIdUpdate,
        ],
      );

      if (!rows[0]) {
        throw new Error("Order was not found.");
      }

      return orderFromRow(rows[0]);
    },
  });
}

async function getContactMessagesFromLocalJson() {
  return readJsonFile<ContactSubmission[]>(messagesPath, []);
}

async function getContactMessagesFromPostgres() {
  const rows = await queryPostgres<ContactMessageRow>(
    "contact messages",
    `
      SELECT id, created_at, name, email, message, status
      FROM contact_messages
      ORDER BY created_at DESC
    `,
  );

  return rows.map(contactMessageFromRow);
}

export async function saveContactMessage(
  message: Omit<ContactSubmission, "id" | "createdAt" | "status">,
) {
  const record: ContactSubmission = {
    ...message,
    id: createId("KRS-MSG"),
    createdAt: new Date().toISOString(),
    status: "New",
  };

  return runWithDataBackend({
    storeName: "contact messages",
    localJson: async () => {
      const messages = await getContactMessagesFromLocalJson();
      await writeJsonFile(messagesPath, [record, ...messages]);
      return record;
    },
    postgres: async () => {
      const rows = await queryPostgres<ContactMessageRow>(
        "contact messages",
        `
          INSERT INTO contact_messages (id, created_at, name, email, message, status)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, created_at, name, email, message, status
        `,
        [
          record.id,
          new Date(record.createdAt),
          record.name,
          record.email,
          record.message,
          record.status,
        ],
      );

      return contactMessageFromRow(rows[0]);
    },
  });
}

export async function getContactMessages() {
  return runWithDataBackend({
    storeName: "contact messages",
    localJson: getContactMessagesFromLocalJson,
    postgres: getContactMessagesFromPostgres,
  });
}

export async function updateContactStatus(
  id: string,
  status: ContactSubmission["status"],
) {
  return runWithDataBackend({
    storeName: "contact messages",
    localJson: async () => {
      const messages = await getContactMessagesFromLocalJson();
      let found = false;
      const nextMessages = messages.map((message) =>
        message.id === id ? (found = true, { ...message, status }) : message,
      );

      if (!found) {
        throw new Error("Contact message was not found.");
      }

      await writeJsonFile(messagesPath, nextMessages);
    },
    postgres: async () => {
      const rows = await queryPostgres<{ id: string }>(
        "contact messages",
        "UPDATE contact_messages SET status = $2 WHERE id = $1 RETURNING id",
        [id, status],
      );

      if (!rows[0]) {
        throw new Error("Contact message was not found.");
      }
    },
  });
}
