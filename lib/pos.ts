import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDataBackend, runWithDataBackend } from "@/lib/data-backend";
import {
  addLedgerTransaction,
  addStockMovement,
  getOperationsData,
  type LedgerTransaction,
  type OperationsData,
  type StockMovement,
} from "@/lib/operations";
import {
  createPosInvoicePostgres,
  getPosInvoicesFromPostgres,
  savePosInvoiceToPostgres,
  updatePosInvoicePostingToPostgres,
} from "@/lib/pos-postgres";
import { getProducts, syncProductCatalogStockWithFinishedStock } from "@/lib/product-store";

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
};

export type PosInvoice = {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  channel: PosChannel;
  kind: PosInvoiceKind;
  customerName: string;
  phone: string;
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
  cashier: string;
  paymentMethod: PosPaymentMethod;
  paymentReference: string;
  ledgerId: string;
  invoiceDiscount: number;
  tax: number;
  paidAmount: number;
  note: string;
  items: Array<{
    sku: string;
    design: string;
    sizeRun: string;
    quantity: number;
    rate: number;
    discount: number;
  }>;
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

function stockKey(value: Pick<PosInvoiceItem, "design"> & { channel: PosChannel }) {
  return `${value.design.trim().toLowerCase()}::${value.channel}`;
}

function invoiceStockMovementType(kind: PosInvoiceKind) {
  return kind === "Sale" ? "Sale Out" : "Return In";
}

function invoiceLedgerTransactionType(kind: PosInvoiceKind) {
  return kind === "Sale" ? "Credit Sale" : "Return Adjustment";
}

function invoiceNeedsLedger(invoice: Pick<PosInvoice, "kind" | "creditAmount">) {
  return (invoice.kind === "Sale" && invoice.creditAmount > 0) || invoice.kind === "Return";
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
  return (
    movement.channel === invoice.channel &&
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
    throw new Error("Credit or partial POS sale must be linked to a customer ledger.");
  }

  if (input.kind === "Return" && !ledgerId) {
    throw new Error("POS return must be linked to a customer ledger.");
  }
}

function preflightSaleStock(operations: OperationsData, channel: PosChannel, items: PosInvoiceItem[]) {
  const requestedPairs = new Map<string, { design: string; channel: PosChannel; pairs: number }>();

  for (const item of items) {
    const key = stockKey({ design: item.design, channel });
    const existing = requestedPairs.get(key) ?? { design: item.design, channel, pairs: 0 };
    existing.pairs += item.quantity;
    requestedPairs.set(key, existing);
  }

  for (const request of requestedPairs.values()) {
    const matchingStock = operations.finishedStock.filter(
      (stock) => sameDesign(stock.design, request.design) && stock.channel === request.channel,
    );
    const stock = matchingStock.find((item) => sameDesign(item.sizeRun, "Mixed")) ?? matchingStock[0];

    if (!stock) {
      throw new Error(`${request.design} ${request.channel} stock row was not found.`);
    }

    if (request.pairs > stock.stockPairs) {
      throw new Error(
        `${request.design} ${request.channel} has only ${stock.stockPairs} pairs. Cannot bill ${request.pairs} pairs.`,
      );
    }
  }
}

function normalizeItem(item: Partial<PosInvoiceItem>): PosInvoiceItem {
  const quantity = cleanNumber(item.quantity ?? 0);
  const rate = cleanNumber(item.rate ?? 0);
  const discount = cleanNumber(item.discount ?? 0);

  return {
    id: cleanText(item.id ?? "") || createId("ITEM"),
    sku: cleanText(item.sku ?? ""),
    design: cleanText(item.design ?? ""),
    sizeRun: cleanText(item.sizeRun ?? "") || "Mixed",
    quantity,
    rate,
    discount,
    lineTotal: Math.max(0, quantity * rate - discount),
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
  };
}

async function writePosInvoices(invoices: PosInvoice[]) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(posInvoicesPath, `${JSON.stringify(invoices, null, 2)}\n`, "utf8");
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

  return `${prefix}-${String(count).padStart(4, "0")}`;
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
  const items = input.items
    .map((item) => normalizeItem({ ...item, id: createId("ITEM") }))
    .filter((item) => item.design && item.quantity > 0 && item.rate > 0);

  if (items.length === 0) {
    throw new Error("At least one valid POS item is required.");
  }

  const subtotal = sum(items, (item) => item.lineTotal);
  const discount = Math.min(cleanNumber(input.invoiceDiscount), subtotal);
  const tax = cleanNumber(input.tax);
  const total = Math.max(0, subtotal - discount + tax);
  const paidAmount = Math.min(cleanNumber(input.paidAmount), total);
  const creditAmount = input.kind === "Sale" ? Math.max(0, total - paidAmount) : 0;
  validatePaymentInput(input, creditAmount);

  if (input.kind === "Sale") {
    const operations = await getOperationsData();
    preflightSaleStock(operations, input.channel, items);

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

  const id = createId(input.kind === "Return" ? "RETURN" : "POS");
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
    cashier: cleanText(input.cashier) || "Admin",
    paymentMethod: input.paymentMethod,
    paymentReference: cleanText(input.paymentReference),
    ledgerId: cleanText(input.ledgerId),
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
  };

  invoice.qrPayload = qrPayloadForInvoice(invoice);

  const stockMovements = items.map<Omit<StockMovement, "id" | "createdAt">>((item) => ({
    design: item.design,
    channel: input.channel,
    type: input.kind === "Sale" ? "Sale Out" : "Return In",
    pairs: item.quantity,
    note: `${invoice.invoiceNumber} ${input.kind.toLowerCase()} ${item.sku || item.design}`,
  }));

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

  // Postgres: invoice + stock movements + ledger post in one transaction, so a
  // sale is all-or-nothing and each stock row is locked (FOR UPDATE) against
  // concurrent oversell. No half-posted invoices.
  if (getDataBackend() === "postgres") {
    const postedInvoice = await createPosInvoicePostgres({
      invoice,
      stockMovements,
      ledgerTransaction,
    });
    await syncCatalogStockAfterPosting();
    return postedInvoice;
  }

  // local-json fallback: sequential writes, guarded by the posting-repair path.
  await savePosInvoice(invoice);

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

  const postedInvoice = await updatePosInvoicePosting(invoice.id, {
    stockMovementIds,
    ledgerTransactionId,
    postingStatus: "Posted",
  });

  await syncCatalogStockAfterPosting();

  return postedInvoice;
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
    const postedPairs = sum(
      linkedStockMovements.filter(
        (movement) =>
          sameDesign(movement.design, group.design) &&
          movement.channel === invoice.channel &&
          movement.type === expectedStockType,
      ),
      (movement) => movement.pairs,
    );
    const missingPairs = Math.max(0, group.pairs - postedPairs);

    if (missingPairs <= 0) {
      continue;
    }

    const movement = await addStockMovement({
      design: group.design,
      channel: invoice.channel,
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

function buildPosPostingReviewRows(invoices: PosInvoice[], operations: OperationsData) {
  const ledgerIds = new Set(operations.customerLedgers.map((ledger) => ledger.id));

  return invoices
    .map((invoice) => {
      const issues: string[] = [];
      const linkedStockMovements = linkedInvoiceStockMovements(invoice, operations);
      const expectedStockType = invoiceStockMovementType(invoice.kind);
      const itemPairsByDesign = groupInvoiceItemsByDesign(invoice.items);

      for (const request of itemPairsByDesign) {
        const postedPairs = sum(
          linkedStockMovements.filter(
            (movement) =>
              sameDesign(movement.design, request.design) &&
              movement.channel === invoice.channel &&
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
      paidAmount: sum(paymentInvoices, (invoice) => invoice.paidAmount),
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
  const [invoices, operations] = await Promise.all([getPosInvoices(), getOperationsData()]);
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
      paid: sum(rows, (invoice) => invoice.paidAmount),
      total: sum(rows, (invoice) => invoice.total),
    };
  });
  const dayCloseReports = buildRecentDayCloseReports(active, postingReviewRows);
  const todayDayClose = buildDayCloseReport(active, postingReviewRows, currentDateKey());

  return {
    invoices,
    summary: {
      invoiceCount: active.length,
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
