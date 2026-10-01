"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/app/admin/actions";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { createCounterItem, CounterItemRefusal, type CounterItemInput } from "@/lib/counter-items";
import { chequeAmount, chequeStates, setChequeState, type ChequeState } from "@/lib/cheques";
import { addCheque, chequeBookReady } from "@/lib/cheque-book";
import { recordSaveTime } from "@/lib/save-timing";
import { addCustomerLedger, type CustomerLedger } from "@/lib/operations";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError, reportingErrors } from "@/lib/report-error";
import { syncProductCatalogStockWithFinishedStock } from "@/lib/product-store";
import {
  createPosExchange,
  createPosInvoice,
  getPosInvoiceById,
  repairPosInvoicePosting,
  type PosChannel,
  type PosInvoiceKind,
  type PosPaymentMethod,
} from "@/lib/pos";
import { PAYMENT_PART_METHODS, readPaymentParts, type PosPaymentPartMethod } from "@/lib/pos-payments";

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
    // The customer's size and colour. The save decides which stock row the
    // size draws from; see stockRowForSize.
    size: textValue(formData, `item${index}Size`).slice(0, 8),
    color: textValue(formData, `item${index}Color`).slice(0, 40),
  }));
}

// A bill paid in parts sends them as one JSON field; anything malformed in it
// is dropped rather than trusted.
function paymentPartsFrom(formData: FormData) {
  const raw = textValue(formData, "paymentParts");
  if (!raw) return [];
  try {
    return readPaymentParts(JSON.parse(raw)).slice(0, 6);
  } catch {
    return [];
  }
}

function partMethod(value: string): PosPaymentPartMethod {
  return PAYMENT_PART_METHODS.find((method) => method === value && method !== "Exchange") ?? "Cash";
}

// The customer's older credit, cleared on this bill.
function dueFrom(formData: FormData) {
  const amount = numberValue(formData, "dueAmount");
  const ledgerId = textValue(formData, "dueLedgerId");
  if (amount <= 0 || !ledgerId) return undefined;
  return {
    ledgerId,
    amount,
    method: partMethod(textValue(formData, "dueMethod")),
    reference: textValue(formData, "dueReference"),
  };
}

// Returns the outcome instead of throwing. A bill that failed used to take the
// cashier to the admin error page — the whole counter sale gone with it, and no
// word of why. Now the reason ("Item 2 needs a rate", "POS return must be linked
// to a customer ledger", an oversell) comes back beside the Save button with the
// bill still standing, and a saved bill returns the receipt link to open.
export async function createPosInvoiceAction(
  previousState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  // Timed from the press to the answer, so the monitoring screen can say how
  // long a bill takes to save (owner, 2026-09-30).
  const startedAt = Date.now();
  const result = await saveBill(previousState, formData);
  if (result.ok) {
    await recordSaveTime(textValue(formData, "kind") === "Exchange" ? "Exchange (counter)" : "Bill (counter)", startedAt);
  }
  return result;
}

