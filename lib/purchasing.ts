import { readFile } from "node:fs/promises";
import { writeFileAtomic } from "@/lib/atomic-json";
import path from "node:path";
import { runWithDataBackend } from "@/lib/data-backend";
import {
  addRawMaterialReceipt,
  addStockMovement,
  getOperationsData,
  type BusinessChannel,
  type RawMaterial,
} from "@/lib/operations";
import { getPosSnapshot } from "@/lib/pos";
import { billKindFromLines, billTotals, shareBillAcrossLines } from "@/lib/purchase-bill";
import { syncProductCatalogStockWithFinishedStock } from "@/lib/product-store";
import { reportingErrors } from "@/lib/report-error";
import {
  addSupplierLedgerToPostgres,
  addSupplierTransactionToPostgres,
  createPurchaseInvoiceInPostgres,
  getPurchasingDataFromPostgres,
} from "@/lib/purchasing-postgres";

export type SupplierPaymentMethod = "Cash" | "Cheque" | "Bank" | "Credit";
// A "Raw Material" buy feeds the factory (raw material received stock).
// A "Trading Goods" buy is ready-made stock bought for resale through the
// wholesale/retail/online channels, so it feeds finished stock instead.
export type PurchaseKind = "Raw Material" | "Trading Goods";
// What a whole bill turned out to be, worked out from its lines. A real
// supplier bill can carry leather and ready-made chappals together, so "Mixed"
// is a normal answer, not an error.
export type PurchaseBillKind = PurchaseKind | "Mixed";
export type PurchaseInvoiceStatus = "Paid" | "Partial" | "Credit";
export type PurchasePostingStatus = "Posted" | "Needs Review";
export type SupplierTransactionType =
  | "Purchase Bill"
  | "Cash Payment"
  | "Cheque Payment"
  | "Bank Payment"
  | "Return Adjustment"
  | "Manual Adjustment";

export type SupplierLedger = {
  id: string;
  supplierName: string;
  phone: string;
  materialFocus: string;
  totalPurchase: number;
  paidAmount: number;
  balanceDue: number;
  lastTransaction: string;
};

// One line of a supplier bill. A bill runs from a single line to twenty-five or
// so, and can mix the two kinds, so the kind lives here rather than on the bill.
export type PurchaseInvoiceItem = {
  id: string;
  lineNo: number;
  kind: PurchaseKind;
  // Set on "Raw Material" lines; empty on "Trading Goods" lines.
  materialId: string;
  // The material name, or the design for trading goods.
  itemName: string;
  // Set on "Trading Goods" lines; empty on "Raw Material" lines.
  design: string;
  channel: BusinessChannel | "";
  sizeRun: string;
  unit: RawMaterial["unit"];
  quantity: number;
  rate: number;
  // quantity * rate, before the bill's discount and tax are shared out.
  lineSubtotal: number;
  // What the line actually cost once the bill's discount and tax are shared
  // out by value. Costing reads this, not lineSubtotal.
  lineTotal: number;
  note: string;
};

export type CreatePurchaseInvoiceItemInput = {
  kind: PurchaseKind;
  materialId: string;
  design: string;
  channel: BusinessChannel | "";
  sizeRun: string;
  quantity: number;
  rate: number;
  note: string;
};

export type PurchaseInvoice = {
  id: string;
  purchaseNumber: string;
  createdAt: string;
  supplierLedgerId: string;
  supplierName: string;
  // What the bill turned out to be, once its lines are known.
  kind: PurchaseBillKind;
  // The lines. This is the bill; everything below it is either a total or a
  // summary of the first line kept so older lists and exports keep reading.
  items: PurchaseInvoiceItem[];
  // Summary of the first line. Kept because invoice lists, exports and the
  // supplier ledger were built around one item per bill.
  materialId: string;
  materialName: string;
  design: string;
  channel: BusinessChannel | "";
  sizeRun: string;
  unit: RawMaterial["unit"];
  quantity: number;
  rate: number;
  // Bill level, entered once and shared across the lines by value.
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  creditAmount: number;
  paymentMethod: SupplierPaymentMethod;
  paymentReference: string;
  status: PurchaseInvoiceStatus;
  postingStatus: PurchasePostingStatus;
  supplierTransactionIds: string[];
  note: string;
};

export type SupplierTransaction = {
  id: string;
  createdAt: string;
  supplierLedgerId: string;
  supplierName: string;
  type: SupplierTransactionType;
  amount: number;
  note: string;
};

export type PurchasingData = {
  supplierLedgers: SupplierLedger[];
  purchaseInvoices: PurchaseInvoice[];
  supplierTransactions: SupplierTransaction[];
};

export type SupplierLedgerStatementRow = SupplierTransaction & {
  effect: "Due added" | "Due reduced";
  balanceAfter: number;
};

export type SupplierAgingRisk = "Clear" | "Current" | "Watch" | "High" | "Critical";
export type SupplierPaymentPriority = "Immediate" | "High" | "Scheduled" | "Normal" | "Clear";

export type SupplierAgingRow = {
  supplierLedgerId: string;
  supplierName: string;
  phone: string;
  materialFocus: string;
  balanceDue: number;
  current: number;
  days31To60: number;
  days61To90: number;
  over90: number;
  agedTotal: number;
  reconciliationDelta: number;
  oldestOpenDate: string;
  oldestOpenDays: number;
  openItemCount: number;
  risk: SupplierAgingRisk;
  lastTransaction: string;
};

