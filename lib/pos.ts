import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { writeFileAtomic } from "@/lib/atomic-json";
import path from "node:path";
import { getDataBackend, runWithDataBackend } from "@/lib/data-backend";
import {
  addLedgerTransaction,
  addStockMovement,
  getOperationsData,
  type FinishedStock,
  type LedgerTransaction,
  type OperationsData,
  type StockMovement,
  getOperationsDataForReports,
} from "@/lib/operations";
import {
  moneyByMethod,
  paidTowardBill,
  paymentPartsProblem,
  readPaymentParts,
  settleExchange,
  settledByExchange,
  type PosPaymentPart,
  type PosPaymentPartMethod,
} from "@/lib/pos-payments";
import {
  createPosExchangePostgres,
  createPosInvoicePostgres,
  getPosInvoicesFromPostgres,
  savePosInvoiceToPostgres,
  updatePosInvoicePostingToPostgres,
} from "@/lib/pos-postgres";
import { getProducts, syncProductCatalogStockWithFinishedStock } from "@/lib/product-store";
import { stockRowForSize } from "@/lib/stock-by-size";

export type PosChannel = "Retail" | "Wholesale" | "Online";
export type PosInvoiceKind = "Sale" | "Return";
export type PosPaymentMethod = "Cash" | "Cheque" | "Credit" | "QR" | "eSewa" | "Khalti" | "Bank";
export type PosInvoiceStatus = "Paid" | "Partial" | "Credit" | "Returned" | "Voided";
export type PosPostingStatus = "Posted" | "Needs Review";

export type PosInvoiceItem = {
  id: string;
  sku: string;
  design: string;
  sizeRun: string;
  quantity: number;
  rate: number;
  discount: number;
  lineTotal: number;
  /**
   * The customer's own size and colour, for the receipt. sizeRun above is the
   * stock row the pairs moved, which for an uncounted pile reads "Mixed" — true
   * for the books, and no use to a customer asking which size they took.
   * Absent on bills saved before the counter asked for them.
   */
  size?: string;
  color?: string;
};

export type PosInvoice = {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  channel: PosChannel;
  kind: PosInvoiceKind;
  customerName: string;
  phone: string;
  customerAddress: string;
  customerPan: string;
  cashier: string;
  paymentMethod: PosPaymentMethod;
  paymentReference: string;
  ledgerId: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  creditAmount: number;
  status: PosInvoiceStatus;
  postingStatus: PosPostingStatus;
  items: PosInvoiceItem[];
  stockMovementIds: string[];
  ledgerTransactionId: string;
  barcodeValue: string;
  qrPayload: string;
  note: string;
  sourceSubmissionKey: string;
  /**
   * How it was paid, part by part — see lib/pos-payments.ts. Empty for a bill
   * paid one way, which reads by paymentMethod and paidAmount as it always did.
   */
  payments?: PosPaymentPart[];
};

export type PosDayClosePaymentRow = {
  paymentMethod: PosPaymentMethod;
  invoiceCount: number;
  saleTotal: number;
  returnTotal: number;
  netTotal: number;
  paidAmount: number;
  creditAmount: number;
};

export type PosDayCloseReport = {
  date: string;
  invoiceCount: number;
  saleInvoiceCount: number;
  returnInvoiceCount: number;
  salesTotal: number;
  returnsTotal: number;
  netSales: number;
  paidAmount: number;
  creditAmount: number;
  cashAmount: number;
  chequeAmount: number;
  qrAmount: number;
  eSewaAmount: number;
  khaltiAmount: number;
  bankAmount: number;
  postingNeedsReview: number;
  paymentRows: PosDayClosePaymentRow[];
  channelRows: Array<{
    channel: PosChannel;
    invoiceCount: number;
    saleTotal: number;
    returnTotal: number;
    netTotal: number;
    creditAmount: number;
  }>;
  cashierRows: Array<{
    cashier: string;
    invoiceCount: number;
    saleTotal: number;
    returnTotal: number;
    netTotal: number;
    paidAmount: number;
    creditAmount: number;
  }>;
};

export type PosInvoicePostingPatch = {
  stockMovementIds: string[];
  ledgerTransactionId: string;
  postingStatus: PosPostingStatus;
};

export type PosPostingRepairResult = {
  invoice: PosInvoice;
  createdStockMovementIds: string[];
  createdLedgerTransactionId: string;
};

export type CreatePosInvoiceInput = {
  channel: PosChannel;
  kind: PosInvoiceKind;
  customerName: string;
  phone: string;
  customerAddress?: string;
  customerPan?: string;
  cashier: string;
  paymentMethod: PosPaymentMethod;
  paymentReference: string;
  ledgerId: string;
  invoiceDiscount: number;
  tax: number;
  paidAmount: number;
  note: string;
  sourceSubmissionKey?: string;
  items: Array<{
    sku: string;
    design: string;
    sizeRun: string;
    quantity: number;
    rate: number;
    discount: number;
    size?: string;
    color?: string;
  }>;
  /**
   * The bill paid in more than one way — "Rs 1,000 cash and the rest by QR".
   * Only the parts toward this bill; the first part names the bill's method.
   */
  paymentParts?: PosPaymentPart[];
  /** The customer's older credit, cleared on the same bill. */
  collectDue?: {
    ledgerId: string;
    amount: number;
    method: PosPaymentPartMethod;
    reference?: string;
  };
};

/**
 * An exchange: pairs that came back and pairs that left, as one event.
 *
 * Saved as two bills, a return and a sale, in one transaction. The returned
 * pairs pay for the new ones as far as they go; the rest is paid for by the
 * parts, or handed back. No customer account is needed — that is the owner's
 * rule for an exchange — unless part of the new bill is left on credit.
 */
export type CreatePosExchangeInput = Omit<
  CreatePosInvoiceInput,
  "kind" | "items" | "paymentParts" | "collectDue"
> & {
  returnedItems: CreatePosInvoiceInput["items"];
  soldItems: CreatePosInvoiceInput["items"];
  /** Toward what is still owed for the new pairs. */
  paymentParts?: PosPaymentPart[];
  /** How the difference goes back, when the returned pairs were worth more. */
  refundMethod?: PosPaymentPartMethod;
};

const dataDirectory = path.join(process.cwd(), "data");
const posInvoicesPath = path.join(dataDirectory, "pos-invoices.json");
const posChannels: PosChannel[] = ["Retail", "Wholesale", "Online"];
const posPaymentMethods: PosPaymentMethod[] = ["Cash", "Cheque", "Credit", "QR", "eSewa", "Khalti", "Bank"];