async function saveBill(_previousState: ActionState | null, formData: FormData): Promise<ActionState> {
  await requireAdminPermission("pos:write");

  if (textValue(formData, "kind") === "Exchange") {
    return saveExchange(formData);
  }

  const kind = optionValue(textValue(formData, "kind"), invoiceKinds, "Sale");
  const paymentParts = paymentPartsFrom(formData);
  const paymentMethod = optionValue(textValue(formData, "paymentMethod"), paymentMethods, "Cash");
  const paymentReference = textValue(formData, "paymentReference");
  const ledgerId = textValue(formData, "ledgerId");
  const paidAmount = numberValue(formData, "paidAmount");

  // A bill paid in parts is checked part by part in the library, which knows
  // the total; these one-method checks are for a bill paid one way.
  if (paymentParts.length === 0 && paymentMethod === "Credit" && paidAmount > 0) {
    return {
      ok: false,
      message:
        "उधारो बिलमा तिरेको रकम राख्न मिल्दैन — तिरेको छ भने Cash, QR, Cheque, Bank, eSewa वा Khalti छान्नुहोस्. " +
        "A Credit bill cannot carry a paid amount.",
    };
  }

  if (paymentParts.length === 0 && referencePaymentMethods.includes(paymentMethod) && paidAmount > 0 && !paymentReference) {
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

  // A cheque can bounce, so the bill has to say whose it was (owner,
  // 2026-09-30: Rs. 10,500 by cheque sat under "Walk-in Customer"). Cash, QR
  // and the rest need no name.
  const paidByCheque = paymentParts.length > 0 ? paymentParts.some((part) => part.method === "Cheque") : paymentMethod === "Cheque";
  if (kind === "Sale" && paidByCheque && !textValue(formData, "customerName")) {
    return {
      ok: false,
      // The form asks for the name first, in both languages; this is the backstop.
      message: "A cheque bill needs the customer's name.",
    };
  }
  // The cheque book wants the bank and the cheque's date (owner, 2026-10-01).
  // Asked only once its table is there; the form asks first.
  const chequeBookOn = kind === "Sale" && paidByCheque && (await chequeBookReady());
  if (chequeBookOn && (!textValue(formData, "chequeBank") || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(textValue(formData, "chequeDate")))) {
    return { ok: false, message: "A cheque needs its bank and its date." };
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
      paymentParts,
      collectDue: dueFrom(formData),
    });
  } catch (error) {
    reportError("save POS bill", error);
    return { ok: false, message: saveFailureMessage(error, "Could not save this bill.") };
  }

  await recordAdminAuditEvent(
    "pos_create_invoice",
    `${invoice.invoiceNumber} ${invoice.kind.toLowerCase()} invoice recorded for Rs. ${invoice.total}.`,
  );

  // Into the cheque book, after the bill is safe: a cheque that fails to file
  // never undoes the sale, and the book lists the bill to fill in instead.
  if (chequeBookOn && chequeAmount(invoice) > 0) {
    const chequePart = (invoice.payments ?? []).find((part) => part.method === "Cheque" && part.purpose !== "refund");
    const { session } = await requireAdminPermission("pos:write");
    await reportingErrors(`file the cheque on ${invoice.invoiceNumber}`, () =>
      addCheque({
        direction: "in",
        source: "bill",
        sourceId: invoice.id,
        sourceNumber: invoice.invoiceNumber,
        partyName: invoice.customerName,
        partyPhone: invoice.phone,
        bank: textValue(formData, "chequeBank"),
        chequeNo: chequePart?.reference || invoice.paymentReference,
        amount: chequeAmount(invoice),
        chequeDate: textValue(formData, "chequeDate"),
        nameOnCheque: textValue(formData, "chequeName"),
        by: session.name ?? "",
      }),
    );
  }

  // The catalog stock was recomputed inside createPosInvoice; doing it again
  // here read the whole stock a second time on every bill (owner, 2026-09-30).

  // A bill changes stock, and the prerendered home/category pages carry stock
  // badges — refresh everything, not a hand-picked list.
  revalidatePath("/", "layout");

  return {
    ok: true,
    message: `Saved ${invoice.invoiceNumber} — Rs. ${invoice.total.toLocaleString("en-IN")}.`,
    href: `/admin/pos/${invoice.id}`,
  };
}

/**
 * An exchange: the lines marked "in" came back, the lines marked "out" left.
 * Saved as a return and a sale that settle against each other; the receipt
 * opened is the sale's, which names the return.
 */