export type CreatePurchaseInvoiceInput = {
  purchaseNumber: string;
  supplierLedgerId: string;
  supplierName: string;
  phone: string;
  // One line, or twenty-five. Each says what it is, so a bill can carry leather
  // and ready-made chappals together the way the supplier wrote it.
  items: CreatePurchaseInvoiceItemInput[];
  // Bill level, entered once and shared across the lines by value.
  discount: number;
  tax: number;
  paidAmount: number;
  paymentMethod: SupplierPaymentMethod;
  paymentReference: string;
  note: string;
};

const dataDirectory = path.join(process.cwd(), "data");
const purchasingPath = path.join(dataDirectory, "purchases.json");

const seedPurchasing: PurchasingData = {
  supplierLedgers: [],
  purchaseInvoices: [],
  supplierTransactions: [],
};

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

function today() {
  return new Date().toISOString().slice(0, 10);
}

function datePlusDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function todayKey() {
  return today().replaceAll("-", "");
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

function clonePurchasingData(data: PurchasingData): PurchasingData {
  return {
    supplierLedgers: data.supplierLedgers.map((ledger) => ({ ...ledger })),
    purchaseInvoices: data.purchaseInvoices.map((invoice) => ({
      ...invoice,
      supplierTransactionIds: [...invoice.supplierTransactionIds],
    })),
    supplierTransactions: data.supplierTransactions.map((transaction) => ({ ...transaction })),
  };
}

function isSupplierPaymentType(type: SupplierTransactionType) {
  return type === "Cash Payment" || type === "Cheque Payment" || type === "Bank Payment";
}

function assertSupplierTransactionAllowed(
  ledger: SupplierLedger,
  transaction: Pick<SupplierTransaction, "type" | "amount">,
) {
  if (transaction.amount <= 0) {
    throw new Error("Supplier transaction amount must be greater than zero.");
  }

  if ((isSupplierPaymentType(transaction.type) || transaction.type === "Return Adjustment") && transaction.amount > ledger.balanceDue) {
    throw new Error(
      `${ledger.supplierName} has only Rs. ${ledger.balanceDue} supplier due. Cannot post Rs. ${transaction.amount}.`,
    );
  }
}

function normalizeSupplierLedger(ledger: Partial<SupplierLedger>): SupplierLedger {
  return {
    id: cleanText(ledger.id ?? "") || createId("SUP"),
    supplierName: cleanText(ledger.supplierName ?? ""),
    phone: cleanText(ledger.phone ?? ""),
    materialFocus: cleanText(ledger.materialFocus ?? ""),
    totalPurchase: cleanNumber(ledger.totalPurchase ?? 0),
    paidAmount: cleanNumber(ledger.paidAmount ?? 0),
    balanceDue: cleanNumber(ledger.balanceDue ?? 0),
    lastTransaction: cleanText(ledger.lastTransaction ?? "") || today(),
  };
}

function normalizePurchaseInvoiceItem(
  item: Partial<PurchaseInvoiceItem>,
  invoiceId: string,
  lineNo: number,
): PurchaseInvoiceItem {
  const kind: PurchaseKind = item.kind === "Trading Goods" ? "Trading Goods" : "Raw Material";
  const quantity = cleanNumber(item.quantity ?? 0);
  const rate = cleanNumber(item.rate ?? 0);
  const lineSubtotal = cleanNumber(item.lineSubtotal ?? quantity * rate);

  return {
    id: cleanText(item.id ?? "") || `${invoiceId}-L${lineNo}`,
    lineNo: cleanNumber(item.lineNo ?? lineNo) || lineNo,
    kind,
    materialId: cleanText(item.materialId ?? ""),
    itemName: cleanText(item.itemName ?? ""),
    design: cleanText(item.design ?? ""),
    channel: item.channel ?? "",
    sizeRun: cleanText(item.sizeRun ?? "") || "Mixed",
    unit: item.unit ?? "piece",
    quantity,
    rate,
    lineSubtotal,
    lineTotal: cleanNumber(item.lineTotal ?? lineSubtotal),
    note: cleanText(item.note ?? ""),
  };
}

// A bill written before it could hold more than one item reads back as a bill
// with exactly one line, built from the summary columns it already has. Every
// reader can then assume items is there and stop caring which era wrote it.
function purchaseItemsFrom(invoice: Partial<PurchaseInvoice>, invoiceId: string) {
  if (Array.isArray(invoice.items) && invoice.items.length > 0) {
    return invoice.items.map((item, index) =>
      normalizePurchaseInvoiceItem(item, invoiceId, index + 1),
    );
  }

  const quantity = cleanNumber(invoice.quantity ?? 0);

  if (quantity <= 0) {
    return [];
  }

  const rate = cleanNumber(invoice.rate ?? 0);

  return [
    normalizePurchaseInvoiceItem(
      {
        kind: invoice.kind === "Trading Goods" ? "Trading Goods" : "Raw Material",
        materialId: invoice.materialId,
        itemName: invoice.materialName,
        design: invoice.design,
        channel: invoice.channel,
        sizeRun: invoice.sizeRun,
        unit: invoice.unit,
        quantity,
        rate,
        lineSubtotal: quantity * rate,
        // The whole bill was this one line, so it carried the whole total.
        lineTotal: cleanNumber(invoice.total ?? quantity * rate),
      },
      invoiceId,
      1,
    ),
  ];
}

function normalizePurchaseInvoice(invoice: Partial<PurchaseInvoice>): PurchaseInvoice {
  const id = cleanText(invoice.id ?? "") || createId("PUR");
  const items = purchaseItemsFrom(invoice, id);

  return {
    id,
    purchaseNumber: cleanText(invoice.purchaseNumber ?? ""),
    createdAt: cleanText(invoice.createdAt ?? "") || new Date().toISOString(),
    supplierLedgerId: cleanText(invoice.supplierLedgerId ?? ""),
    supplierName: cleanText(invoice.supplierName ?? ""),
    // Read from the lines, so a bill that predates them still answers. Invoices
    // written before trading-goods purchases existed are all raw material buys.
    kind: items.length > 0 ? billKindFromLines(items) : "Raw Material",
    items,
    materialId: cleanText(invoice.materialId ?? ""),
    materialName: cleanText(invoice.materialName ?? ""),
    design: cleanText(invoice.design ?? ""),
    channel: invoice.channel ?? "",
    sizeRun: cleanText(invoice.sizeRun ?? "") || "Mixed",
    unit: invoice.unit ?? "piece",
    quantity: cleanNumber(invoice.quantity ?? 0),
    rate: cleanNumber(invoice.rate ?? 0),
    discount: cleanNumber(invoice.discount ?? 0),
    tax: cleanNumber(invoice.tax ?? 0),
    total: cleanNumber(invoice.total ?? 0),
    paidAmount: cleanNumber(invoice.paidAmount ?? 0),
    creditAmount: cleanNumber(invoice.creditAmount ?? 0),
    paymentMethod: invoice.paymentMethod ?? "Cash",
    paymentReference: cleanText(invoice.paymentReference ?? ""),
    status: invoice.status ?? "Paid",
    postingStatus: invoice.postingStatus ?? "Needs Review",
    supplierTransactionIds: Array.isArray(invoice.supplierTransactionIds)
      ? invoice.supplierTransactionIds.map(cleanText).filter(Boolean)
      : [],
    note: cleanText(invoice.note ?? ""),
  };
}

function normalizeSupplierTransaction(transaction: Partial<SupplierTransaction>): SupplierTransaction {
  return {
    id: cleanText(transaction.id ?? "") || createId("SUPTXN"),
    createdAt: cleanText(transaction.createdAt ?? "") || new Date().toISOString(),
    supplierLedgerId: cleanText(transaction.supplierLedgerId ?? ""),
    supplierName: cleanText(transaction.supplierName ?? ""),
    type: transaction.type ?? "Manual Adjustment",
    amount: cleanNumber(transaction.amount ?? 0),
    note: cleanText(transaction.note ?? ""),
  };
}

function normalizePurchasingData(data: Partial<PurchasingData>): PurchasingData {
  return {
    supplierLedgers: (data.supplierLedgers ?? seedPurchasing.supplierLedgers).map(normalizeSupplierLedger),
    purchaseInvoices: (data.purchaseInvoices ?? seedPurchasing.purchaseInvoices).map(normalizePurchaseInvoice),
    supplierTransactions: (data.supplierTransactions ?? seedPurchasing.supplierTransactions).map(
      normalizeSupplierTransaction,
    ),
  };
}

async function writePurchasingData(data: PurchasingData) {
  await writeFileAtomic(purchasingPath, `${JSON.stringify(data, null, 2)}\n`);
}

async function getPurchasingDataFromLocalJson() {
  try {
    const content = await readFile(purchasingPath, "utf8");
    return normalizePurchasingData(JSON.parse(content) as Partial<PurchasingData>);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return normalizePurchasingData(seedPurchasing);
    }

    throw error;
  }
}

