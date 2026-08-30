"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/app/admin/actions";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { addCustomerLedger, type CustomerLedger } from "@/lib/operations";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError, reportingErrors } from "@/lib/report-error";
import { syncProductCatalogStockWithFinishedStock } from "@/lib/product-store";
import {
  createPosInvoice,
  repairPosInvoicePosting,
  type PosChannel,
  type PosInvoiceKind,
  type PosPaymentMethod,
} from "@/lib/pos";

// A bill moves finished stock, and the shop reads products.stock — so the
// catalog is recomputed right after, the same way the operations screens do it.
// The bill is already saved, so a sync hiccup is logged, never thrown: the sale
// must not fail for a follow-up step, and the manual Catalog sync stays as a
// backstop.
async function syncCatalogStockAfterBill(what: string) {
  await reportingErrors(`sync catalog stock after ${what}`, () =>
    syncProductCatalogStockWithFinishedStock(),
  );
}

const channels: PosChannel[] = ["Retail", "Wholesale", "Online"];
const invoiceKinds: PosInvoiceKind[] = ["Sale", "Return"];
const paymentMethods: PosPaymentMethod[] = ["Cash", "Cheque", "Credit", "QR", "eSewa", "Khalti", "Bank"];
const referencePaymentMethods: PosPaymentMethod[] = ["Cheque", "QR", "eSewa", "Khalti", "Bank"];
const ledgerChannels: CustomerLedger["channel"][] = ["Wholesale", "Retail", "Online"];

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
    return {
      ok: false,
      message:
        "उधारो बिलमा तिरेको रकम राख्न मिल्दैन — तिरेको छ भने Cash, QR, Cheque, Bank, eSewa वा Khalti छान्नुहोस्. " +
        "A Credit bill cannot carry a paid amount.",
    };
  }

  if (referencePaymentMethods.includes(paymentMethod) && paidAmount > 0 && !paymentReference) {
    return {
      ok: false,
      message: `${paymentMethod} बाट पैसा आएको हो भने reference नम्बर लेख्नुहोस्. ${paymentMethod} needs a reference number.`,
    };
  }

  if (kind === "Return" && !ledgerId) {
    return {
      ok: false,
      message:
        "फिर्ता कसको खातामा जान्छ, त्यो छान्नुहोस् — तल Customer account मा। " +
        "A return must be linked to a customer account.",
    };
  }

  let invoice;
  try {
    invoice = await createPosInvoice({
      channel: optionValue(textValue(formData, "channel"), channels, "Retail"),
      kind,
      customerName: textValue(formData, "customerName"),
      phone: textValue(formData, "phone"),
      customerAddress: textValue(formData, "customerAddress"),
      customerPan: textValue(formData, "customerPan"),
      cashier: textValue(formData, "cashier"),
      paymentMethod,
      paymentReference,
      ledgerId,
      invoiceDiscount: numberValue(formData, "invoiceDiscount"),
      tax: numberValue(formData, "tax"),
      paidAmount,
      note: textValue(formData, "note"),
      sourceSubmissionKey: textValue(formData, "sourceSubmissionKey"),
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

  // Recompute the catalog stock so the shop shows the pairs this bill just
  // moved, without waiting for a manual Catalog sync.
  await syncCatalogStockAfterBill("POS bill");

  // A bill changes stock, and the prerendered home/category pages carry stock
  // badges — refresh everything, not a hand-picked list.
  revalidatePath("/", "layout");

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

  // The repair created the stock movements the bill was missing, so recompute
  // the catalog stock to match.
  await syncCatalogStockAfterBill("POS posting repair");

  revalidatePath("/admin");
  revalidatePath("/admin/pos");
  revalidatePath(`/admin/pos/${id}`);
  revalidatePath("/admin/operations");
  revalidatePath("/admin/costing");
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  redirect(posReturnPath(formData, id));
}

/**
 * Open a customer's credit account without leaving the bill.
 *
 * An unpaid or part-paid sale has to land in somebody's account — otherwise the
 * shop has given away pairs with no record of who owes for them. The counter
 * used to learn this only after pressing Save, as an English sentence from deep
 * in the library ("Credit or partial POS sale must be linked to a customer
 * ledger"), with the only cure being to abandon the bill, walk to
 * /admin/operations, open an account there, and key the whole bill again. It
 * happened twice on the morning of 2026-08-24, an hour apart, and the shop has
 * one POS bill to show for it.
 *
 * So the account is opened from where the problem is noticed. The name and
 * phone are already typed on the bill; this turns them into an account and
 * hands its id straight back to the form.
 */
export async function openPosCustomerLedgerAction(input: {
  customerName: string;
  phone: string;
  channel: string;
}): Promise<ActionState & { ledger?: { id: string; label: string } }> {
  await requireAdminPermission("operations:write");

  const customerName = input.customerName.trim();

  if (!customerName) {
    return {
      ok: false,
      message: "ग्राहकको नाम लेख्नुहोस्, अनि खाता खुल्छ। — Type the customer's name first.",
    };
  }

  const channel = optionValue(input.channel.trim(), ledgerChannels, "Retail");

  let ledger;
  try {
    ledger = await addCustomerLedger({
      customerName,
      channel,
      phone: input.phone.trim(),
      cashPaid: 0,
      chequePaid: 0,
      creditGiven: 0,
      balanceDue: 0,
      creditLimit: 0,
    });
  } catch (error) {
    reportError("open customer ledger from POS", error);
    return { ok: false, message: saveFailureMessage(error, "खाता खोल्न सकिएन। — Could not open the account.") };
  }

  await recordAdminAuditEvent(
    "operations_create_customer_ledger",
    `Customer ledger ${customerName} opened from the POS bill screen.`,
  );

  revalidatePath("/admin/operations");
  revalidatePath("/admin/pos");

  return {
    ok: true,
    message: `${customerName} को खाता खुल्यो ✅ — account opened.`,
    ledger: { id: ledger.id, label: `${ledger.customerName} (${ledger.channel})` },
  };
}
