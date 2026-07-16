"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import {
  addSupplierLedger,
  addSupplierTransaction,
  createPurchaseInvoice,
  type PurchaseKind,
  type SupplierPaymentMethod,
  type SupplierTransactionType,
} from "@/lib/purchasing";
import type { BusinessChannel } from "@/lib/operations";
import { syncProductCatalogStockWithFinishedStock } from "@/lib/product-store";

const paymentMethods: SupplierPaymentMethod[] = ["Cash", "Cheque", "Bank", "Credit"];
const purchaseKinds: PurchaseKind[] = ["Raw Material", "Trading Goods"];
// Trading goods are bought to resell, so they never land in the factory channel.
const tradingChannels: BusinessChannel[] = ["Wholesale", "Retail", "Online"];
const transactionTypes: SupplierTransactionType[] = [
  "Cash Payment",
  "Cheque Payment",
  "Bank Payment",
  "Return Adjustment",
  "Manual Adjustment",
];

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(formData: FormData, key: string) {
  return Math.max(0, Math.round(Number(textValue(formData, key)) || 0));
}

function optionValue<T extends string>(value: string, options: readonly T[], fallback: T) {
  return options.includes(value as T) ? (value as T) : fallback;
}

function safeReturnTo(value: string) {
  return value.startsWith("/admin/purchasing") ? value : "/admin/purchasing";
}

function refreshPurchasingPage(returnTo = "/admin/purchasing") {
  revalidatePath("/admin");
  revalidatePath("/admin/purchasing");
  revalidatePath("/admin/operations");
  redirect(safeReturnTo(returnTo));
}

// A trading goods purchase changes what the shop can sell, so the catalog and
// the storefront have to be refreshed too — not just the admin pages.
function refreshPurchasingAndCatalog(returnTo = "/admin/purchasing") {
  revalidatePath("/admin/products");
  revalidatePath("/shop", "layout");
  revalidatePath("/product", "layout");
  revalidatePath("/");
  refreshPurchasingPage(returnTo);
}

export async function createSupplierLedgerAction(formData: FormData) {
  await requireAdminPermission("purchasing:write");

  const supplierName = textValue(formData, "supplierName");

  if (!supplierName) {
    throw new Error("Supplier name is required.");
  }

  await addSupplierLedger({
    supplierName,
    phone: textValue(formData, "phone"),
    materialFocus: textValue(formData, "materialFocus"),
  });
  await appendAdminAuditEvent("supplier_create", `Supplier ${supplierName} created.`).catch(
    () => undefined,
  );

  refreshPurchasingPage(textValue(formData, "returnTo"));
}

export async function createPurchaseInvoiceAction(formData: FormData) {
  await requireAdminPermission("purchasing:write");

  const kind = optionValue(textValue(formData, "kind"), purchaseKinds, "Raw Material");
  const materialId = textValue(formData, "materialId");
  const design = textValue(formData, "design");
  const channel = optionValue(textValue(formData, "channel"), tradingChannels, "Wholesale");
  const sizeRun = textValue(formData, "sizeRun") || "Mixed";
  const quantity = numberValue(formData, "quantity");
  const rate = numberValue(formData, "rate");
  const supplierLedgerId = textValue(formData, "supplierLedgerId");
  const supplierName = textValue(formData, "supplierName");
  const paidAmount = numberValue(formData, "paidAmount");
  const paymentMethod = optionValue(textValue(formData, "paymentMethod"), paymentMethods, "Cash");
  const paymentReference = textValue(formData, "paymentReference");

  if (quantity <= 0 || rate <= 0) {
    throw new Error("Quantity and rate are required.");
  }

  if (kind === "Raw Material" && !materialId) {
    throw new Error("Raw material, quantity, and rate are required.");
  }

  if (kind === "Trading Goods" && !design) {
    throw new Error("Choose the product you purchased.");
  }

  if (!supplierLedgerId && !supplierName) {
    throw new Error("Choose an existing supplier or enter a new supplier name.");
  }

  if (paymentMethod === "Credit" && paidAmount > 0) {
    throw new Error("Credit purchase cannot have paid amount. Use Cash, Cheque, or Bank for payments.");
  }

  if ((paymentMethod === "Cheque" || paymentMethod === "Bank") && paidAmount > 0 && !paymentReference) {
    throw new Error("Cheque or bank payment reference is required when paid amount is entered.");
  }

  const invoice = await createPurchaseInvoice({
    supplierLedgerId,
    supplierName,
    phone: textValue(formData, "phone"),
    kind,
    materialId: kind === "Raw Material" ? materialId : "",
    design: kind === "Trading Goods" ? design : "",
    channel: kind === "Trading Goods" ? channel : "",
    sizeRun: kind === "Trading Goods" ? sizeRun : "Mixed",
    quantity,
    rate,
    discount: numberValue(formData, "discount"),
    tax: numberValue(formData, "tax"),
    paidAmount,
    paymentMethod,
    paymentReference,
    note: textValue(formData, "note"),
  });

  await appendAdminAuditEvent(
    "purchase_create_invoice",
    invoice.kind === "Trading Goods"
      ? `${invoice.purchaseNumber} trading goods purchase recorded for ${invoice.quantity} pairs of ${invoice.materialName} (${invoice.channel}) Rs. ${invoice.total}.`
      : `${invoice.purchaseNumber} purchase recorded for ${invoice.materialName} Rs. ${invoice.total}.`,
  ).catch(() => undefined);

  const returnTo = textValue(formData, "returnTo");

  if (invoice.kind === "Trading Goods") {
    // Push the new finished stock down to the storefront catalog so the shop
    // shows what was just bought instead of waiting for a manual sync.
    await syncProductCatalogStockWithFinishedStock().catch(() => undefined);
    refreshPurchasingAndCatalog(returnTo);
    return;
  }

  refreshPurchasingPage(returnTo);
}

export async function createSupplierTransactionAction(formData: FormData) {
  await requireAdminPermission("purchasing:write");

  const supplierLedgerId = textValue(formData, "supplierLedgerId");
  const amount = numberValue(formData, "amount");

  if (!supplierLedgerId || amount <= 0) {
    throw new Error("Supplier ledger and positive amount are required.");
  }

  const transaction = await addSupplierTransaction({
    supplierLedgerId,
    type: optionValue(textValue(formData, "type"), transactionTypes, "Cash Payment"),
    amount,
    note: textValue(formData, "note"),
  });

  await appendAdminAuditEvent(
    "supplier_transaction_create",
    `${transaction.type} recorded for ${transaction.supplierName}: Rs. ${transaction.amount}.`,
  ).catch(() => undefined);

  refreshPurchasingPage(textValue(formData, "returnTo"));
}