export async function getPurchasingData() {
  return runWithDataBackend({
    storeName: "purchasing",
    localJson: getPurchasingDataFromLocalJson,
    postgres: getPurchasingDataFromPostgres,
  });
}

export async function addSupplierLedger(
  ledger: Omit<SupplierLedger, "id" | "totalPurchase" | "paidAmount" | "balanceDue" | "lastTransaction">,
) {
  const record: SupplierLedger = {
    id: createId("SUP"),
    supplierName: cleanText(ledger.supplierName),
    phone: cleanText(ledger.phone),
    materialFocus: cleanText(ledger.materialFocus),
    totalPurchase: 0,
    paidAmount: 0,
    balanceDue: 0,
    lastTransaction: today(),
  };

  if (!record.supplierName) {
    throw new Error("Supplier name is required.");
  }

  return runWithDataBackend({
    storeName: "purchasing",
    localJson: async () => {
      const data = await getPurchasingDataFromLocalJson();
      data.supplierLedgers.unshift(record);
      await writePurchasingData(data);
      return record;
    },
    postgres: () => addSupplierLedgerToPostgres(ledger),
  });
}

function applySupplierTransaction(
  ledger: SupplierLedger,
  transaction: Pick<SupplierTransaction, "type" | "amount">,
) {
  assertSupplierTransactionAllowed(ledger, transaction);

  if (transaction.type === "Purchase Bill") {
    ledger.totalPurchase += transaction.amount;
    ledger.balanceDue += transaction.amount;
  }

  if (isSupplierPaymentType(transaction.type)) {
    ledger.paidAmount += transaction.amount;
    ledger.balanceDue -= transaction.amount;
  }

  if (transaction.type === "Return Adjustment") {
    ledger.totalPurchase -= transaction.amount;
    ledger.balanceDue -= transaction.amount;
  }

  if (transaction.type === "Manual Adjustment") {
    ledger.balanceDue += transaction.amount;
  }

  ledger.lastTransaction = today();
}

function addSupplierTransactionToLocalData(
  data: PurchasingData,
  transaction: Omit<SupplierTransaction, "id" | "createdAt" | "supplierName">,
) {
  const ledger = data.supplierLedgers.find((item) => item.id === transaction.supplierLedgerId);

  if (!ledger) {
    throw new Error("Supplier ledger was not found.");
  }

  const record: SupplierTransaction = {
    ...transaction,
    id: createId("SUPTXN"),
    createdAt: new Date().toISOString(),
    supplierName: ledger.supplierName,
    amount: cleanNumber(transaction.amount),
    note: cleanText(transaction.note),
  };

  applySupplierTransaction(ledger, record);
  data.supplierTransactions.unshift(record);
  return record;
}