function createId(prefix: string) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `${prefix}-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function cleanText(value: string) {
  return value.trim();
}

function cleanSubmissionKey(value: string | undefined) {
  return cleanText(value ?? "").slice(0, 180);
}

function idFromSubmissionKey(prefix: string, sourceSubmissionKey: string) {
  const digest = createHash("sha256").update(sourceSubmissionKey).digest("hex").slice(0, 24).toUpperCase();
  return `${prefix}-SUB-${digest}`;
}

function cleanNumber(value: number) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10).replaceAll("-", "");
}

function currentDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function invoiceDateKey(value: string) {
  return value.slice(0, 10);
}

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function currentYearKey() {
  return new Date().toISOString().slice(0, 4);
}

function sum<T>(items: T[], getValue: (item: T) => number) {
  return items.reduce((total, item) => total + getValue(item), 0);
}

function sameDesign(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function invoiceStockMovementType(kind: PosInvoiceKind) {
  return kind === "Sale" ? "Sale Out" : "Return In";
}

function invoiceLedgerTransactionType(kind: PosInvoiceKind) {
  return kind === "Sale" ? "Credit Sale" : "Return Adjustment";
}

function invoiceNeedsLedger(invoice: Pick<PosInvoice, "kind" | "creditAmount" | "payments">) {
  // A return settled against a new pair in an exchange owes nobody anything.
  return (
    (invoice.kind === "Sale" && invoice.creditAmount > 0) ||
    (invoice.kind === "Return" && !settledByExchange(invoice))
  );
}

function groupInvoiceItemsByDesign(items: PosInvoiceItem[]) {
  const groups = new Map<string, { design: string; pairs: number; skus: Set<string> }>();

  for (const item of items) {
    const key = item.design.trim().toLowerCase();
    const group = groups.get(key) ?? {
      design: item.design,
      pairs: 0,
      skus: new Set<string>(),
    };

    group.pairs += cleanNumber(item.quantity);

    if (item.sku) {
      group.skus.add(item.sku);
    }

    groups.set(key, group);
  }

  return [...groups.values()];
}

function invoiceStockMovementNote(invoice: PosInvoice, design: string, sku: string, action = "posted") {
  return `${invoice.invoiceNumber} ${invoice.kind.toLowerCase()} ${action} ${sku || design}`.trim();
}

function movementMatchesInvoice(
  movement: OperationsData["stockMovements"][number],
  invoice: PosInvoice,
) {
  // Not matched on channel: stock lives in one pool, so a movement's channel is
  // the pool's, which need not equal the channel the sale was reported on. The
  // invoice number in the note is unique and is the real link.
  return (
    movement.type === invoiceStockMovementType(invoice.kind) &&
    movement.note.includes(invoice.invoiceNumber)
  );
}

function linkedInvoiceStockMovements(invoice: PosInvoice, operations: OperationsData) {
  const stockMovementsById = new Map(operations.stockMovements.map((movement) => [movement.id, movement]));
  const linked = invoice.stockMovementIds
    .map((movementId) => stockMovementsById.get(movementId))
    .filter((movement): movement is OperationsData["stockMovements"][number] => Boolean(movement));
  const discovered = operations.stockMovements.filter((movement) => movementMatchesInvoice(movement, invoice));

  return [...new Map(linked.concat(discovered).map((movement) => [movement.id, movement])).values()];
}

function matchingInvoiceLedgerTransaction(invoice: PosInvoice, operations: OperationsData) {
  if (!invoiceNeedsLedger(invoice)) {
    return { transactionId: "", mismatch: false };
  }

  const expectedType = invoiceLedgerTransactionType(invoice.kind);
  const expectedAmount = invoice.kind === "Sale" ? invoice.creditAmount : invoice.total;
  const isExpectedTransaction = (transaction: OperationsData["ledgerTransactions"][number]) =>
    transaction.ledgerId === invoice.ledgerId &&
    transaction.type === expectedType &&
    transaction.amount === expectedAmount;

  if (invoice.ledgerTransactionId) {
    const linked = operations.ledgerTransactions.find(
      (transaction) => transaction.id === invoice.ledgerTransactionId,
    );

    if (linked) {
      return {
        transactionId: linked.id,
        mismatch: !isExpectedTransaction(linked),
      };
    }
  }

  const discovered = operations.ledgerTransactions.find(
    (transaction) => isExpectedTransaction(transaction) && transaction.note.includes(invoice.invoiceNumber),
  );

  return {
    transactionId: discovered?.id ?? "",
    mismatch: false,
  };
}

function requiresPaymentReference(paymentMethod: PosPaymentMethod) {
  return paymentMethod === "Cheque" || paymentMethod === "QR" || paymentMethod === "eSewa" || paymentMethod === "Khalti" || paymentMethod === "Bank";
}

function validatePaymentInput(input: Pick<CreatePosInvoiceInput, "kind" | "paymentMethod" | "paymentReference" | "paidAmount" | "ledgerId">, creditAmount: number) {
  const paidAmount = cleanNumber(input.paidAmount);
  const paymentReference = cleanText(input.paymentReference);
  const ledgerId = cleanText(input.ledgerId);

  if (input.paymentMethod === "Credit" && paidAmount > 0) {
    throw new Error("Credit POS bill cannot have paid amount. Use Cash, QR, Cheque, Bank, eSewa, or Khalti for payments.");
  }

  if (requiresPaymentReference(input.paymentMethod) && paidAmount > 0 && !paymentReference) {
    throw new Error(`${input.paymentMethod} payment reference is required when paid amount is entered.`);
  }

  if (input.kind === "Sale" && creditAmount > 0 && !ledgerId) {
    throw new Error(
      "उधारो वा आंशिक बिल कसको खातामा चढाउने, त्यो छान्नुहोस्। " +
        "A credit or part-paid sale must be linked to a customer account.",
    );
  }

  if (input.kind === "Return" && !ledgerId) {
    throw new Error(
      "फिर्ता कसको खातामा जान्छ, त्यो छान्नुहोस्। A return must be linked to a customer account.",
    );
  }
}

export function resolveStockRow(finishedStock: FinishedStock[], design: string, sizeRun: string) {
  // One pool per design: a shop holds a design's pairs once, not a separate pile
  // per channel. Stock bought on wholesale sells on retail or online just the
  // same, so the row is found by design and size, whatever channel it sits in.
  // The channel a sale is made on lives on the invoice, for revenue by channel —
  // it is not a wall around the stock.
  const matching = finishedStock.filter((stock) => sameDesign(stock.design, design));

  // Preference: exact size run, then the aggregate "Mixed" row, then a range
  // row (e.g. "36-41" that covers this size), then the row holding the most —
  // so a sale draws from where the pairs actually are. Mirrors the decrement.
  return (
    matching.find((stock) => sameDesign(stock.sizeRun, sizeRun)) ??
    matching.find((stock) => sameDesign(stock.sizeRun, "Mixed")) ??
    matching.find((stock) => stock.sizeRun.includes("-")) ??
    [...matching].sort((a, b) => b.stockPairs - a.stockPairs)[0]
  );
}

export function preflightSaleStock(operations: OperationsData, items: PosInvoiceItem[]) {
  // Sum requested pairs per resolved stock row so a design split across sizes is
  // checked correctly whether it lands on size-specific rows or a shared row.
  const requestedByRow = new Map<string, { stock: FinishedStock; pairs: number; label: string }>();

  for (const item of items) {
    const stock = resolveStockRow(operations.finishedStock, item.design, item.sizeRun);

    if (!stock) {
      throw new Error(`${item.design} is not in stock yet.`);
    }

    const label =
      stock.sizeRun && stock.sizeRun !== "Mixed"
        ? `${item.design} (size ${stock.sizeRun})`
        : item.design;
    const existing = requestedByRow.get(stock.id) ?? { stock, pairs: 0, label };
    existing.pairs += item.quantity;
    requestedByRow.set(stock.id, existing);
  }

  for (const request of requestedByRow.values()) {
    if (request.pairs > request.stock.stockPairs) {
      throw new Error(
        `${request.label} has only ${request.stock.stockPairs} pairs. Cannot bill ${request.pairs} pairs.`,
      );
    }
  }
}

function normalizeItem(item: Partial<PosInvoiceItem>): PosInvoiceItem {
  const quantity = cleanNumber(item.quantity ?? 0);
  const rate = cleanNumber(item.rate ?? 0);
  const discount = cleanNumber(item.discount ?? 0);
  const size = cleanText(item.size ?? "");
  const color = cleanText(item.color ?? "");

  return {
    id: cleanText(item.id ?? "") || createId("ITEM"),
    sku: cleanText(item.sku ?? ""),
    design: cleanText(item.design ?? ""),
    sizeRun: cleanText(item.sizeRun ?? "") || "Mixed",
    quantity,
    rate,
    discount,
    lineTotal: Math.max(0, quantity * rate - discount),
    ...(size ? { size } : {}),
    ...(color ? { color } : {}),
  };
}

function normalizeInvoice(invoice: Partial<PosInvoice>): PosInvoice {
  const items = Array.isArray(invoice.items) ? invoice.items.map(normalizeItem) : [];

  return {
    id: cleanText(invoice.id ?? "") || createId("POS"),
    invoiceNumber: cleanText(invoice.invoiceNumber ?? ""),
    createdAt: cleanText(invoice.createdAt ?? "") || new Date().toISOString(),
    channel: invoice.channel === "Wholesale" || invoice.channel === "Online" ? invoice.channel : "Retail",
    kind: invoice.kind === "Return" ? "Return" : "Sale",
    customerName: cleanText(invoice.customerName ?? ""),
    phone: cleanText(invoice.phone ?? ""),
    customerAddress: cleanText(invoice.customerAddress ?? ""),
    customerPan: cleanText(invoice.customerPan ?? ""),
    cashier: cleanText(invoice.cashier ?? ""),
    paymentMethod: invoice.paymentMethod ?? "Cash",
    paymentReference: cleanText(invoice.paymentReference ?? ""),
    ledgerId: cleanText(invoice.ledgerId ?? ""),
    subtotal: cleanNumber(invoice.subtotal ?? sum(items, (item) => item.lineTotal)),
    discount: cleanNumber(invoice.discount ?? 0),
    tax: cleanNumber(invoice.tax ?? 0),
    total: cleanNumber(invoice.total ?? 0),
    paidAmount: cleanNumber(invoice.paidAmount ?? 0),
    creditAmount: cleanNumber(invoice.creditAmount ?? 0),
    status: invoice.status ?? "Paid",
    postingStatus: invoice.postingStatus ?? "Needs Review",
    items,
    stockMovementIds: Array.isArray(invoice.stockMovementIds) ? invoice.stockMovementIds.map(cleanText).filter(Boolean) : [],
    ledgerTransactionId: cleanText(invoice.ledgerTransactionId ?? ""),
    barcodeValue: cleanText(invoice.barcodeValue ?? ""),
    qrPayload: cleanText(invoice.qrPayload ?? ""),
    note: cleanText(invoice.note ?? ""),
    sourceSubmissionKey: cleanSubmissionKey(invoice.sourceSubmissionKey),
    payments: readPaymentParts(invoice.payments),
  };
}

async function writePosInvoices(invoices: PosInvoice[]) {
  await writeFileAtomic(posInvoicesPath, `${JSON.stringify(invoices, null, 2)}\n`);
}

async function getPosInvoicesFromLocalJson() {
  try {
    const content = await readFile(posInvoicesPath, "utf8");
    const parsed = JSON.parse(content) as Partial<PosInvoice>[];

    return parsed.map(normalizeInvoice);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function savePosInvoiceToLocalJson(invoice: PosInvoice) {
  const invoices = await getPosInvoicesFromLocalJson();
  const existingById = invoices.find((item) => item.id === invoice.id);
  if (existingById) return existingById;

  if (invoice.sourceSubmissionKey) {
    const existing = invoices.find((item) => item.sourceSubmissionKey === invoice.sourceSubmissionKey);
    if (existing) return existing;
  }

  invoices.unshift(invoice);
  await writePosInvoices(invoices);
  return invoice;
}

async function updatePosInvoicePostingToLocalJson(id: string, patch: PosInvoicePostingPatch) {
  const invoices = await getPosInvoicesFromLocalJson();
  const invoice = invoices.find((item) => item.id === id);

  if (!invoice) {
    throw new Error("POS invoice was not found.");
  }

  invoice.stockMovementIds = patch.stockMovementIds;
  invoice.ledgerTransactionId = patch.ledgerTransactionId;
  invoice.postingStatus = patch.postingStatus;
  await writePosInvoices(invoices);
  return invoice;
}

async function savePosInvoice(invoice: PosInvoice) {
  return runWithDataBackend({
    storeName: "pos invoices",
    localJson: () => savePosInvoiceToLocalJson(invoice),
    postgres: () => savePosInvoiceToPostgres(invoice),
  });
}

async function updatePosInvoicePosting(id: string, patch: PosInvoicePostingPatch) {
  return runWithDataBackend({
    storeName: "pos invoices",
    localJson: () => updatePosInvoicePostingToLocalJson(id, patch),
    postgres: () => updatePosInvoicePostingToPostgres(id, patch),
  });
}

export async function getPosInvoices() {
  return runWithDataBackend({
    storeName: "pos invoices",
    localJson: getPosInvoicesFromLocalJson,
    postgres: getPosInvoicesFromPostgres,
  });
}

export async function getPosInvoiceById(id: string) {
  const invoices = await getPosInvoices();
  return invoices.find((invoice) => invoice.id === id) ?? null;
}

async function nextInvoiceNumber(kind: PosInvoiceKind) {
  const datePart = todayKey();
  const prefix = kind === "Return" ? `KR-RT-${datePart}` : `KR-BILL-${datePart}`;
  const invoices = await getPosInvoices();
  const count = invoices.filter((invoice) => invoice.invoiceNumber.startsWith(prefix)).length + 1;

  return `${prefix}-${String(count).padStart(4, "0")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

function invoiceStatus(kind: PosInvoiceKind, total: number, paidAmount: number, creditAmount: number): PosInvoiceStatus {
  if (kind === "Return") {
    return "Returned";
  }

  if (creditAmount > 0 && paidAmount > 0) {
    return "Partial";
  }

  if (creditAmount > 0) {
    return "Credit";
  }

  return paidAmount >= total ? "Paid" : "Partial";
}

function qrPayloadForInvoice(invoice: Pick<PosInvoice, "id" | "invoiceNumber" | "total">) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  return `${siteUrl.replace(/\/$/, "")}/admin/pos/${invoice.id}?bill=${encodeURIComponent(invoice.invoiceNumber)}&total=${invoice.total}`;
}

