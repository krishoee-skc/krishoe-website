"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import {
  createPosInvoice,
  repairPosInvoicePosting,
  type PosChannel,
  type PosInvoiceKind,
  type PosPaymentMethod,
} from "@/lib/pos";

const channels: PosChannel[] = ["Retail", "Wholesale", "Online"];
const invoiceKinds: PosInvoiceKind[] = ["Sale", "Return"];
const paymentMethods: PosPaymentMethod[] = ["Cash", "Cheque", "Credit", "QR", "eSewa", "Khalti", "Bank"];
const referencePaymentMethods: PosPaymentMethod[] = ["Cheque", "QR", "eSewa", "Khalti", "Bank"];

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

function posReturnPath(formData: FormData, invoiceId = "") {
  const returnTo = textValue(formData, "returnTo");

  if (returnTo === "/admin/pos" || (invoiceId && returnTo === `/admin/pos/${invoiceId}`)) {
    return returnTo;
  }

  return "/admin/pos";
}

function invoiceItems(formData: FormData) {
  return Array.from({ length: 6 }, (_, index) => {
    const row = index + 1;

    return {
      sku: textValue(formData, `item${row}Sku`),
      design: textValue(formData, `item${row}Design`),
      sizeRun: textValue(formData, `item${row}SizeRun`),
      quantity: numberValue(formData, `item${row}Quantity`),
      rate: numberValue(formData, `item${row}Rate`),
      discount: numberValue(formData, `item${row}Discount`),
    };
  });
}

export async function createPosInvoiceAction(formData: FormData) {
  await requireAdminPermission("pos:write");

  const kind = optionValue(textValue(formData, "kind"), invoiceKinds, "Sale");
  const paymentMethod = optionValue(textValue(formData, "paymentMethod"), paymentMethods, "Cash");
  const paymentReference = textValue(formData, "paymentReference");
  const ledgerId = textValue(formData, "ledgerId");
  const paidAmount = numberValue(formData, "paidAmount");

  if (paymentMethod === "Credit" && paidAmount > 0) {
    throw new Error("Credit POS bill cannot have paid amount. Use Cash, QR, Cheque, Bank, eSewa, or Khalti for payments.");
  }

  if (referencePaymentMethods.includes(paymentMethod) && paidAmount > 0 && !paymentReference) {
    throw new Error(`${paymentMethod} payment reference is required when paid amount is entered.`);
  }

  if (kind === "Return" && !ledgerId) {
    throw new Error("POS return must be linked to a customer ledger.");
  }

  const invoice = await createPosInvoice({
    channel: optionValue(textValue(formData, "channel"), channels, "Retail"),
    kind,
    customerName: textValue(formData, "customerName"),
    phone: textValue(formData, "phone"),
    cashier: textValue(formData, "cashier"),
    paymentMethod,
    paymentReference,
    ledgerId,
    invoiceDiscount: numberValue(formData, "invoiceDiscount"),
    tax: numberValue(formData, "tax"),
    paidAmount,
    note: textValue(formData, "note"),
    items: invoiceItems(formData),
  });

  await appendAdminAuditEvent(
    "pos_create_invoice",
    `${invoice.invoiceNumber} ${invoice.kind.toLowerCase()} invoice recorded for Rs. ${invoice.total}.`,
  ).catch(() => undefined);

  revalidatePath("/admin");
  revalidatePath("/admin/pos");
  revalidatePath("/admin/operations");
  revalidatePath("/admin/products");
  revalidatePath("/admin/costing");
  revalidatePath("/shop");
  redirect(`/admin/pos/${invoice.id}`);
}

export async function repairPosInvoicePostingAction(formData: FormData) {
  await requireAdminPermission("pos:write");

  const id = textValue(formData, "id");

  if (!id) {
    throw new Error("POS invoice id is required.");
  }

  const result = await repairPosInvoicePosting(id);

  await appendAdminAuditEvent(
    "pos_repair_posting",
    `${result.invoice.invoiceNumber} posting repaired with ${result.createdStockMovementIds.length} stock movement(s)${
      result.createdLedgerTransactionId ? " and 1 ledger transaction" : ""
    }.`,
  ).catch(() => undefined);

  revalidatePath("/admin");
  revalidatePath("/admin/pos");
  revalidatePath(`/admin/pos/${id}`);
  revalidatePath("/admin/operations");
  revalidatePath("/admin/costing");
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  redirect(posReturnPath(formData, id));
}