export async function addSupplierTransaction(
  transaction: Omit<SupplierTransaction, "id" | "createdAt" | "supplierName">,
) {
  if (!transaction.supplierLedgerId || cleanNumber(transaction.amount) <= 0) {
    throw new Error("Supplier ledger and positive amount are required.");
  }

  return runWithDataBackend({
    storeName: "purchasing",
    localJson: async () => {
      const data = await getPurchasingDataFromLocalJson();
      const record = addSupplierTransactionToLocalData(data, transaction);
      await writePurchasingData(data);
      return record;
    },
    postgres: () => addSupplierTransactionToPostgres(transaction),
  });
}

function paymentTransactionType(paymentMethod: SupplierPaymentMethod): SupplierTransactionType {
  if (paymentMethod === "Cheque") return "Cheque Payment";
  if (paymentMethod === "Bank") return "Bank Payment";
  return "Cash Payment";
}

function purchaseStatus(total: number, paidAmount: number): PurchaseInvoiceStatus {
  const creditAmount = Math.max(0, total - paidAmount);

  if (creditAmount > 0 && paidAmount > 0) return "Partial";
  if (creditAmount > 0) return "Credit";
  return "Paid";
}

async function nextPurchaseNumber() {
  const prefix = `KR-PUR-${todayKey()}`;
  const data = await getPurchasingData();
  const count = data.purchaseInvoices.filter((invoice) => invoice.purchaseNumber.startsWith(prefix)).length + 1;

  return `${prefix}-${String(count).padStart(4, "0")}`;
}

/**
 * Drop the blank lines and check what is left.
 *
 * The form always carries a spare empty row, and a 25-line bill leaves gaps
 * where the owner skipped around, so blank rows are normal input and not a
 * mistake to complain about. A row with anything typed in it is a row the owner
 * meant, so a half-filled one is an error rather than something to drop
 * silently — dropping it would post a bill missing a line the supplier charged.
 */
export function normalizePurchaseItems(items: CreatePurchaseInvoiceItemInput[]) {
  const touched = items.filter(
    (item) =>
      cleanText(item.materialId) ||
      cleanText(item.design) ||
      cleanNumber(item.quantity) > 0 ||
      cleanNumber(item.rate) > 0,
  );

  if (touched.length === 0) {
    throw new Error("Add at least one item to the purchase.");
  }

  return touched.map((item, index) => {
    const line = index + 1;
    const kind: PurchaseKind = item.kind === "Trading Goods" ? "Trading Goods" : "Raw Material";
    const normalized = {
      kind,
      materialId: kind === "Raw Material" ? cleanText(item.materialId) : "",
      design: kind === "Trading Goods" ? cleanText(item.design) : "",
      channel: kind === "Trading Goods" ? item.channel : ("" as BusinessChannel | ""),
      sizeRun: (kind === "Trading Goods" ? cleanText(item.sizeRun) : "") || "Mixed",
      quantity: cleanNumber(item.quantity),
      rate: cleanNumber(item.rate),
      note: cleanText(item.note),
    };

    if (normalized.quantity <= 0 || normalized.rate <= 0) {
      throw new Error(`Item ${line}: quantity and rate are required.`);
    }

    if (normalized.kind === "Raw Material" && !normalized.materialId) {
      throw new Error(`Item ${line}: choose a raw material.`);
    }

    if (normalized.kind === "Trading Goods" && (!normalized.design || !normalized.channel)) {
      throw new Error(`Item ${line}: choose a product and a channel.`);
    }

    return normalized;
  });
}

