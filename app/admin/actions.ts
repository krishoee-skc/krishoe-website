"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { categories, type Product } from "@/lib/products";
import {
  buildPosInvoiceInputFromOnlineOrder,
  closeOrderBlockedReason,
  defaultPosPaymentMethodForOrder,
  getPosInvoiceForOnlineOrder,
} from "@/lib/order-pos";
import { recordPaymentTransaction } from "@/lib/payment-transactions";
import {
  createPosInvoice,
  type PosPaymentMethod,
} from "@/lib/pos";
import {
  getOrderById,
  orderStatuses,
  paymentProviders,
  paymentStatuses,
  updateOrderPayment,
  updateOrderStatus,
  type OrderStatus,
  type PaymentProvider,
  type PaymentStatus,
} from "@/lib/submissions";
import { removeProduct, upsertProduct } from "@/lib/product-store";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";

// Re-exported from the store rather than re-listed. Kept as a second hand-typed
// list, adding a status there left the admin unable to pick it — which is
// exactly what happened to Cancelled.
export const ORDER_STATUSES = orderStatuses;
export const PAYMENT_STATUSES = paymentStatuses;
export const PAYMENT_PROVIDERS = paymentProviders;

export type ActionState = {
  ok: boolean;
  message: string;
  href?: string;
};

const orderStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(ORDER_STATUSES),
});

const orderPaymentSchema = z.object({
  id: z.string().min(1),
  paymentStatus: z.enum(PAYMENT_STATUSES),
  paymentProvider: z.enum(PAYMENT_PROVIDERS),
  paymentReference: z.string().max(180).optional(),
  paymentTransactionId: z.string().max(180).optional(),
  paymentCallbackId: z.string().max(240).optional(),
  paymentAmount: z.number().min(0),
  ledgerId: z.string().max(120).optional(),
  paymentNote: z.string().max(500).optional(),
});

const posPaymentMethods: PosPaymentMethod[] = ["Cash", "Cheque", "Credit", "QR", "eSewa", "Khalti", "Bank"];

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function listValue(formData: FormData, key: string) {
  return textValue(formData, key)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function numberValue(formData: FormData, key: string) {
  return Math.max(0, Math.round(Number(textValue(formData, key)) || 0));
}

function optionValue<T extends string>(value: string, options: readonly T[], fallback: T) {
  return options.includes(value as T) ? (value as T) : fallback;
}

function orderProviderFromPosPayment(paymentMethod: PosPaymentMethod): PaymentProvider {
  if (paymentMethod === "eSewa") return "esewa";
  if (paymentMethod === "Khalti") return "khalti";
  if (paymentMethod === "Bank" || paymentMethod === "QR") return "bank";
  if (paymentMethod === "Cash") return "cash";
  return "manual";
}

async function auditAdminAction(action: string, detail: string) {
  await recordAdminAuditEvent(action, detail);
}

export async function updateOrderStatusAction(
  _previousState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminPermission("orders:write");

  const validatedFields = orderStatusSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validatedFields.success) {
    return { ok: false, message: "Invalid order status." };
  }

  if (validatedFields.data.status === "Closed") {
    const invoice = await getPosInvoiceForOnlineOrder(validatedFields.data.id);
    const blockedReason = closeOrderBlockedReason(Boolean(invoice));

    if (blockedReason) {
      return { ok: false, message: blockedReason };
    }
  }

  try {
    await updateOrderStatus(
      validatedFields.data.id,
      validatedFields.data.status as OrderStatus,
    );
    await auditAdminAction(
      "order_status_update",
      `Order ${validatedFields.data.id} marked ${validatedFields.data.status}.`,
    );
    revalidatePath("/admin/orders");
    return { ok: true, message: `Order marked ${validatedFields.data.status}.` };
  } catch {
    return { ok: false, message: "Failed to update order status." };
  }
}

