"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/app/admin/actions";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";
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
const rawMaterialUnits = ["kg", "meter", "pair", "piece", "liter"] as const;
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
      // Set when a raw line names a material not in the list yet; resolved to an
      // id before the bill posts.
      materialName: textValue(formData, `item${index}MaterialName`),
      materialUnit: optionValue(
        textValue(formData, `item${index}MaterialUnit`),
        rawMaterialUnits,
        "piece",
      ),
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

// Returns the outcome instead of throwing. A purchase that failed used to throw
// straight to the admin error page — the whole bill, sometimes twenty-five
// lines of it, gone with no word of what was wrong. Every rule createPurchaseInvoice
// enforces ("Item 2: choose a raw material", "Choose a supplier") now comes back
// as a message beside the button, with the form and its lines still standing.
export async function createPurchaseInvoiceAction(
  _previousState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminPermission("purchasing:write");

  let invoice;
  try {
    // createPurchaseInvoice drops the blank rows and checks the rest — supplier,
    // per-line kind, quantity and rate, payment rules — so the reasons live in
    // one place and each surfaces here by its own words.
    invoice = await createPurchaseInvoice({
      supplierLedgerId: textValue(formData, "supplierLedgerId"),
      supplierName: textValue(formData, "supplierName"),
      phone: textValue(formData, "phone"),
      items: purchaseItems(formData),
      discount: numberValue(formData, "discount"),
      tax: numberValue(formData, "tax"),
      paidAmount: numberValue(formData, "paidAmount"),
      paymentMethod: optionValue(textValue(formData, "paymentMethod"), paymentMethods, "Cash"),
      paymentReference: textValue(formData, "paymentReference"),
      note: textValue(formData, "note"),
    });
  } catch (error) {
    reportError("save purchase bill", error);
    return { ok: false, message: saveFailureMessage(error, "Could not save this purchase.") };
  }

  await recordAdminAuditEvent(
    "purchase_create_invoice",
    `${invoice.purchaseNumber} ${invoice.kind.toLowerCase()} purchase recorded: ${invoice.items.length} item(s), Rs. ${invoice.total}.`,
  );

  revalidatePath("/admin");
  revalidatePath("/admin/purchasing");
  revalidatePath("/admin/operations");

  // Any bill with a trading line changes what the shop can sell — including a
  // Mixed bill, which the old Trading-Goods-only check quietly skipped.
  if (invoice.kind === "Trading Goods" || invoice.kind === "Mixed") {
    revalidatePath("/admin/products");
    revalidatePath("/shop", "layout");
    revalidatePath("/product", "layout");
    revalidatePath("/");
  }

  return {
    ok: true,
    message: `Saved ${invoice.purchaseNumber} — ${invoice.items.length} item(s), Rs. ${invoice.total.toLocaleString("en-IN")}.`,
    href: "/admin/purchasing",
  };
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