async function syncCatalogStockAfterPosting() {
  await syncProductCatalogStockWithFinishedStock();
}

export async function createPosInvoice(input: CreatePosInvoiceInput) {
  const sourceSubmissionKey = cleanSubmissionKey(input.sourceSubmissionKey);
  const invoiceId = sourceSubmissionKey
    ? idFromSubmissionKey(input.kind === "Return" ? "RETURN" : "POS", sourceSubmissionKey)
    : "";
  const existingInvoice = invoiceId ? await getPosInvoiceById(invoiceId) : null;
  if (existingInvoice) {
    return existingInvoice;
  }

  const lines = input.items
    .map((item) => normalizeItem({ ...item, id: createId("ITEM") }))
    .filter((item) => item.design && item.quantity > 0 && item.rate > 0);

  if (lines.length === 0) {
    throw new Error("At least one valid POS item is required.");
  }

  const subtotal = sum(lines, (item) => item.lineTotal);
  const discount = Math.min(cleanNumber(input.invoiceDiscount), subtotal);
  const tax = cleanNumber(input.tax);
  const total = Math.max(0, subtotal - discount + tax);

  // Paid in parts: the parts are what was paid, and the first one names the
  // bill's method and number, so every screen that reads one method still
  // reads something true.
  const parts = readPaymentParts(input.paymentParts ?? []).filter(
    (part) => part.purpose === "bill" && part.method !== "Exchange",
  );
  if (parts.length > 0) {
    const problem = paymentPartsProblem(parts, total);
    if (problem) throw new Error(problem);
  }
  const paidAmount = parts.length > 0 ? Math.min(paidTowardBill(parts), total) : Math.min(cleanNumber(input.paidAmount), total);
  const paymentMethod = parts.length > 0 ? (parts[0].method as PosPaymentMethod) : input.paymentMethod;
  const paymentReference = parts.length > 0 ? (parts[0].reference ?? "") : cleanText(input.paymentReference);
  const creditAmount = input.kind === "Sale" ? Math.max(0, total - paidAmount) : 0;
  validatePaymentInput({ ...input, paymentMethod, paymentReference, paidAmount }, creditAmount);

  // The customer's older credit, cleared on this bill: money into the drawer,
  // and a payment on their account, in the same save.
  const due =
    input.collectDue && cleanNumber(input.collectDue.amount) > 0
      ? {
          ledgerId: cleanText(input.collectDue.ledgerId),
          amount: cleanNumber(input.collectDue.amount),
          method: input.collectDue.method,
          reference: cleanText(input.collectDue.reference ?? ""),
        }
      : null;
  if (due) {
    if (input.kind !== "Sale") throw new Error("Old credit is cleared on a sale bill, not a return.");
    if (due.method === "Exchange") throw new Error("Old credit is paid in money.");
    const problem = paymentPartsProblem([{ ...due, purpose: "due" }], 0);
    if (problem && !problem.includes("more than the bill")) throw new Error(problem);
    if (cleanText(input.ledgerId) && cleanText(input.ledgerId) !== due.ledgerId) {
      throw new Error("The old credit and this bill's credit must be the same customer's account.");
    }
  }

  // Loaded once and shared: the size routing, the stock preflight and the
  // choice of pool for each line's movement all read it.
  const operations = await getOperationsData();

  if (due) {
    const ledger = operations.customerLedgers.find((record) => record.id === due.ledgerId);
    if (!ledger) throw new Error("The customer's account was not found.");
    if (due.amount > ledger.balanceDue) {
      throw new Error(`${ledger.customerName} owes ${ledger.balanceDue}, not ${due.amount}.`);
    }
  }

  // A line that names the customer's size moves the row that size is kept on —
  // its own row, or the uncounted pile it must be in. See stockRowForSize.
  const items = lines.map((item) =>
    item.size
      ? {
          ...item,
          sizeRun: stockRowForSize(operations.finishedStock, item.design, item.size, item.quantity, input.kind),
        }
      : item,
  );

  if (input.kind === "Sale") {
    preflightSaleStock(operations, items);

    // Wholesale minimum order quantity (MOQ) enforcement.
    if (input.channel === "Wholesale") {
      const catalog = await getProducts({ includeDrafts: true });

      for (const item of items) {
        const product = catalog.find(
          (candidate) =>
            (item.sku && candidate.sku.toLowerCase() === item.sku.toLowerCase()) ||
            sameDesign(candidate.name, item.design),
        );

        if (product && product.minWholesaleQty > 1 && item.quantity < product.minWholesaleQty) {
          throw new Error(
            `${item.design} wholesale minimum order is ${product.minWholesaleQty} pairs. Cannot bill ${item.quantity} pairs.`,
          );
        }
      }
    }

    // Customer credit-limit enforcement for credit/partial sales.
    if (creditAmount > 0) {
      const ledger = operations.customerLedgers.find(
        (record) => record.id === cleanText(input.ledgerId),
      );

      if (ledger && ledger.creditLimit > 0 && ledger.balanceDue + creditAmount > ledger.creditLimit) {
        throw new Error(
          `Credit limit exceeded for ${ledger.customerName}. Limit is ${ledger.creditLimit}, current due is ${ledger.balanceDue}, and this sale adds ${creditAmount} on credit.`,
        );
      }
    }
  }

  const id = invoiceId || createId(input.kind === "Return" ? "RETURN" : "POS");
  const invoiceNumber = await nextInvoiceNumber(input.kind);
  const createdAt = new Date().toISOString();
  const invoice: PosInvoice = {
    id,
    invoiceNumber,
    createdAt,
    channel: input.channel,
    kind: input.kind,
    customerName: cleanText(input.customerName) || "Walk-in Customer",
    phone: cleanText(input.phone),
    customerAddress: cleanText(input.customerAddress ?? ""),
    customerPan: cleanText(input.customerPan ?? ""),
    cashier: cleanText(input.cashier) || "Admin",
    paymentMethod,
    paymentReference,
    ledgerId: cleanText(input.ledgerId) || (due ? due.ledgerId : ""),
    subtotal,
    discount,
    tax,
    total,
    paidAmount,
    creditAmount,
    status: invoiceStatus(input.kind, total, paidAmount, creditAmount),
    postingStatus: "Needs Review",
    items,
    stockMovementIds: [],
    ledgerTransactionId: "",
    barcodeValue: invoiceNumber,
    qrPayload: "",
    note: cleanText(input.note),
    sourceSubmissionKey,
    payments: [
      ...parts,
      ...(due
        ? [{ method: due.method, amount: due.amount, purpose: "due" as const, ...(due.reference ? { reference: due.reference } : {}) }]
        : []),
    ],
  };

  invoice.qrPayload = qrPayloadForInvoice(invoice);

  const stockMovements = items.map<Omit<StockMovement, "id" | "createdAt">>((item) => {
    // Draw from — or, on a return, add back to — the design's one pool, wherever
    // it sits, rather than a channel-shaped bucket that may hold nothing. A
    // design with no stock yet (a first-ever return) starts its pool on the sale
    // channel.
    const pool = resolveStockRow(operations.finishedStock, item.design, item.sizeRun);

    return {
      design: item.design,
      channel: pool ? pool.channel : input.channel,
      sizeRun: item.sizeRun,
      type: input.kind === "Sale" ? "Sale Out" : "Return In",
      pairs: item.quantity,
      note: `${invoice.invoiceNumber} ${input.kind.toLowerCase()} ${item.sku || item.design}`,
    };
  });

  const needsLedger = (input.kind === "Sale" && creditAmount > 0) || input.kind === "Return";
  const ledgerTransaction: Omit<LedgerTransaction, "id" | "createdAt" | "customerName"> | null =
    needsLedger
      ? {
          ledgerId: invoice.ledgerId,
          type: input.kind === "Sale" ? "Credit Sale" : "Return Adjustment",
          amount: input.kind === "Sale" ? creditAmount : total,
          note: `${invoice.invoiceNumber} ${input.kind.toLowerCase()} through POS.`,
        }
      : null;
  const otherLedgerTransactions: Array<Omit<LedgerTransaction, "id" | "createdAt" | "customerName">> = due
    ? [
        {
          ledgerId: due.ledgerId,
          // The account keeps cash and everything-else apart; a QR or bank
          // payment sits with cheques, and the note says which it was.
          type: due.method === "Cash" ? "Cash Payment" : "Cheque Payment",
          amount: due.amount,
          note: `${invoice.invoiceNumber} old credit paid at the counter (${due.method}${due.reference ? ` ${due.reference}` : ""}).`,
        },
      ]
    : [];

  // Postgres: invoice + stock movements + ledger post in one transaction, so a
  // sale is all-or-nothing and each stock row is locked (FOR UPDATE) against
  // concurrent oversell. No half-posted invoices.
  if (getDataBackend() === "postgres") {
    let postedInvoice;
    try {
      postedInvoice = await createPosInvoicePostgres({
        invoice,
        stockMovements,
        ledgerTransaction,
        otherLedgerTransactions,
      });
    } catch (error) {
      const duplicateSubmission =
        sourceSubmissionKey &&
        ((error as { code?: string } | null)?.code === "23505" ||
          (error instanceof Error && error.message.includes("pos_invoices_submission_key_idx")));
      if (duplicateSubmission) {
        const existing = invoiceId ? await getPosInvoiceById(invoiceId) : null;
        if (existing) return existing;
      }

      throw error;
    }
    await syncCatalogStockAfterPosting();
    return postedInvoice;
  }

  // local-json fallback: sequential writes, guarded by the posting-repair path.
  const savedInvoice = await savePosInvoice(invoice);
  if (savedInvoice.id !== invoice.id) {
    return savedInvoice;
  }

  const stockMovementIds: string[] = [];
  for (const movement of stockMovements) {
    const created = await addStockMovement(movement);
    stockMovementIds.push(created.id);
  }

  let ledgerTransactionId = "";
  if (ledgerTransaction) {
    const created = await addLedgerTransaction(ledgerTransaction);
    ledgerTransactionId = created.id;
  }
  for (const transaction of otherLedgerTransactions) {
    await addLedgerTransaction(transaction);
  }

  const postedInvoice = await updatePosInvoicePosting(invoice.id, {
    stockMovementIds,
    ledgerTransactionId,
    postingStatus: "Posted",
  });

  await syncCatalogStockAfterPosting();

  return postedInvoice;
}