export async function updateOrderPaymentAction(
  _previousState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminPermission("payments:write");

  const validatedFields = orderPaymentSchema.safeParse({
    id: textValue(formData, "id"),
    paymentStatus: textValue(formData, "paymentStatus"),
    paymentProvider: textValue(formData, "paymentProvider"),
    paymentReference: textValue(formData, "paymentReference"),
    paymentTransactionId: textValue(formData, "paymentTransactionId"),
    paymentCallbackId: textValue(formData, "paymentCallbackId"),
    paymentAmount: numberValue(formData, "paymentAmount"),
    ledgerId: textValue(formData, "ledgerId"),
    paymentNote: textValue(formData, "paymentNote"),
  });

  if (!validatedFields.success) {
    return { ok: false, message: "Invalid payment details." };
  }

  try {
    const order = await updateOrderPayment(validatedFields.data.id, {
      status: validatedFields.data.paymentStatus as PaymentStatus,
      provider: validatedFields.data.paymentProvider as PaymentProvider,
      reference: validatedFields.data.paymentReference,
      transactionId: validatedFields.data.paymentTransactionId,
      callbackId: validatedFields.data.paymentCallbackId,
      ledgerId: validatedFields.data.ledgerId,
    });
    await recordPaymentTransaction({
      orderId: order.id,
      customerName: order.name,
      amount: validatedFields.data.paymentAmount,
      paymentStatus: order.paymentStatus,
      paymentProvider: order.paymentProvider,
      paymentReference: order.paymentReference,
      paymentTransactionId: order.paymentTransactionId,
      paymentCallbackId: order.paymentCallbackId,
      ledgerId: order.paymentLedgerId,
      ledgerTransactionId: order.paymentLedgerTransactionId,
      source: "admin",
      note: validatedFields.data.paymentNote || `Admin marked payment ${order.paymentStatus}.`,
    });
    await auditAdminAction(
      "order_payment_update",
      `Order ${order.id} payment marked ${order.paymentStatus} via ${order.paymentProvider}.`,
    );
    revalidatePath("/admin/orders");
    if (order.paymentLedgerId) {
      revalidatePath(`/admin/operations/ledger/${order.paymentLedgerId}`);
    }
    return { ok: true, message: `Payment marked ${validatedFields.data.paymentStatus}.` };
  } catch {
    return { ok: false, message: "Failed to update payment details." };
  }
}

export async function createPosInvoiceFromOrderAction(
  _previousState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminPermission("orders:write");
  await requireAdminPermission("pos:write");

  const id = textValue(formData, "id");
  const order = id ? await getOrderById(id) : null;

  if (!order) {
    return { ok: false, message: "Order was not found." };
  }

  const existingInvoice = await getPosInvoiceForOnlineOrder(order.id);

  if (existingInvoice) {
    return {
      ok: true,
      message: `Already converted to ${existingInvoice.invoiceNumber}.`,
      href: `/admin/pos/${existingInvoice.id}`,
    };
  }

  const paymentMethod = optionValue(
    textValue(formData, "posPaymentMethod"),
    posPaymentMethods,
    defaultPosPaymentMethodForOrder(order),
  );
  const paidAmount = numberValue(formData, "paidAmount");
  const ledgerId = textValue(formData, "ledgerId");
  const paymentReference = textValue(formData, "paymentReference") || order.paymentReference || "";

  try {
    const invoice = await createPosInvoice(
      await buildPosInvoiceInputFromOnlineOrder(order, {
        paymentMethod,
        paidAmount,
        ledgerId,
        paymentReference,
        cashier: textValue(formData, "cashier"),
      }),
    );
    const paymentStatus: PaymentStatus =
      paidAmount >= invoice.total ? "Paid" : paidAmount > 0 ? "Pending" : "Unpaid";
    const paymentProvider = orderProviderFromPosPayment(paymentMethod);

    await updateOrderStatus(order.id, "Closed");
    await updateOrderPayment(order.id, {
      status: paymentStatus,
      provider: paymentProvider,
      reference: paymentReference,
      ledgerId,
      ledgerTransactionId: invoice.ledgerTransactionId,
    });

    if (paidAmount > 0) {
      await recordPaymentTransaction({
        orderId: order.id,
        customerName: order.name,
        amount: paidAmount,
        paymentStatus,
        paymentProvider,
        paymentReference,
        ledgerId,
        ledgerTransactionId: invoice.ledgerTransactionId,
        source: "admin",
        note: `Converted to POS invoice ${invoice.invoiceNumber}.`,
      });
    }

    await auditAdminAction(
      "order_convert_to_pos",
      `Order ${order.id} converted to POS invoice ${invoice.invoiceNumber}.`,
    );
    revalidatePath("/admin");
    revalidatePath("/admin/orders");
    revalidatePath("/admin/pos");
    revalidatePath(`/admin/pos/${invoice.id}`);
    revalidatePath("/admin/operations");
    revalidatePath("/admin/costing");
    revalidatePath("/admin/products");
    revalidatePath("/shop");

    return {
      ok: true,
      message: `Created POS invoice ${invoice.invoiceNumber}.`,
      href: `/admin/pos/${invoice.id}`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to convert order to POS.",
    };
  }
}

