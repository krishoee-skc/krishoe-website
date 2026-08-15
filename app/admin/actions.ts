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
  updateOrderPayment,
  updateOrderStatus,
  type OrderStatus,
  type PaymentProvider,
  type PaymentStatus,
} from "@/lib/submissions";
import { orderStatuses, paymentStatuses, paymentProviders } from "@/lib/order-constants";
import { getProductById, getProducts, removeProduct, upsertProduct } from "@/lib/product-store";
import { designKey } from "@/lib/design-name";
import { isDuplicateNameViolation } from "@/lib/duplicate-name-error";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { getUserByEmail, getUserById, markUserPhoneVerified } from "@/lib/user-store";

export type ActionState = {
  ok: boolean;
  message: string;
  href?: string;
};

const orderStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(orderStatuses),
});

const orderPaymentSchema = z.object({
  id: z.string().min(1),
  paymentStatus: z.enum(paymentStatuses),
  paymentProvider: z.enum(paymentProviders),
  paymentReference: z.string().max(180).optional(),
  paymentTransactionId: z.string().max(180).optional(),
  paymentCallbackId: z.string().max(240).optional(),
  paymentAmount: z.number().min(0),
  ledgerId: z.string().max(120).optional(),
  paymentNote: z.string().max(500).optional(),
});

const posPaymentMethods: PosPaymentMethod[] = ["Cash", "Cheque", "Credit", "QR", "eSewa", "Khalti", "Bank"];

function normalizePhone(phone: string | undefined) {
  return (phone ?? "").replace(/[\s().-]/g, "");
}

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

// Prices are stored in paisa so no arithmetic ever meets a fraction of a rupee,
// but they are entered in rupees, because that is the only unit anyone running
// a shop thinks in. Rounding here is what keeps "1799.5" from becoming
// 179949.99999 paisa.
function paisaFromRupees(formData: FormData, key: string) {
  const rupees = Number(textValue(formData, key));

  if (!Number.isFinite(rupees) || rupees <= 0) {
    return 0;
  }

  return Math.round(rupees * 100);
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

export async function markCustomerPhoneVerifiedFromOrderAction(
  _previousState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminPermission("orders:write");

  const id = textValue(formData, "id");
  const order = id ? await getOrderById(id) : null;

  if (!order) {
    return { ok: false, message: "Order was not found." };
  }

  const user = order.customerUserId
    ? await getUserById(order.customerUserId)
    : order.email
      ? await getUserByEmail(order.email)
      : null;
  const orderPhone = normalizePhone(order.phone);
  const userPhone = normalizePhone(user?.phone);

  if (!user) {
    return { ok: false, message: "No matching customer account found for this order." };
  }

  if (!orderPhone || orderPhone !== userPhone) {
    return { ok: false, message: "Customer account phone does not match this order phone." };
  }

  try {
    await markUserPhoneVerified(user.id, order.phone);
    await auditAdminAction(
      "customer_phone_verified",
      `Customer ${user.id} phone verified from order ${order.id}.`,
    );
    revalidatePath("/admin/orders");
    revalidatePath("/admin/customers");
    revalidatePath("/account");
    return { ok: true, message: "Phone verified for this customer account." };
  } catch {
    return { ok: false, message: "Could not verify customer phone." };
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
    const invoiceInput = await buildPosInvoiceInputFromOnlineOrder(order, {
      paymentMethod,
      paidAmount,
      ledgerId,
      paymentReference,
      cashier: textValue(formData, "cashier"),
    });
    const invoice = await createPosInvoice({
      ...invoiceInput,
      sourceSubmissionKey: `online-order-pos:${order.id}`,
    });
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
        paymentCallbackId: `online-order-pos-payment:${order.id}`,
        source: "admin",
        note: `Converted to POS invoice ${invoice.invoiceNumber}.`,
      });
    }

    await auditAdminAction(
      "order_convert_to_pos",
      `Order ${order.id} converted to POS invoice ${invoice.invoiceNumber}.`,
    );
    // Stock changed, so the prerendered storefront pages (home, categories)
    // must refresh their sold-out / only-N-left badges too — layout-wide.
    revalidatePath("/", "layout");

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
  const priceValue = paisaFromRupees(formData, "priceRupees");
  const image = textValue(formData, "image") || category.image;
  const id = textValue(formData, "id") || crypto.randomUUID();
  const name = textValue(formData, "name") || "Untitled Product";

  // Stock is not the catalog's to set. Every pair that exists arrived through
  // Operations — made, bought, or counted as opening stock — and the catalog is
  // the selling view of that one number, not a second place to declare it.
  //
  // A typed number here was a second, unbacked answer to "how many are there".
  // That is how 132 pairs came to sit in the shop across 15 designs with no
  // record of where they came from and no way for a sale to reduce them. Saving
  // a product now leaves the count exactly where Operations left it.
  const existingProduct = textValue(formData, "id")
    ? await getProductById(id, { includeDrafts: true })
    : null;
  const stock = Math.max(0, existingProduct?.stock ?? 0);

  const product: Product = {
    id,
    sku: textValue(formData, "sku") || id.toUpperCase(),
    name,
    category: category.title,
    categorySlug,
    price: `Rs. ${(priceValue / 100).toLocaleString("en-IN")}`,
    priceValue,
    wholesalePriceValue: paisaFromRupees(formData, "wholesalePriceRupees"),
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
    stock,
    highlights: listValue(formData, "highlights"),
    care: listValue(formData, "care"),
    reviews: [],
    status: textValue(formData, "status") === "Draft" ? "Draft" : "Active",
    featured: formData.get("featured") === "on",
    bestSeller: formData.get("bestSeller") === "on",
    newArrival: formData.get("newArrival") === "on",
  };

  // Capitals and spacing are spelling, not identity: "Jeans Shoes" and
  // "jeans shoes" are one product. Two rows reading the same are one design to
  // the stock sync, so 55 counted pairs would have been handed to each of them
  // — 110 pairs in a shop holding 55.
  const clash = (await getProducts({ includeDrafts: true })).find(
    (other) => other.id !== product.id && designKey(other.name) === designKey(product.name),
  );
  if (clash) {
    return {
      ok: false,
      message: `A product named "${clash.name}" already exists. Use a name that tells them apart — capitals and spacing do not count as different.`,
    };
  }

  try {
    await upsertProduct(product);
  } catch (error) {
    // The index caught what the check above could not see: two saves of the
    // same name arriving together.
    if (isDuplicateNameViolation(error, "products_name_unique_idx")) {
      return {
        ok: false,
        message: "A product with this name already exists. Use a name that tells them apart.",
      };
    }
    reportError(`save product ${product.sku}`, error);
    return { ok: false, message: saveFailureMessage(error, "Could not save this product.") };
  }

  await auditAdminAction("product_upsert", `Product ${product.sku} (${product.id}) saved as ${product.status}.`);
  // The whole site, not a hand-picked list: the home page and the /shop/[category]
  // pages are prerendered, and missing them here is why a freshly uploaded photo
  // "didn't show in the shop" until the next deploy.
  revalidatePath("/", "layout");

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
  // Layout-wide for the same reason as the save: the prerendered home and
  // category pages must stop showing the deleted product immediately.
  revalidatePath("/", "layout");

  return { ok: true, message: "Product deleted." };
}