export async function createPurchaseInvoice(input: Omit<CreatePurchaseInvoiceInput, "purchaseNumber">) {
  const purchaseNumber = await nextPurchaseNumber();
  const items = normalizePurchaseItems(input.items ?? []);
  const normalizedInput: CreatePurchaseInvoiceInput = {
    ...input,
    purchaseNumber,
    supplierLedgerId: cleanText(input.supplierLedgerId),
    supplierName: cleanText(input.supplierName),
    phone: cleanText(input.phone),
    items,
    discount: cleanNumber(input.discount),
    tax: cleanNumber(input.tax),
    paidAmount: cleanNumber(input.paidAmount),
    paymentReference: cleanText(input.paymentReference),
    note: cleanText(input.note),
  };

  if (!normalizedInput.supplierLedgerId && !normalizedInput.supplierName) {
    throw new Error("Choose an existing supplier or enter a new supplier name.");
  }

  if (normalizedInput.paymentMethod === "Credit" && normalizedInput.paidAmount > 0) {
    throw new Error("Credit purchase cannot have paid amount. Use Cash, Cheque, or Bank for payments.");
  }

  if (
    (normalizedInput.paymentMethod === "Cheque" || normalizedInput.paymentMethod === "Bank") &&
    normalizedInput.paidAmount > 0 &&
    !normalizedInput.paymentReference
  ) {
    throw new Error("Cheque or bank payment reference is required when paid amount is entered.");
  }

  const invoice = await runWithDataBackend({
    storeName: "purchasing",
    localJson: async () => {
      const [data, operations] = await Promise.all([
        getPurchasingDataFromLocalJson(),
        getOperationsData(),
      ]);
      const rollbackData = clonePurchasingData(data);
      // Resolve every raw material up front. A bill that names a material that
      // does not exist must fail before anything posts, not halfway down the
      // lines with the first few already in stock.
      const resolved = normalizedInput.items.map((item, index) => {
        const material =
          item.kind === "Raw Material"
            ? operations.rawMaterials.find((row) => row.id === item.materialId)
            : undefined;

        if (item.kind === "Raw Material" && !material) {
          throw new Error(`Item ${index + 1}: raw material was not found.`);
        }

        return {
          item,
          material,
          // Trading goods are bought and sold by the pair.
          itemName: material ? material.name : item.design,
          unit: (material ? material.unit : "pair") as RawMaterial["unit"],
        };
      });

      const shares = shareBillAcrossLines(normalizedInput.items, normalizedInput);
      const totals = billTotals(normalizedInput.items, normalizedInput);
      const first = resolved[0];

      let ledger = normalizedInput.supplierLedgerId
        ? data.supplierLedgers.find((item) => item.id === normalizedInput.supplierLedgerId)
        : undefined;

      if (!ledger) {
        ledger = {
          id: createId("SUP"),
          supplierName: normalizedInput.supplierName || "Unnamed Supplier",
          phone: normalizedInput.phone,
          materialFocus: first.itemName,
          totalPurchase: 0,
          paidAmount: 0,
          balanceDue: 0,
          lastTransaction: today(),
        };
        data.supplierLedgers.unshift(ledger);
      }

      const paidAmount = Math.min(normalizedInput.paidAmount, totals.total);
      const creditAmount = Math.max(0, totals.total - paidAmount);
      const supplierTransactionIds: string[] = [];
      const billKind = billKindFromLines(normalizedInput.items);

      // One bill, one ledger entry. The supplier wrote one bill; posting a line
      // each would leave their statement and this ledger unreconcilable.
      const purchaseTransaction = addSupplierTransactionToLocalData(data, {
        supplierLedgerId: ledger.id,
        type: "Purchase Bill",
        amount: totals.total,
        note: `${purchaseNumber} purchase, ${normalizedInput.items.length} item(s).`,
      });
      supplierTransactionIds.push(purchaseTransaction.id);

      if (paidAmount > 0 && normalizedInput.paymentMethod !== "Credit") {
        const paymentTransaction = addSupplierTransactionToLocalData(data, {
          supplierLedgerId: ledger.id,
          type: paymentTransactionType(normalizedInput.paymentMethod),
          amount: paidAmount,
          note: `${purchaseNumber} payment ${normalizedInput.paymentReference}`.trim(),
        });
        supplierTransactionIds.push(paymentTransaction.id);
      }

      const invoiceId = createId("PUR");
      const items: PurchaseInvoiceItem[] = resolved.map((row, index) => ({
        id: `${invoiceId}-L${index + 1}`,
        lineNo: index + 1,
        kind: row.item.kind,
        materialId: row.material?.id ?? "",
        itemName: row.itemName,
        design: row.item.design,
        channel: row.item.channel,
        sizeRun: row.item.sizeRun,
        unit: row.unit,
        quantity: row.item.quantity,
        rate: row.item.rate,
        lineSubtotal: shares[index].lineSubtotal,
        lineTotal: shares[index].lineTotal,
        note: row.item.note,
      }));

      const invoice: PurchaseInvoice = {
        id: invoiceId,
        purchaseNumber,
        createdAt: new Date().toISOString(),
        supplierLedgerId: ledger.id,
        supplierName: ledger.supplierName,
        kind: billKind,
        items,
        // Summary of the first line, for the lists and exports built when a
        // bill could only hold one item.
        materialId: items[0].materialId,
        materialName: items[0].itemName,
        design: items[0].design,
        channel: items[0].channel,
        sizeRun: items[0].sizeRun,
        unit: items[0].unit,
        quantity: items[0].quantity,
        rate: items[0].rate,
        discount: totals.discount,
        tax: totals.tax,
        total: totals.total,
        paidAmount,
        creditAmount,
        paymentMethod: normalizedInput.paymentMethod,
        paymentReference: normalizedInput.paymentReference,
        status: purchaseStatus(totals.total, paidAmount),
        postingStatus: "Posted",
        supplierTransactionIds,
        note: normalizedInput.note,
      };

      data.purchaseInvoices.unshift(invoice);
      await writePurchasingData(data);
      try {
        // Each line posts where its kind belongs: material to the factory
        // store, pairs to finished stock for the channel they were bought for.
        for (const line of items) {
          if (line.kind === "Raw Material") {
            await addRawMaterialReceipt({ materialId: line.materialId, quantity: line.quantity });
          } else {
            await addStockMovement({
              design: line.design,
              channel: line.channel as BusinessChannel,
              sizeRun: line.sizeRun,
              type: "Purchase In",
              pairs: line.quantity,
              note: `${purchaseNumber} purchased from ${ledger.supplierName}.`,
            });
          }
        }
      } catch (error) {
        await writePurchasingData(rollbackData).catch(() => undefined);
        throw error;
      }
      return invoice;
    },
    postgres: () => createPurchaseInvoiceInPostgres(normalizedInput),
  });

  // The catalog carries its own stock column and the shop reads that column,
  // not finished stock, so the pairs are not buyable until this runs. Doing it
  // here rather than in the admin action means every caller gets it.
  //
  // The bill has already committed, so a failure here must not throw: the admin
  // would retry and post the purchase twice. The pairs are safe in finished
  // stock either way, and the next sync picks them up.
  if (normalizedInput.items.some((item) => item.kind === "Trading Goods")) {
    await reportingErrors(`sync catalog stock after purchase ${invoice.purchaseNumber}`, () =>
      syncProductCatalogStockWithFinishedStock(),
    );
  }

  return invoice;
}

