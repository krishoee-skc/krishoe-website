"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/app/admin/actions";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";
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

// A ceiling on one submitted form, not on what a bill may hold. It only stops a
// hand-crafted request asking the server to build an unbounded number of rows.
const MAX_POS_ITEMS = 200;

// The form says how many rows it rendered. This used to read item1..item6 and
// nothing else: a seventh item on a counter sale was silently dropped, with no
// error and no sign on the bill.
function invoiceItems(formData: FormData) {
  const declared = numberValue(formData, "itemCount");
  const count = Math.min(Math.max(Math.trunc(declared), 0), MAX_POS_ITEMS);

  return Array.from({ length: count }, (_, index) => ({
    sku: textValue(formData, `item${index}Sku`),
    design: textValue(formData, `item${index}Design`),
    sizeRun: textValue(formData, `item${index}SizeRun`),
    quantity: numberValue(formData, `item${index}Quantity`),
    rate: numberValue(formData, `item${index}Rate`),
    discount: numberValue(formData, `item${index}Discount`),
  }));
}

// Returns the outcome instead of throwing. A bill that failed used to take the
// cashier to the admin error page — the whole counter sale gone with it, and no
// word of why. Now the reason ("Item 2 needs a rate", "POS return must be linked
// to a customer ledger", an oversell) comes back beside the Save button with the
// bill still standing, and a saved bill returns the receipt link to open.
export async function createPosInvoiceAction(
  _previousState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminPermission("pos:write");

  const kind = optionValue(textValue(formData, "kind"), invoiceKinds, "Sale");
  const paymentMethod = optionValue(textValue(formData, "paymentMethod"), paymentMethods, "Cash");
  const paymentReference = textValue(formData, "paymentReference");
  const ledgerId = textValue(formData, "ledgerId");
  const paidAmount = numberValue(formData, "paidAmount");

  if (paymentMethod === "Credit" && paidAmount > 0) {
    return { ok: false, message: "A Credit bill cannot have a paid amount. Use Cash, QR, Cheque, Bank, eSewa, or Khalti." };
  }

  if (referencePaymentMethods.includes(paymentMethod) && paidAmount > 0 && !paymentReference) {
    return { ok: false, message: `${paymentMethod} needs a reference number when a paid amount is entered.` };
  }

  if (kind === "Return" && !ledgerId) {
    return { ok: false, message: "A return must be linked to a customer ledger." };
  }

  let invoice;
  try {
    invoice = await createPosInvoice({
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
  } catch (error) {
    reportError("save POS bill", error);
    return { ok: false, message: saveFailureMessage(error, "Could not save this bill.") };
  }

  await recordAdminAuditEvent(
    "pos_create_invoice",
    `${invoice.invoiceNumber} ${invoice.kind.toLowerCase()} invoice recorded for Rs. ${invoice.total}.`,
  );

  revalidatePath("/admin");
  revalidatePath("/admin/pos");
  revalidatePath("/admin/operations");
  revalidatePath("/admin/products");
  revalidatePath("/admin/costing");
  revalidatePath("/shop");

  return {
    ok: true,
    message: `Saved ${invoice.invoiceNumber} — Rs. ${invoice.total.toLocaleString("en-IN")}.`,
    href: `/admin/pos/${invoice.id}`,
  };
}

export async function repairPosInvoicePostingAction(formData: FormData) {
  await requireAdminPermission("pos:write");

  const id = textValue(formData, "id");

  if (!id) {
    throw new Error("POS invoice id is required.");
  }

  const result = await repairPosInvoicePosting(id);

  await recordAdminAuditEvent(
    "pos_repair_posting",
    `${result.invoice.invoiceNumber} posting repaired with ${result.createdStockMovementIds.length} stock movement(s)${
      result.createdLedgerTransactionId ? " and 1 ledger transaction" : ""
    }.`,
  );

  revalidatePath("/admin");
  revalidatePath("/admin/pos");
  revalidatePath(`/admin/pos/${id}`);
  revalidatePath("/admin/operations");
  revalidatePath("/admin/costing");
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  redirect(posReturnPath(formData, id));
}
