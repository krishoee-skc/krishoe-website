import {
  getPosInvoices,
  type CreatePosInvoiceInput,
  type PosInvoice,
  type PosPaymentMethod,
} from "@/lib/pos";
import { getProducts } from "@/lib/product-store";
import type { Product } from "@/lib/products";
import type { FinishedStock } from "@/lib/operations";
import type { OrderSubmission, PaymentProvider } from "@/lib/submissions";
import { parseOrderTotalRupees } from "@/lib/payment-amount";

export type ParsedOnlineOrderItem = CreatePosInvoiceInput["items"][number] & {
  productId: string;
  color: string;
};

export type OnlineOrderPosDraft = {
  items: ParsedOnlineOrderItem[];
  subtotal: number;
  total: number;
  invoiceDiscount: number;
  tax: number;
};

export type OnlineOrderConversionSignal =
  | "Converted"
  | "Not converted"
  | "Needs stock"
  | "Needs ledger"
  | "Needs parsing";

export type OnlineOrderConversionRow = {
  orderId: string;
  customerName: string;
  createdAt: string;
  total: string;
  itemCount: number;
  pairCount: number;
  parsed: boolean;
  converted: boolean;
  posInvoiceId: string;
  posInvoiceNumber: string;
  missingLedger: boolean;
  missingStockItems: string[];
  signal: OnlineOrderConversionSignal;
  detail: string;
};

export type OnlineOrderConversionSummary = {
  totalOrders: number;
  convertedCount: number;
  notConvertedCount: number;
  needsStockCount: number;
  needsLedgerCount: number;
  needsParsingCount: number;
  readyCount: number;
};

export type OnlineOrderConversionReport = {
  rows: OnlineOrderConversionRow[];
  summary: OnlineOrderConversionSummary;
};

const posPaymentByOrderProvider: Record<PaymentProvider, PosPaymentMethod> = {
  manual: "Cash",
  cod: "Cash",
  esewa: "eSewa",
  khalti: "Khalti",
  bank: "Bank",
  cash: "Cash",
};

function cleanText(value: string) {
  return value.trim();
}

function cleanNumber(value: number) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function moneyNumber(value: string) {
  return parseOrderTotalRupees(value);
}

function productKey(value: string) {
  return cleanText(value).toLowerCase();
}

function sameDesign(left: string, right: string) {
  return productKey(left) === productKey(right);
}

function orderBlockTitle(block: string) {
  return block.match(/^\s*\d+\.\s+(.+?)\s+\(([^)]+)\)/);
}

function orderBlockDetails(block: string) {
  return block.match(/Size:\s*([^/]+?)\s*\/\s*Color:\s*([^/]+?)\s*\/\s*Qty:\s*(\d+)/i);
}

function orderBlockLineTotal(block: string) {
  return block.match(/Line total:\s*(.+)$/im);
}

// Closing an order is the claim that the goods went out. Only a POS invoice
// records that: it posts the Sale Out movement, the customer ledger entry, and
// syncs the catalog. Closing without one leaves stock counting pairs that have
// already shipped, and the error compounds with every online sale.
export function closeOrderBlockedReason(hasPosInvoice: boolean) {
  if (hasPosInvoice) {
    return "";
  }

  return "Convert this order to a POS invoice first — that records the sale and takes the pairs out of stock. Mark it Cancelled instead if it will not be fulfilled.";
}

export function onlineOrderPosMarker(orderId: string) {
  return `Online order ${orderId}`;
}

export function defaultPosPaymentMethodForOrder(order: OrderSubmission): PosPaymentMethod {
  return posPaymentByOrderProvider[order.paymentProvider] ?? "Cash";
}

export function amountFromOrderTotal(total: string) {
  return moneyNumber(total);
}