function isSameDay(value: string) {
  return value.slice(0, 10) === today();
}

function isSameMonth(value: string) {
  return value.slice(0, 7) === currentMonthKey();
}

function isSameYear(value: string) {
  return value.slice(0, 4) === currentYearKey();
}

function purchaseTotal(invoices: PurchaseInvoice[]) {
  return sum(invoices, (invoice) => invoice.total);
}

type OpenSupplierDueItem = {
  createdAt: string;
  remaining: number;
};

function supplierTransactionEffect(type: SupplierTransactionType) {
  return type === "Purchase Bill" || type === "Manual Adjustment" ? 1 : -1;
}

function safeTime(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function dayStartTime(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

function ageInDays(value: string) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return 0;
  }

  return Math.max(0, Math.floor((dayStartTime(new Date()) - dayStartTime(date)) / 86_400_000));
}

function reduceOpenSupplierDue(items: OpenSupplierDueItem[], amount: number) {
  let remainingReduction = amount;

  for (const item of items) {
    if (remainingReduction <= 0) {
      break;
    }

    const applied = Math.min(item.remaining, remainingReduction);
    item.remaining -= applied;
    remainingReduction -= applied;
  }
}

function supplierAgingRisk(
  row: Pick<SupplierAgingRow, "balanceDue" | "days31To60" | "days61To90" | "over90">,
): SupplierAgingRisk {
  if (row.balanceDue <= 0) return "Clear";
  if (row.over90 > 0) return "Critical";
  if (row.days61To90 > 0) return "High";
  if (row.days31To60 > 0) return "Watch";
  return "Current";
}

function supplierPaymentPriority(row: Pick<SupplierAgingRow, "balanceDue" | "days31To60" | "days61To90" | "over90">): SupplierPaymentPriority {
  if (row.balanceDue <= 0) return "Clear";
  if (row.over90 > 0 || row.balanceDue >= 100000) return "Immediate";
  if (row.days61To90 > 0) return "High";
  if (row.days31To60 > 0 || row.balanceDue >= 25000) return "Scheduled";
  return "Normal";
}

function supplierPaymentDueDate(priority: SupplierPaymentPriority) {
  if (priority === "Immediate") return today();
  if (priority === "High") return datePlusDays(3);
  if (priority === "Scheduled") return datePlusDays(7);
  if (priority === "Normal") return datePlusDays(14);
  return "";
}

function supplierPaymentNextAction(priority: SupplierPaymentPriority) {
  if (priority === "Immediate") {
    return "Prepare payment today or confirm written payment plan before new raw material booking.";
  }

  if (priority === "High") {
    return "Schedule supplier payment within three days and verify pending return or invoice adjustment.";
  }

  if (priority === "Scheduled") {
    return "Keep in this week payment run and confirm supplier statement.";
  }

  if (priority === "Normal") {
    return "Monitor in normal purchasing cycle.";
  }

  return "No supplier payable action needed.";
}

function buildSupplierAgingRows(data: PurchasingData): SupplierAgingRow[] {
  const riskRank: Record<SupplierAgingRisk, number> = {
    Critical: 4,
    High: 3,
    Watch: 2,
    Current: 1,
    Clear: 0,
  };

  return data.supplierLedgers
    .map((ledger) => {
      const openItems: OpenSupplierDueItem[] = [];
      const transactions = data.supplierTransactions
        .filter((transaction) => transaction.supplierLedgerId === ledger.id)
        .sort((a, b) => safeTime(a.createdAt) - safeTime(b.createdAt));

      for (const transaction of transactions) {
        if (supplierTransactionEffect(transaction.type) > 0) {
          openItems.push({
            createdAt: transaction.createdAt,
            remaining: transaction.amount,
          });
        } else {
          reduceOpenSupplierDue(openItems, transaction.amount);
        }
      }

      const remainingItems = openItems.filter((item) => item.remaining > 0);
      let current = 0;
      let days31To60 = 0;
      let days61To90 = 0;
      let over90 = 0;

      for (const item of remainingItems) {
        const age = ageInDays(item.createdAt);

        if (age <= 30) {
          current += item.remaining;
        } else if (age <= 60) {
          days31To60 += item.remaining;
        } else if (age <= 90) {
          days61To90 += item.remaining;
        } else {
          over90 += item.remaining;
        }
      }

      const agedFromTransactions = current + days31To60 + days61To90 + over90;
      const unmatchedDue = Math.max(0, ledger.balanceDue - agedFromTransactions);
      current += unmatchedDue;

      const agedTotal = current + days31To60 + days61To90 + over90;
      const reconciliationDelta = ledger.balanceDue - agedTotal;
      const oldestItem = remainingItems.sort((a, b) => ageInDays(b.createdAt) - ageInDays(a.createdAt))[0];
      const oldestOpenDate = oldestItem?.createdAt.slice(0, 10) ?? (ledger.balanceDue > 0 ? ledger.lastTransaction : "");
      const oldestOpenDays = oldestItem
        ? ageInDays(oldestItem.createdAt)
        : ledger.balanceDue > 0
          ? ageInDays(ledger.lastTransaction)
          : 0;
      const rowWithoutRisk = {
        supplierLedgerId: ledger.id,
        supplierName: ledger.supplierName,
        phone: ledger.phone,
        materialFocus: ledger.materialFocus,
        balanceDue: ledger.balanceDue,
        current,
        days31To60,
        days61To90,
        over90,
        agedTotal,
        reconciliationDelta,
        oldestOpenDate,
        oldestOpenDays,
        openItemCount: remainingItems.length + (unmatchedDue > 0 ? 1 : 0),
        lastTransaction: ledger.lastTransaction,
      };

      return {
        ...rowWithoutRisk,
        risk: supplierAgingRisk(rowWithoutRisk),
      };
    })
    .sort((a, b) => {
      if (a.risk !== b.risk) return riskRank[b.risk] - riskRank[a.risk];
      if (a.over90 !== b.over90) return b.over90 - a.over90;
      if (a.days61To90 !== b.days61To90) return b.days61To90 - a.days61To90;
      return b.balanceDue - a.balanceDue;
    });
}

