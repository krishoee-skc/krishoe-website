"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import {
  addSupplierLedger,
  addSupplierTransaction,
  createPurchaseInvoice,
  type SupplierPaymentMethod,
  type SupplierTransactionType,
} from "@/lib/purchasing";

const paymentMethods: SupplierPaymentMethod[] = ["Cash", "Cheque", "Bank", "Credit"];
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

  const materialId = textValue(formData, "materialId");
  const quantity = numberValue(formData, "quantity");
  const rate = numberValue(formData, "rate");
  const supplierLedgerId = textValue(formData, "supplierLedgerId");
  const supplierName = textValue(formData, "supplierName");
  const paidAmount = numberValue(formData, "paidAmount");
  const paymentMethod = optionValue(textValue(formData, "paymentMethod"), paymentMethods, "Cash");
  const paymentReference = textValue(formData, "paymentReference");

  if (!materialId || quantity <= 0 || rate <= 0) {
    throw new Error("Raw material, quantity, and rate are required.");
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
    materialId,
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
    `${invoice.purchaseNumber} purchase recorded for ${invoice.materialName} Rs. ${invoice.total}.`,
  ).catch(() => undefined);

  refreshPurchasingPage(textValue(formData, "returnTo"));
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