/** The stock as it will stand once the returned pairs are back on the shelf. */
function withPairsBack(operations: OperationsData, returned: PosInvoiceItem[]): OperationsData {
  const finishedStock = operations.finishedStock.map((row) => ({ ...row }));
  for (const item of returned) {
    const row = resolveStockRow(finishedStock, item.design, item.sizeRun);
    if (row) row.stockPairs += item.quantity;
  }
  return { ...operations, finishedStock };
}

function movementsFor(
  invoice: PosInvoice,
  operations: OperationsData,
): Array<Omit<StockMovement, "id" | "createdAt">> {
  return invoice.items.map((item) => {
    const pool = resolveStockRow(operations.finishedStock, item.design, item.sizeRun);
    return {
      design: item.design,
      channel: pool ? pool.channel : invoice.channel,
      sizeRun: item.sizeRun,
      type: invoice.kind === "Sale" ? "Sale Out" : "Return In",
      pairs: item.quantity,
      note: `${invoice.invoiceNumber} ${invoice.kind.toLowerCase()} ${item.sku || item.design}`,
    };
  });
}

/**
 * An exchange at the counter: the pairs that came back and the pairs that left,
 * saved as a return and a sale that settle against each other.
 *
 * The returned pairs pay for the new ones as far as they go (an "Exchange"
 * part on both bills, each naming the other). Whatever the new pairs still cost
 * is paid by the parts — or left on the customer's account, which then has to
 * be named. Whatever the returned pairs were worth beyond the new ones is
 * handed back, and the day close takes it out of the drawer.
 */