export async function getPurchasingSnapshot() {
  const [data, pos, operations] = await Promise.all([
    getPurchasingData(),
    getPosSnapshot(),
    getOperationsData(),
  ]);
  const todayPurchases = data.purchaseInvoices.filter((invoice) => isSameDay(invoice.createdAt));
  const monthPurchases = data.purchaseInvoices.filter((invoice) => isSameMonth(invoice.createdAt));
  const yearPurchases = data.purchaseInvoices.filter((invoice) => isSameYear(invoice.createdAt));
  const supplierIds = new Set(data.supplierLedgers.map((supplier) => supplier.id));
  const materialIds = new Set(operations.rawMaterials.map((material) => material.id));
  const transactionsById = new Map(data.supplierTransactions.map((transaction) => [transaction.id, transaction]));
  const materialTotals = [...new Set(data.purchaseInvoices.map((invoice) => invoice.materialName))]
    .map((materialName) => {
      const rows = data.purchaseInvoices.filter((invoice) => invoice.materialName === materialName);

      return {
        materialName,
        quantity: sum(rows, (invoice) => invoice.quantity),
        total: purchaseTotal(rows),
        invoiceCount: rows.length,
      };
    })
    .sort((a, b) => b.total - a.total);
  const postingReviewRows = data.purchaseInvoices
    .map((invoice) => {
      const linkedTransactions = invoice.supplierTransactionIds
        .map((transactionId) => transactionsById.get(transactionId))
        .filter((transaction): transaction is SupplierTransaction => Boolean(transaction));
      const expectedPaymentType = paymentTransactionType(invoice.paymentMethod);
      const shouldHavePayment = invoice.paidAmount > 0 && invoice.paymentMethod !== "Credit";
      const issues: string[] = [];
      const supplierExists = supplierIds.has(invoice.supplierLedgerId);
      const materialExists = materialIds.has(invoice.materialId);
      const billPosted = linkedTransactions.some(
        (transaction) => transaction.type === "Purchase Bill" && transaction.amount === invoice.total,
      );
      const paymentPosted =
        !shouldHavePayment ||
        linkedTransactions.some(
          (transaction) => transaction.type === expectedPaymentType && transaction.amount === invoice.paidAmount,
        );
      const expectedStatus = purchaseStatus(invoice.total, invoice.paidAmount);
      const creditPaymentValid = invoice.paymentMethod !== "Credit" || invoice.paidAmount === 0;

      if (!supplierExists) issues.push("supplier missing");
      if (!materialExists) issues.push("raw material missing");
      if (!billPosted) issues.push("purchase bill transaction missing");
      if (!paymentPosted) issues.push("payment transaction missing");
      if (invoice.status !== expectedStatus) issues.push("payment status mismatch");
      if (!creditPaymentValid) issues.push("credit invoice has paid amount");
      if (invoice.postingStatus !== "Posted") issues.push("invoice not posted");

      return {
        id: invoice.id,
        purchaseNumber: invoice.purchaseNumber,
        supplierName: invoice.supplierName,
        materialName: invoice.materialName,
        quantity: invoice.quantity,
        total: invoice.total,
        paidAmount: invoice.paidAmount,
        creditAmount: invoice.creditAmount,
        paymentMethod: invoice.paymentMethod,
        postingStatus: invoice.postingStatus,
        expectedTransactionCount: 1 + (shouldHavePayment ? 1 : 0),
        linkedTransactionCount: linkedTransactions.length,
        supplierExists,
        materialExists,
        billPosted,
        paymentPosted,
        signal: issues.length > 0 ? "Needs Review" : "Posted",
        issues: issues.join("; "),
      };
    })
    .sort((a, b) => {
      if (a.signal !== b.signal) return a.signal === "Needs Review" ? -1 : 1;
      return b.total - a.total;
    });
  const postingNeedsReview = postingReviewRows.filter((row) => row.signal === "Needs Review").length;
  const supplierAgingRows = buildSupplierAgingRows(data);
  const supplierAgingTotals = {
    current: sum(supplierAgingRows, (row) => row.current),
    days31To60: sum(supplierAgingRows, (row) => row.days31To60),
    days61To90: sum(supplierAgingRows, (row) => row.days61To90),
    over90: sum(supplierAgingRows, (row) => row.over90),
    agedTotal: sum(supplierAgingRows, (row) => row.agedTotal),
    reconciliationDelta: sum(supplierAgingRows, (row) => Math.abs(row.reconciliationDelta)),
    dueSupplierCount: supplierAgingRows.filter((row) => row.balanceDue > 0).length,
    riskSupplierCount: supplierAgingRows.filter(
      (row) => row.risk === "Critical" || row.risk === "High" || row.risk === "Watch",
    ).length,
  };
  const supplierPaymentPriorityRank: Record<SupplierPaymentPriority, number> = {
    Immediate: 0,
    High: 1,
    Scheduled: 2,
    Normal: 3,
    Clear: 4,
  };
  const supplierPaymentFollowups = supplierAgingRows
    .map((row) => {
      const priority = supplierPaymentPriority(row);

      return {
        ...row,
        priority,
        paymentDueDate: supplierPaymentDueDate(priority),
        nextAction: supplierPaymentNextAction(priority),
      };
    })
    .sort(
      (a, b) =>
        supplierPaymentPriorityRank[a.priority] - supplierPaymentPriorityRank[b.priority] ||
        b.balanceDue - a.balanceDue ||
        b.oldestOpenDays - a.oldestOpenDays,
    );
  const supplierPaymentSummary = {
    immediateCount: supplierPaymentFollowups.filter((row) => row.priority === "Immediate").length,
    highCount: supplierPaymentFollowups.filter((row) => row.priority === "High").length,
    scheduledCount: supplierPaymentFollowups.filter((row) => row.priority === "Scheduled").length,
    normalCount: supplierPaymentFollowups.filter((row) => row.priority === "Normal").length,
    clearCount: supplierPaymentFollowups.filter((row) => row.priority === "Clear").length,
    immediateDue: sum(
      supplierPaymentFollowups.filter((row) => row.priority === "Immediate"),
      (row) => row.balanceDue,
    ),
    highDue: sum(
      supplierPaymentFollowups.filter((row) => row.priority === "High"),
      (row) => row.balanceDue,
    ),
    paymentRunDue: sum(
      supplierPaymentFollowups.filter(
        (row) =>
          row.priority === "Immediate" ||
          row.priority === "High" ||
          row.priority === "Scheduled",
      ),
      (row) => row.balanceDue,
    ),
    totalDue: sum(supplierPaymentFollowups, (row) => row.balanceDue),
  };

  return {
    ...data,
    summary: {
      supplierCount: data.supplierLedgers.length,
      purchaseInvoiceCount: data.purchaseInvoices.length,
      todayPurchase: purchaseTotal(todayPurchases),
      monthPurchase: purchaseTotal(monthPurchases),
      yearPurchase: purchaseTotal(yearPurchases),
      paidAmount: sum(data.purchaseInvoices, (invoice) => invoice.paidAmount),
      supplierDue: sum(data.supplierLedgers, (ledger) => ledger.balanceDue),
      supplierOver90Due: supplierAgingTotals.over90,
      supplierAgingRiskCount: supplierAgingTotals.riskSupplierCount,
      supplierImmediatePaymentCount: supplierPaymentSummary.immediateCount,
      postedInvoiceCount: data.purchaseInvoices.length - postingNeedsReview,
      postingNeedsReview,
      todayProfitEstimate: pos.summary.todayNetSales - purchaseTotal(todayPurchases),
      monthProfitEstimate: pos.summary.monthNetSales - purchaseTotal(monthPurchases),
      yearProfitEstimate: pos.summary.yearNetSales - purchaseTotal(yearPurchases),
    },
    reports: {
      materialTotals,
      postingReviewRows,
      supplierAgingRows,
      supplierAgingTotals,
      supplierPaymentFollowups,
      supplierPaymentSummary,
      supplierDueRows: [...data.supplierLedgers].sort((a, b) => b.balanceDue - a.balanceDue),
      recentInvoices: data.purchaseInvoices.slice(0, 20),
      recentTransactions: data.supplierTransactions.slice(0, 20),
    },
  };
}