export function parseOnlineOrderItems(orderText: string, products: Product[]) {
  const productById = new Map(products.map((product) => [product.id, product]));
  const productBySku = new Map(products.map((product) => [productKey(product.sku), product]));
  const blocks = orderText
    .split(/\n(?=\s*\d+\.\s+)/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.flatMap((block): ParsedOnlineOrderItem[] => {
    const title = orderBlockTitle(block);
    const details = orderBlockDetails(block);

    if (!title || !details) {
      return [];
    }

    const productName = cleanText(title[1]);
    const productId = cleanText(title[2]);
    const size = cleanText(details[1]) || "Mixed";
    const color = cleanText(details[2]);
    const quantity = cleanNumber(Number(details[3]));
    const product = productById.get(productId) ?? productBySku.get(productKey(productId));
    const lineTotal = moneyNumber(orderBlockLineTotal(block)?.[1] ?? "");
    const catalogRate = product ? Math.round(product.priceValue / 100) : 0;
    const lineRate = quantity > 0 ? Math.round(lineTotal / quantity) : 0;
    const rate = lineRate > 0 ? lineRate : catalogRate;

    if (quantity <= 0 || rate <= 0) {
      return [];
    }

    return [
      {
        productId,
        sku: product?.sku ?? productId.toUpperCase(),
        design: product?.name ?? productName,
        sizeRun: size,
        quantity,
        rate,
        discount: 0,
        color,
      },
    ];
  });
}

export async function buildOnlineOrderPosDraft(order: OrderSubmission): Promise<OnlineOrderPosDraft> {
  const products = await getProducts({ includeDrafts: true });
  const items = parseOnlineOrderItems(order.order, products);

  if (items.length === 0) {
    throw new Error("This online order could not be parsed into POS items.");
  }

  const subtotal = items.reduce((total, item) => total + item.quantity * item.rate, 0);
  const total = amountFromOrderTotal(order.total) || subtotal;

  return {
    items,
    subtotal,
    total,
    invoiceDiscount: Math.max(0, subtotal - total),
    tax: Math.max(0, total - subtotal),
  };
}

export async function buildPosInvoiceInputFromOnlineOrder(
  order: OrderSubmission,
  options: {
    paymentMethod: PosPaymentMethod;
    paidAmount: number;
    ledgerId: string;
    paymentReference: string;
    cashier: string;
  },
): Promise<CreatePosInvoiceInput> {
  const draft = await buildOnlineOrderPosDraft(order);

  return {
    channel: "Online",
    kind: "Sale",
    customerName: order.name,
    phone: order.phone,
    cashier: cleanText(options.cashier) || "Online order desk",
    paymentMethod: options.paymentMethod,
    paymentReference: cleanText(options.paymentReference),
    ledgerId: cleanText(options.ledgerId),
    invoiceDiscount: draft.invoiceDiscount,
    tax: draft.tax,
    paidAmount: Math.min(cleanNumber(options.paidAmount), draft.total),
    note: [
      onlineOrderPosMarker(order.id),
      `Delivery: ${order.delivery}`,
      `Address: ${order.address}`,
      `Payment request: ${order.payment}`,
    ].join(". "),
    items: draft.items.map((item) => ({
      sku: item.sku,
      design: item.design,
      sizeRun: item.sizeRun,
      quantity: item.quantity,
      rate: item.rate,
      discount: item.discount,
    })),
  };
}

export function posInvoiceMatchesOnlineOrder(invoice: PosInvoice, orderId: string) {
  return invoice.note.includes(onlineOrderPosMarker(orderId));
}

export async function getPosInvoiceForOnlineOrder(orderId: string) {
  const invoices = await getPosInvoices();
  return invoices.find((invoice) => posInvoiceMatchesOnlineOrder(invoice, orderId)) ?? null;
}

function stockByOnlineDesign(finishedStock: FinishedStock[]) {
  const stockByDesign = new Map<string, { design: string; pairs: number }>();

  for (const stock of finishedStock) {
    if (stock.channel !== "Online") {
      continue;
    }

    const key = productKey(stock.design);
    const existing = stockByDesign.get(key) ?? { design: stock.design, pairs: 0 };
    existing.pairs += cleanNumber(stock.stockPairs);
    stockByDesign.set(key, existing);
  }

  return stockByDesign;
}

function missingOnlineStockItems(items: ParsedOnlineOrderItem[], finishedStock: FinishedStock[]) {
  const stockGroups = stockByOnlineDesign(finishedStock);
  const requiredGroups = new Map<string, { design: string; pairs: number }>();

  for (const item of items) {
    const key = productKey(item.design);
    const existing = requiredGroups.get(key) ?? { design: item.design, pairs: 0 };
    existing.pairs += item.quantity;
    requiredGroups.set(key, existing);
  }

  return [...requiredGroups.values()].flatMap((item) => {
    const stock = [...stockGroups.values()].find((group) => sameDesign(group.design, item.design));
    const available = stock?.pairs ?? 0;

    if (available >= item.pairs) {
      return [];
    }

    return [`${item.design}: need ${item.pairs}, stock ${available}`];
  });
}

function orderNeedsLedgerForDefaultConversion(order: OrderSubmission) {
  return order.paymentStatus !== "Paid" && !order.paymentLedgerId;
}

export function buildOnlineOrderConversionReport({
  orders,
  products,
  finishedStock,
  posInvoices,
}: {
  orders: OrderSubmission[];
  products: Product[];
  finishedStock: FinishedStock[];
  posInvoices: PosInvoice[];
}): OnlineOrderConversionReport {
  const rows = orders.map((order) => {
    const posInvoice = posInvoices.find((invoice) => posInvoiceMatchesOnlineOrder(invoice, order.id));
    const items = parseOnlineOrderItems(order.order, products);
    const parsed = items.length > 0;
    const missingStockItems = parsed ? missingOnlineStockItems(items, finishedStock) : [];
    const missingLedger = orderNeedsLedgerForDefaultConversion(order);
    const itemCount = items.length;
    const pairCount = items.reduce((total, item) => total + item.quantity, 0);
    let signal: OnlineOrderConversionSignal = "Not converted";
    let detail = "Ready for POS conversion.";

    if (posInvoice) {
      signal = "Converted";
      detail = posInvoice.invoiceNumber;
    } else if (!parsed) {
      signal = "Needs parsing";
      detail = "Order item text could not be converted automatically.";
    } else if (missingStockItems.length > 0) {
      signal = "Needs stock";
      detail = missingStockItems.join("; ");
    } else if (missingLedger) {
      signal = "Needs ledger";
      detail = "Unpaid or credit order needs a ledger or full paid amount before POS posting.";
    }

    return {
      orderId: order.id,
      customerName: order.name,
      createdAt: order.createdAt,
      total: order.total,
      itemCount,
      pairCount,
      parsed,
      converted: Boolean(posInvoice),
      posInvoiceId: posInvoice?.id ?? "",
      posInvoiceNumber: posInvoice?.invoiceNumber ?? "",
      missingLedger,
      missingStockItems,
      signal,
      detail,
    };
  });

  return {
    rows,
    summary: {
      totalOrders: rows.length,
      convertedCount: rows.filter((row) => row.signal === "Converted").length,
      notConvertedCount: rows.filter((row) => row.signal === "Not converted").length,
      needsStockCount: rows.filter((row) => row.signal === "Needs stock").length,
      needsLedgerCount: rows.filter((row) => row.signal === "Needs ledger").length,
      needsParsingCount: rows.filter((row) => row.signal === "Needs parsing").length,
      readyCount: rows.filter((row) => row.signal === "Not converted").length,
    },
  };
}