export async function createPosExchange(input: CreatePosExchangeInput) {
  const sourceSubmissionKey = cleanSubmissionKey(input.sourceSubmissionKey);
  const saleId = sourceSubmissionKey ? idFromSubmissionKey("POS", `${sourceSubmissionKey}-sale`) : "";
  const returnId = sourceSubmissionKey ? idFromSubmissionKey("RETURN", `${sourceSubmissionKey}-return`) : "";
  if (saleId) {
    const [existingSale, existingReturn] = await Promise.all([getPosInvoiceById(saleId), getPosInvoiceById(returnId)]);
    if (existingSale && existingReturn) return { returnInvoice: existingReturn, saleInvoice: existingSale };
  }

  const clean = (items: CreatePosInvoiceInput["items"]) =>
    items
      .map((item) => normalizeItem({ ...item, id: createId("ITEM") }))
      .filter((item) => item.design && item.quantity > 0 && item.rate > 0);
  const returnedLines = clean(input.returnedItems);
  const soldLines = clean(input.soldItems);
  if (returnedLines.length === 0 || soldLines.length === 0) {
    throw new Error("An exchange needs a pair that came back and a pair that left.");
  }

  const returnedValue = sum(returnedLines, (item) => item.lineTotal);
  const soldSubtotal = sum(soldLines, (item) => item.lineTotal);
  const discount = Math.min(cleanNumber(input.invoiceDiscount), soldSubtotal);
  const tax = cleanNumber(input.tax);
  const soldTotal = Math.max(0, soldSubtotal - discount + tax);
  const settle = settleExchange(returnedValue, soldTotal);

  const parts = readPaymentParts(input.paymentParts ?? []).filter(
    (part) => part.purpose === "bill" && part.method !== "Exchange",
  );
  const partsProblem = paymentPartsProblem(parts, settle.toPay);
  if (partsProblem) throw new Error(partsProblem);
  const refundMethod = input.refundMethod && input.refundMethod !== "Exchange" ? input.refundMethod : "Cash";

  const paidAmount = Math.min(soldTotal, settle.exchanged + paidTowardBill(parts));
  const creditAmount = Math.max(0, soldTotal - paidAmount);
  const ledgerId = cleanText(input.ledgerId);
  if (creditAmount > 0 && !ledgerId) {
    throw new Error("A credit or part-paid sale must be linked to a customer account.");
  }

  const operations = await getOperationsData();
  const route = (items: PosInvoiceItem[], kind: PosInvoiceKind) =>
    items.map((item) =>
      item.size
        ? { ...item, sizeRun: stockRowForSize(operations.finishedStock, item.design, item.size, item.quantity, kind) }
        : item,
    );
  const returnedItems = route(returnedLines, "Return");
  const soldItems = route(soldLines, "Sale");
  // The returned pairs are back on the shelf before the new ones leave — the
  // same pair in a different size must not be refused for want of itself.
  preflightSaleStock(withPairsBack(operations, returnedItems), soldItems);

  const [returnNumber, saleNumber] = [await nextInvoiceNumber("Return"), await nextInvoiceNumber("Sale")];
  const createdAt = new Date().toISOString();
  const shared = {
    createdAt,
    channel: input.channel,
    customerName: cleanText(input.customerName) || "Walk-in Customer",
    phone: cleanText(input.phone),
    customerAddress: cleanText(input.customerAddress ?? ""),
    customerPan: cleanText(input.customerPan ?? ""),
    cashier: cleanText(input.cashier) || "Admin",
    postingStatus: "Needs Review" as const,
    stockMovementIds: [],
    ledgerTransactionId: "",
    qrPayload: "",
    sourceSubmissionKey: "",
  };

  const returnInvoice: PosInvoice = {
    ...shared,
    id: returnId || createId("RETURN"),
    invoiceNumber: returnNumber,
    kind: "Return",
    // Every money method is also a bill method; only "Exchange" is not, and it
    // was ruled out above.
    paymentMethod: refundMethod as PosPaymentMethod,
    paymentReference: "",
    ledgerId: "",
    subtotal: returnedValue,
    discount: 0,
    tax: 0,
    total: returnedValue,
    paidAmount: 0,
    creditAmount: 0,
    status: "Returned",
    items: returnedItems,
    barcodeValue: returnNumber,
    note: `Exchange with ${saleNumber}. ${cleanText(input.note)}`.trim(),
    payments: [
      { method: "Exchange", amount: settle.exchanged, purpose: "bill", against: saleNumber },
      ...(settle.toRefund > 0 ? [{ method: refundMethod, amount: settle.toRefund, purpose: "refund" as const }] : []),
    ],
  };

  const saleInvoice: PosInvoice = {
    ...shared,
    id: saleId || createId("POS"),
    invoiceNumber: saleNumber,
    kind: "Sale",
    paymentMethod: parts.length > 0 ? (parts[0].method as PosPaymentMethod) : creditAmount > 0 ? "Credit" : "Cash",
    paymentReference: parts[0]?.reference ?? "",
    ledgerId,
    subtotal: soldSubtotal,
    discount,
    tax,
    total: soldTotal,
    paidAmount,
    creditAmount,
    status: invoiceStatus("Sale", soldTotal, paidAmount, creditAmount),
    items: soldItems,
    barcodeValue: saleNumber,
    note: `Exchange with ${returnNumber}. ${cleanText(input.note)}`.trim(),
    payments: [{ method: "Exchange", amount: settle.exchanged, purpose: "bill", against: returnNumber }, ...parts],
  };
  returnInvoice.qrPayload = qrPayloadForInvoice(returnInvoice);
  saleInvoice.qrPayload = qrPayloadForInvoice(saleInvoice);

  const returnMovements = movementsFor(returnInvoice, operations);
  const saleMovements = movementsFor(saleInvoice, withPairsBack(operations, returnedItems));
  const creditTransaction: Omit<LedgerTransaction, "id" | "createdAt" | "customerName"> | null =
    creditAmount > 0
      ? { ledgerId, type: "Credit Sale", amount: creditAmount, note: `${saleNumber} sale through POS (exchange).` }
      : null;

  if (getDataBackend() === "postgres") {
    const posted = await createPosExchangePostgres(
      { invoice: returnInvoice, stockMovements: returnMovements },
      { invoice: saleInvoice, stockMovements: saleMovements, ledgerTransaction: creditTransaction },
    );
    await syncCatalogStockAfterPosting();
    return posted;
  }

  // local-json fallback: the return first, so its pairs are back before the sale.
  const postLocally = async (
    invoice: PosInvoice,
    movements: Array<Omit<StockMovement, "id" | "createdAt">>,
    transaction: Omit<LedgerTransaction, "id" | "createdAt" | "customerName"> | null,
  ) => {
    await savePosInvoice(invoice);
    const stockMovementIds: string[] = [];
    for (const movement of movements) stockMovementIds.push((await addStockMovement(movement)).id);
    const ledgerTransactionId = transaction ? (await addLedgerTransaction(transaction)).id : "";
    return updatePosInvoicePosting(invoice.id, { stockMovementIds, ledgerTransactionId, postingStatus: "Posted" });
  };
  const postedReturn = await postLocally(returnInvoice, returnMovements, null);
  const postedSale = await postLocally(saleInvoice, saleMovements, creditTransaction);
  await syncCatalogStockAfterPosting();
  return { returnInvoice: postedReturn, saleInvoice: postedSale };
}

