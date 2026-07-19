"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import {
  addSupplierLedger,
  addSupplierTransaction,
  createPurchaseInvoice,
  type CreatePurchaseInvoiceItemInput,
  type PurchaseKind,
  type SupplierPaymentMethod,
  type SupplierTransactionType,
} from "@/lib/purchasing";
import type { BusinessChannel } from "@/lib/operations";

const paymentMethods: SupplierPaymentMethod[] = ["Cash", "Cheque", "Bank", "Credit"];
const purchaseKinds: PurchaseKind[] = ["Raw Material", "Trading Goods"];
// A ceiling on what one submitted form can post, not on what a bill may hold.
// Real bills run to twenty-five or so lines; this only stops a hand-crafted
// request from asking the server to build an unbounded number of them.
const MAX_PURCHASE_ITEMS = 200;
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
  await recordAdminAuditEvent("supplier_create", `Supplier ${supplierName} created.`);

  refreshPurchasingPage(textValue(formData, "returnTo"));
}

// The form posts item0..itemN-1 and says how many rows it rendered. Reading the
// count rather than assuming one keeps a 25-line bill from being silently cut
// short — the POS billing form hardcodes six, and a seventh item there is
// simply lost.
function purchaseItems(formData: FormData): CreatePurchaseInvoiceItemInput[] {
  const declared = numberValue(formData, "itemCount");
  const count = Math.min(Math.max(Math.trunc(declared), 0), MAX_PURCHASE_ITEMS);

  return Array.from({ length: count }, (_, index) => {
    const kind = optionValue(textValue(formData, `item${index}Kind`), purchaseKinds, "Raw Material");

    return {
      kind,
      materialId: textValue(formData, `item${index}MaterialId`),
      design: textValue(formData, `item${index}Design`),
      channel:
        kind === "Trading Goods"
          ? optionValue(textValue(formData, `item${index}Channel`), tradingChannels, "Wholesale")
          : ("" as const),
      sizeRun: textValue(formData, `item${index}SizeRun`),
      quantity: numberValue(formData, `item${index}Quantity`),
      rate: numberValue(formData, `item${index}Rate`),
      note: textValue(formData, `item${index}Note`),
    };
  });
}

export async function createPurchaseInvoiceAction(formData: FormData) {
  await requireAdminPermission("purchasing:write");

  const supplierLedgerId = textValue(formData, "supplierLedgerId");
  const supplierName = textValue(formData, "supplierName");
  const paidAmount = numberValue(formData, "paidAmount");
  const paymentMethod = optionValue(textValue(formData, "paymentMethod"), paymentMethods, "Cash");
  const paymentReference = textValue(formData, "paymentReference");

  if (!supplierLedgerId && !supplierName) {
    throw new Error("Choose an existing supplier or enter a new supplier name.");
  }

  if (paymentMethod === "Credit" && paidAmount > 0) {
    throw new Error("Credit purchase cannot have paid amount. Use Cash, Cheque, or Bank for payments.");
  }

  if ((paymentMethod === "Cheque" || paymentMethod === "Bank") && paidAmount > 0 && !paymentReference) {
    throw new Error("Cheque or bank payment reference is required when paid amount is entered.");
  }

  // createPurchaseInvoice drops the blank rows and checks the rest, so the
  // per-line rules live in one place instead of being restated here.
  const invoice = await createPurchaseInvoice({
    supplierLedgerId,
    supplierName,
    phone: textValue(formData, "phone"),
    items: purchaseItems(formData),
    discount: numberValue(formData, "discount"),
    tax: numberValue(formData, "tax"),
    paidAmount,
    paymentMethod,
    paymentReference,
    note: textValue(formData, "note"),
  });

  await recordAdminAuditEvent(
    "purchase_create_invoice",
    `${invoice.purchaseNumber} ${invoice.kind.toLowerCase()} purchase recorded: ${invoice.items.length} item(s), Rs. ${invoice.total}.`,
  );

  const returnTo = textValue(formData, "returnTo");

  if (invoice.kind === "Trading Goods") {
    // createPurchaseInvoice syncs the catalog stock itself, so every caller
    // gets it and a failure is not swallowed here. This only has to rebuild
    // the pages that render the new pairs.
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

  await recordAdminAuditEvent(
    "supplier_transaction_create",
    `${transaction.type} recorded for ${transaction.supplierName}: Rs. ${transaction.amount}.`,
  );

  refreshPurchasingPage(textValue(formData, "returnTo"));
}