export async function getSupplierLedgerDetail(id: string) {
  const data = await getPurchasingData();
  const ledger = data.supplierLedgers.find((item) => item.id === id);

  if (!ledger) {
    return null;
  }

  const invoices = data.purchaseInvoices
    .filter((invoice) => invoice.supplierLedgerId === id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const transactions = data.supplierTransactions
    .filter((transaction) => transaction.supplierLedgerId === id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  let runningBalance = 0;
  const statementRows = [...transactions]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((transaction) => {
      runningBalance = Math.max(0, runningBalance + supplierTransactionEffect(transaction.type) * transaction.amount);

      return {
        ...transaction,
        effect: supplierTransactionEffect(transaction.type) > 0 ? "Due added" : "Due reduced",
        balanceAfter: runningBalance,
      } satisfies SupplierLedgerStatementRow;
    })
    .reverse();
  const purchaseTotal = sum(invoices, (invoice) => invoice.total);
  const paidFromInvoices = sum(invoices, (invoice) => invoice.paidAmount);
  const creditFromInvoices = sum(invoices, (invoice) => invoice.creditAmount);
  const paymentTotal = sum(
    transactions.filter((transaction) => isSupplierPaymentType(transaction.type)),
    (transaction) => transaction.amount,
  );
  const returnAdjustmentTotal = sum(
    transactions.filter((transaction) => transaction.type === "Return Adjustment"),
    (transaction) => transaction.amount,
  );
  const manualAdjustmentTotal = sum(
    transactions.filter((transaction) => transaction.type === "Manual Adjustment"),
    (transaction) => transaction.amount,
  );
  const averagePurchaseValue = invoices.length > 0 ? Math.round(purchaseTotal / invoices.length) : 0;
  const aging = buildSupplierAgingRows(data).find((row) => row.supplierLedgerId === id) ?? null;
  const paymentPriority = aging ? supplierPaymentPriority(aging) : "Clear";

  return {
    ledger,
    invoices,
    transactions,
    statementRows,
    aging,
    summary: {
      purchaseCount: invoices.length,
      transactionCount: transactions.length,
      purchaseTotal,
      paidFromInvoices,
      creditFromInvoices,
      paymentTotal,
      returnAdjustmentTotal,
      manualAdjustmentTotal,
      averagePurchaseValue,
      balanceDue: ledger.balanceDue,
      paymentPriority,
      paymentDueDate: supplierPaymentDueDate(paymentPriority),
      nextPaymentAction: supplierPaymentNextAction(paymentPriority),
    },
  };
}