export async function repairPosInvoicePosting(id: string): Promise<PosPostingRepairResult> {
  const invoice = await getPosInvoiceById(id);

  if (!invoice) {
    throw new Error("POS invoice was not found.");
  }

  if (invoice.status === "Voided") {
    const updatedInvoice = await updatePosInvoicePosting(invoice.id, {
      stockMovementIds: [],
      ledgerTransactionId: "",
      postingStatus: "Posted",
    });

    return {
      invoice: updatedInvoice,
      createdStockMovementIds: [],
      createdLedgerTransactionId: "",
    };
  }

  const operations = await getOperationsData();
  const needsLedger = invoiceNeedsLedger(invoice);

  if (needsLedger && !invoice.ledgerId) {
    throw new Error("Customer ledger is required before this POS posting can be repaired.");
  }

  if (needsLedger && !operations.customerLedgers.some((ledger) => ledger.id === invoice.ledgerId)) {
    throw new Error("Linked customer ledger was not found.");
  }

  const ledgerMatch = matchingInvoiceLedgerTransaction(invoice, operations);

  if (ledgerMatch.mismatch) {
    throw new Error("Linked ledger transaction does not match this POS invoice. Review it manually before repair.");
  }

  const expectedStockType = invoiceStockMovementType(invoice.kind);
  const linkedStockMovements = linkedInvoiceStockMovements(invoice, operations);
  const stockMovementIds = linkedStockMovements.map((movement) => movement.id);
  const createdStockMovementIds: string[] = [];

  for (const group of groupInvoiceItemsByDesign(invoice.items)) {
    // Count what is already posted for this design across every channel — the
    // pairs may have been drawn from another pool at sale time. Filtering by the
    // invoice channel here is what made repair try to re-post pairs that were
    // never missing, then fail because that channel held nothing.
    const postedPairs = sum(
      linkedStockMovements.filter(
        (movement) =>
          sameDesign(movement.design, group.design) &&
          movement.type === expectedStockType,
      ),
      (movement) => movement.pairs,
    );
    const missingPairs = Math.max(0, group.pairs - postedPairs);

    if (missingPairs <= 0) {
      continue;
    }

    // Draw from the design's pool wherever it sits, the same way a sale does —
    // not a channel-shaped bucket that may be empty. Falls back to the sale
    // channel only when the design has no stock row yet.
    const pool = resolveStockRow(operations.finishedStock, group.design, "Mixed");
    const movement = await addStockMovement({
      design: group.design,
      channel: pool ? pool.channel : invoice.channel,
      type: expectedStockType,
      pairs: missingPairs,
      note: invoiceStockMovementNote(invoice, group.design, [...group.skus].join("/"), "repair"),
    });

    stockMovementIds.push(movement.id);
    createdStockMovementIds.push(movement.id);
  }

  let ledgerTransactionId = ledgerMatch.transactionId;
  let createdLedgerTransactionId = "";

  if (needsLedger && !ledgerTransactionId) {
    const ledgerTransaction = await addLedgerTransaction({
      ledgerId: invoice.ledgerId,
      type: invoiceLedgerTransactionType(invoice.kind),
      amount: invoice.kind === "Sale" ? invoice.creditAmount : invoice.total,
      note: `${invoice.invoiceNumber} ${invoice.kind.toLowerCase()} POS posting repair.`,
    });

    ledgerTransactionId = ledgerTransaction.id;
    createdLedgerTransactionId = ledgerTransaction.id;
  }

  const updatedInvoice = await updatePosInvoicePosting(invoice.id, {
    stockMovementIds: [...new Set(stockMovementIds)],
    ledgerTransactionId,
    postingStatus: "Posted",
  });

  await syncCatalogStockAfterPosting();

  return {
    invoice: updatedInvoice,
    createdStockMovementIds,
    createdLedgerTransactionId,
  };
}