// Returns the outcome instead of throwing. A save that failed used to take the
// admin to the app's error page, which threw away everything they had typed —
// including a freshly uploaded photo URL — so the only way back was to fill the
// whole form in again. Now the form stays put, says why, and Save works on the
// next press.
export async function upsertProductAction(
  _previousState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminPermission("products:write");

  const categorySlug = textValue(formData, "categorySlug") || categories[0].slug;
  const category = categories.find((item) => item.slug === categorySlug) ?? categories[0];
  const priceValue = Math.max(0, Number(textValue(formData, "priceValue")) || 0);
  const image = textValue(formData, "image") || category.image;
  const id = textValue(formData, "id") || crypto.randomUUID();
  const name = textValue(formData, "name") || "Untitled Product";

  const product: Product = {
    id,
    sku: textValue(formData, "sku") || id.toUpperCase(),
    name,
    category: category.title,
    categorySlug,
    price: `Rs. ${(priceValue / 100).toLocaleString("en-IN")}`,
    priceValue,
    wholesalePriceValue: Math.max(0, Number(textValue(formData, "wholesalePriceValue")) || 0),
    minWholesaleQty: Math.max(1, Number(textValue(formData, "minWholesaleQty")) || 1),
    image,
    gallery: listValue(formData, "gallery").length > 0 ? listValue(formData, "gallery") : [image],
    badge: textValue(formData, "badge") || undefined,
    rating: textValue(formData, "rating") || "4.8",
    description: textValue(formData, "description"),
    longDescription: textValue(formData, "longDescription"),
    material: textValue(formData, "material") || "Premium synthetic finish",
    fit: textValue(formData, "fit") || "Regular fit",
    colors: listValue(formData, "colors").length > 0 ? listValue(formData, "colors") : ["Black"],
    sizes: listValue(formData, "sizes").length > 0 ? listValue(formData, "sizes") : ["36", "37", "38", "39", "40"],
    stock: Math.max(0, Number(textValue(formData, "stock")) || 0),
    highlights: listValue(formData, "highlights"),
    care: listValue(formData, "care"),
    reviews: [],
    status: textValue(formData, "status") === "Draft" ? "Draft" : "Active",
    featured: formData.get("featured") === "on",
    bestSeller: formData.get("bestSeller") === "on",
    newArrival: formData.get("newArrival") === "on",
  };

  try {
    await upsertProduct(product);
  } catch (error) {
    reportError(`save product ${product.sku}`, error);
    return { ok: false, message: saveFailureMessage(error, "Could not save this product.") };
  }

  await auditAdminAction("product_upsert", `Product ${product.sku} (${product.id}) saved as ${product.status}.`);
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  revalidatePath(`/product/${id}`);

  return {
    ok: true,
    message: `Saved ${product.name}.`,
    href: "/admin/products",
  };
}

export async function deleteProductAction(
  _previousState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminPermission("products:write");

  const id = textValue(formData, "id");

  if (!id) {
    return { ok: false, message: "Product id is required." };
  }

  try {
    await removeProduct(id);
  } catch (error) {
    reportError(`delete product ${id}`, error);
    return { ok: false, message: saveFailureMessage(error, "Could not delete this product.") };
  }

  await auditAdminAction("product_delete", `Product ${id} deleted.`);
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  revalidatePath(`/product/${id}`);

  return { ok: true, message: "Product deleted." };
}