async function saveExchange(formData: FormData): Promise<ActionState> {
  const items = invoiceItems(formData);
  const directions = items.map((_, index) => textValue(formData, `item${index}Direction`));
  const returnedItems = items.filter((_, index) => directions[index] === "in");
  const soldItems = items.filter((_, index) => directions[index] !== "in");

  let result;
  try {
    result = await createPosExchange({
      channel: optionValue(textValue(formData, "channel"), channels, "Retail"),
      customerName: textValue(formData, "customerName"),
      phone: textValue(formData, "phone"),
      customerAddress: textValue(formData, "customerAddress"),
      customerPan: textValue(formData, "customerPan"),
      cashier: textValue(formData, "cashier"),
      paymentMethod: "Cash",
      paymentReference: "",
      ledgerId: textValue(formData, "ledgerId"),
      invoiceDiscount: numberValue(formData, "invoiceDiscount"),
      tax: numberValue(formData, "tax"),
      paidAmount: 0,
      note: textValue(formData, "note"),
      sourceSubmissionKey: textValue(formData, "sourceSubmissionKey"),
      returnedItems,
      soldItems,
      paymentParts: paymentPartsFrom(formData),
      refundMethod: partMethod(textValue(formData, "refundMethod")),
    });
  } catch (error) {
    reportError("save POS exchange", error);
    return { ok: false, message: saveFailureMessage(error, "Could not save this exchange.") };
  }

  const { returnInvoice, saleInvoice } = result;
  await recordAdminAuditEvent(
    "pos_create_invoice",
    `Exchange: ${returnInvoice.invoiceNumber} return (Rs. ${returnInvoice.total}) against ${saleInvoice.invoiceNumber} sale (Rs. ${saleInvoice.total}).`,
  );
  revalidatePath("/", "layout");

  return {
    ok: true,
    message: `Saved ${saleInvoice.invoiceNumber} with ${returnInvoice.invoiceNumber}.`,
    href: `/admin/pos/${saleInvoice.id}`,
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

export type CounterItemResult =
  | {
      ok: true;
      message: string;
      item: {
        design: string;
        sku: string;
        category: string;
        sizes: Record<string, number>;
        sizeList: string[];
        pilePairs: number;
        pairs: number;
        retailRate: number;
        wholesaleRate: number;
        minWholesaleQty: number;
        costPerPair: number;
      };
    }
  | { ok: false; message: string; messageNe: string; sameAs: string[] };

/**
 * "+ New item" on the counter bill: put goods on the books and sell them now
 * (owner, 2026-09-29), from a retail or a wholesale bill (2026-09-30). Anyone who may cut a bill may add them; every one is recorded in
 * the audit log and waits for the Owner's look.
 */
export async function createCounterItemAction(input: CounterItemInput): Promise<CounterItemResult> {
  const { session } = await requireAdminPermission("pos:write");
  try {
    const item = await createCounterItem({
      ...input,
      createdBy: session?.name || session?.email || "Counter",
    });
    await recordAdminAuditEvent(
      "counter_item_added",
      `${item.design} (${item.sku}) added from the ${input.channel === "Wholesale" ? "wholesale" : "retail"} counter: ${item.pairs} pairs, Rs. ${item.retailRate}` +
        `${(input.wholesalePrice ?? 0) > 0 ? `, wholesale Rs. ${input.wholesalePrice}` : ""}` +
        `${input.costPerPair > 0 ? `, cost Rs. ${input.costPerPair}` : ", cost to come"}, came as ${input.how}.`,
    );
    revalidatePath("/admin/pos");
    revalidatePath("/admin/stock");
    return { ok: true, message: `${item.design} added: ${item.pairs} pairs at the shop.`, item };
  } catch (error) {
    if (error instanceof CounterItemRefusal) {
      return { ok: false, message: error.message, messageNe: error.ne, sameAs: error.sameAs };
    }
    reportError("add an item from the counter bill", error);
    return {
      ok: false,
      message: saveFailureMessage(error, "Could not add the item."),
      messageNe: "माल थप्न सकिएन। फेरि प्रयास गर्नुहोस्।",
      sameAs: [],
    };
  }
}

/**
 * A cheque on a bill: the bank paid it, it bounced, or after a bounce the money
 * came in another way (owner, 2026-09-30). Anyone who may cut a bill may say
 * so; every mark is in the audit log.
 */
export async function setChequeStateAction(formData: FormData) {
  const { session } = await requireAdminPermission("pos:write");
  const id = String(formData.get("id") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  if (!chequeStates.some((option) => option === state)) return;
  const invoice = id ? await getPosInvoiceById(id) : null;
  if (!invoice || chequeAmount(invoice) <= 0) return;
  const by = session?.name || session?.email || "Counter";
  await setChequeState(invoice.id, state as ChequeState, by);
  await recordAdminAuditEvent(
    "pos_cheque_marked",
    `Cheque on ${invoice.invoiceNumber} (${invoice.customerName}, Rs. ${chequeAmount(invoice)}) marked ${state} by ${by}.`,
  );
  revalidatePath("/admin/pos");
}