function isSameDay(value: string) {
  return invoiceDateKey(value) === currentDateKey();
}

function isSameMonth(value: string) {
  return value.slice(0, 7) === currentMonthKey();
}

function isSameYear(value: string) {
  return value.slice(0, 4) === currentYearKey();
}

function activeInvoices(invoices: PosInvoice[]) {
  return invoices.filter((invoice) => invoice.status !== "Voided");
}

export function buildPosPostingReviewRows(invoices: PosInvoice[], operations: OperationsData) {
  const ledgerIds = new Set(operations.customerLedgers.map((ledger) => ledger.id));

  return invoices
    .map((invoice) => {
      const issues: string[] = [];
      const linkedStockMovements = linkedInvoiceStockMovements(invoice, operations);
      const expectedStockType = invoiceStockMovementType(invoice.kind);
      const itemPairsByDesign = groupInvoiceItemsByDesign(invoice.items);

      for (const request of itemPairsByDesign) {
        // One pool per design: the sale draws from wherever the pairs sit, so a
        // Retail bill's movement can be recorded on the Wholesale pool. Counting
        // posted pairs by channel would then miss them and flag a false
        // "movement missing" — match on design and type only, like the link does.
        const postedPairs = sum(
          linkedStockMovements.filter(
            (movement) =>
              sameDesign(movement.design, request.design) &&
              movement.type === expectedStockType,
          ),
          (movement) => movement.pairs,
        );

        if (invoice.status !== "Voided" && postedPairs < request.pairs) {
          issues.push(`${request.design} stock movement missing`);
        }
      }

      if (invoice.status !== "Voided" && linkedStockMovements.length < itemPairsByDesign.length) {
        issues.push("stock movement count mismatch");
      }

      const needsLedger = invoiceNeedsLedger(invoice);
      const ledgerTransaction = matchingInvoiceLedgerTransaction(invoice, operations);

      if (needsLedger && !invoice.ledgerId) {
        issues.push("customer ledger missing");
      } else if (needsLedger && !ledgerIds.has(invoice.ledgerId)) {
        issues.push("customer ledger not found");
      }

      if (needsLedger && !ledgerTransaction.transactionId) {
        issues.push("ledger transaction missing");
      } else if (needsLedger && ledgerTransaction.mismatch) {
        issues.push("ledger transaction mismatch");
      }

      if (invoice.paymentMethod === "Credit" && invoice.paidAmount > 0) {
        issues.push("credit bill has paid amount");
      }

      if (requiresPaymentReference(invoice.paymentMethod) && invoice.paidAmount > 0 && !invoice.paymentReference) {
        issues.push("payment reference missing");
      }

      if (invoice.status !== "Voided" && invoice.postingStatus !== "Posted") {
        issues.push("invoice not posted");
      }

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        createdAt: invoice.createdAt,
        channel: invoice.channel,
        kind: invoice.kind,
        customerName: invoice.customerName,
        total: invoice.total,
        paidAmount: invoice.paidAmount,
        creditAmount: invoice.creditAmount,
        paymentMethod: invoice.paymentMethod,
        postingStatus: invoice.postingStatus,
        expectedStockMovementCount: invoice.status === "Voided" ? 0 : itemPairsByDesign.length,
        linkedStockMovementCount: linkedStockMovements.length,
        needsLedger,
        ledgerLinked: !needsLedger || Boolean(ledgerTransaction.transactionId),
        signal: issues.length > 0 ? "Needs Review" : "Posted",
        issues: issues.join("; "),
      };
    })
    .sort((a, b) => {
      if (a.signal !== b.signal) return a.signal === "Needs Review" ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}

function salesTotal(invoices: PosInvoice[]) {
  return sum(invoices.filter((invoice) => invoice.kind === "Sale"), (invoice) => invoice.total);
}

function returnsTotal(invoices: PosInvoice[]) {
  return sum(invoices.filter((invoice) => invoice.kind === "Return"), (invoice) => invoice.total);
}

function buildDayCloseReport(
  invoices: PosInvoice[],
  postingReviewRows: ReturnType<typeof buildPosPostingReviewRows>,
  date: string,
): PosDayCloseReport {
  const rows = invoices.filter((invoice) => invoiceDateKey(invoice.createdAt) === date);
  const reviewIds = new Set(
    postingReviewRows
      .filter((row) => row.signal === "Needs Review" && invoiceDateKey(row.createdAt) === date)
      .map((row) => row.id),
  );
  const saleRows = rows.filter((invoice) => invoice.kind === "Sale");
  const returnRows = rows.filter((invoice) => invoice.kind === "Return");
  const paymentRows = posPaymentMethods.map((paymentMethod) => {
    const paymentInvoices = rows.filter((invoice) => invoice.paymentMethod === paymentMethod);
    const saleTotal = salesTotal(paymentInvoices);
    const returnTotal = returnsTotal(paymentInvoices);

    return {
      paymentMethod,
      invoiceCount: paymentInvoices.length,
      saleTotal,
      returnTotal,
      netTotal: saleTotal - returnTotal,
      // Money by the method it came in by: a part-cash, part-QR bill puts each
      // part under its own method, an old credit cleared at the counter is in
      // the drawer, and a refund comes out of it. A bill paid one way reads
      // exactly as before — its paid amount under its method.
      paidAmount: sum(rows, (invoice) => moneyByMethod(invoice).get(paymentMethod) ?? 0),
      creditAmount: sum(paymentInvoices, (invoice) => invoice.creditAmount),
    };
  });
  const channelRows = posChannels.map((channel) => {
    const channelInvoices = rows.filter((invoice) => invoice.channel === channel);
    const saleTotal = salesTotal(channelInvoices);
    const returnTotal = returnsTotal(channelInvoices);

    return {
      channel,
      invoiceCount: channelInvoices.length,
      saleTotal,
      returnTotal,
      netTotal: saleTotal - returnTotal,
      creditAmount: sum(channelInvoices, (invoice) => invoice.creditAmount),
    };
  });
  const cashierRows = [...new Set(rows.map((invoice) => invoice.cashier || "Admin"))]
    .map((cashier) => {
      const cashierInvoices = rows.filter((invoice) => (invoice.cashier || "Admin") === cashier);
      const saleTotal = salesTotal(cashierInvoices);
      const returnTotal = returnsTotal(cashierInvoices);

        return {
          cashier,
          invoiceCount: cashierInvoices.length,
          saleTotal,
          returnTotal,
          netTotal: saleTotal - returnTotal,
          paidAmount: sum(cashierInvoices, (invoice) => invoice.paidAmount),
          creditAmount: sum(cashierInvoices, (invoice) => invoice.creditAmount),
        };
      })
    .sort((a, b) => b.netTotal - a.netTotal || b.invoiceCount - a.invoiceCount);

  return {
    date,
    invoiceCount: rows.length,
    saleInvoiceCount: saleRows.length,
    returnInvoiceCount: returnRows.length,
    salesTotal: salesTotal(rows),
    returnsTotal: returnsTotal(rows),
    netSales: salesTotal(rows) - returnsTotal(rows),
    paidAmount: sum(rows, (invoice) => invoice.paidAmount),
    creditAmount: sum(rows, (invoice) => invoice.creditAmount),
    cashAmount: paymentRows.find((row) => row.paymentMethod === "Cash")?.paidAmount ?? 0,
    chequeAmount: paymentRows.find((row) => row.paymentMethod === "Cheque")?.paidAmount ?? 0,
    qrAmount: paymentRows.find((row) => row.paymentMethod === "QR")?.paidAmount ?? 0,
    eSewaAmount: paymentRows.find((row) => row.paymentMethod === "eSewa")?.paidAmount ?? 0,
    khaltiAmount: paymentRows.find((row) => row.paymentMethod === "Khalti")?.paidAmount ?? 0,
    bankAmount: paymentRows.find((row) => row.paymentMethod === "Bank")?.paidAmount ?? 0,
    postingNeedsReview: rows.filter((invoice) => reviewIds.has(invoice.id)).length,
    paymentRows,
    channelRows,
    cashierRows,
  };
}

function buildRecentDayCloseReports(
  invoices: PosInvoice[],
  postingReviewRows: ReturnType<typeof buildPosPostingReviewRows>,
) {
  return [...new Set(invoices.map((invoice) => invoiceDateKey(invoice.createdAt)))]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 14)
    .map((date) => buildDayCloseReport(invoices, postingReviewRows, date));
}

export async function getPosSnapshot() {
  const [invoices, operations] = await Promise.all([getPosInvoices(), getOperationsDataForReports()]);
  const active = activeInvoices(invoices);
  const today = active.filter((invoice) => isSameDay(invoice.createdAt));
  const month = active.filter((invoice) => isSameMonth(invoice.createdAt));
  const year = active.filter((invoice) => isSameYear(invoice.createdAt));
  const postingReviewRows = buildPosPostingReviewRows(invoices, operations);
  const reviewInvoiceIds = new Set(
    postingReviewRows.filter((row) => row.signal === "Needs Review").map((row) => row.id),
  );
  const channelTotals = posChannels.map((channel) => {
    const rows = active.filter((invoice) => invoice.channel === channel);
    return {
      channel,
      invoiceCount: rows.length,
      sales: salesTotal(rows),
      returns: returnsTotal(rows),
      netSales: salesTotal(rows) - returnsTotal(rows),
      credit: sum(rows, (invoice) => invoice.creditAmount),
    };
  });
  const paymentTotals = posPaymentMethods.map((paymentMethod) => {
    const rows = active.filter((invoice) => invoice.paymentMethod === paymentMethod);
    return {
      paymentMethod,
      invoiceCount: rows.length,
      paid: sum(active, (invoice) => moneyByMethod(invoice).get(paymentMethod) ?? 0),
      total: sum(rows, (invoice) => invoice.total),
    };
  });
  const dayCloseReports = buildRecentDayCloseReports(active, postingReviewRows);
  const todayDayClose = buildDayCloseReport(active, postingReviewRows, currentDateKey());

  return {
    invoices,
    summary: {
      invoiceCount: active.length,
      // Pairs, not rupees. The owner reads the money first and then wants to
      // know what it was — five hundred rupees is a good afternoon for kids'
      // slippers and a poor one for jeans shoes.
      todayPairs: sum(
        today.filter((invoice) => invoice.kind === "Sale"),
        (invoice) => sum(invoice.items, (item) => cleanNumber(item.quantity)),
      ),
      todaySales: salesTotal(today),
      todayReturns: returnsTotal(today),
      todayNetSales: salesTotal(today) - returnsTotal(today),
      monthSales: salesTotal(month),
      monthReturns: returnsTotal(month),
      monthNetSales: salesTotal(month) - returnsTotal(month),
      yearSales: salesTotal(year),
      yearReturns: returnsTotal(year),
      yearNetSales: salesTotal(year) - returnsTotal(year),
      totalCredit: sum(active, (invoice) => invoice.creditAmount),
      paidAmount: sum(active, (invoice) => invoice.paidAmount),
      postedInvoiceCount: active.length - active.filter((invoice) => reviewInvoiceIds.has(invoice.id)).length,
      needsReview: active.filter((invoice) => reviewInvoiceIds.has(invoice.id)).length,
      itemPairs: sum(active.flatMap((invoice) => invoice.items), (item) => item.quantity),
    },
    channelTotals,
    paymentTotals,
    postingReviewRows,
    todayDayClose,
    dayCloseReports,
    recentInvoices: invoices.slice(0, 20),
    reviewInvoices: invoices.filter((invoice) => reviewInvoiceIds.has(invoice.id)),
  };
}
