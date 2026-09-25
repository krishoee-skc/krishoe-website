import type { PurchaseInvoice, PurchaseKind } from "@/lib/purchasing";

/**
 * What the purchase screen remembers from the bills already filed.
 *
 * The buyer used to retype the rate of something bought every week, could not
 * see that a supplier's bill number had been entered before, and had to build
 * a regular order line by line. All of that is already in the saved bills —
 * this reads it back, newest bill first. No new data is stored for it.
 *
 * Pure: the page hands in the bills, the form gets plain values back.
 */

export type LastRate = {
  rate: number;
  unit: string;
  /** The size run the design was last filed under, so its stock row is reused. */
  sizeRun: string;
};

export type RememberedLine = {
  kind: PurchaseKind;
  materialId: string;
  itemName: string;
  design: string;
  unit: string;
  quantity: number;
  rate: number;
  sizeRun: string;
  sizes: Record<string, number>;
};

export type SupplierMemory = {
  /** Their own bill numbers already entered, newest first, lower-cased. */
  billNos: string[];
  last?: {
    billNo: string;
    createdAt: string;
    /** The last bill carried VAT/tax, so the next one probably does too. */
    vat: boolean;
    lines: RememberedLine[];
  };
};

export type PurchaseMemory = {
  lastRates: Record<string, LastRate>;
  suppliers: Record<string, SupplierMemory>;
};

/** The key a line's last rate is filed under: a material by id, a design by name. */
export function rateKey(kind: PurchaseKind, materialIdOrDesign: string) {
  return kind === "Raw Material" ? `raw:${materialIdOrDesign}` : `fin:${materialIdOrDesign.trim().toLowerCase()}`;
}

/** "Sizes 36×2, 37×3 · note" → { "36": 2, "37": 3 } — how the size split is kept on a line. */
export function sizesFromNote(note: string): Record<string, number> {
  const match = /^Sizes ([^·]+)/.exec(note ?? "");
  if (!match) return {};
  const sizes: Record<string, number> = {};
  for (const part of match[1].split(",")) {
    const [size, pairs] = part.trim().split("×");
    const count = Math.floor(Number(pairs));
    if (size && Number.isFinite(count) && count > 0) sizes[size.trim()] = count;
  }
  return sizes;
}

const MAX_BILL_NOS = 100;

export function purchaseMemory(invoices: PurchaseInvoice[]): PurchaseMemory {
  const newestFirst = [...invoices].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const lastRates: Record<string, LastRate> = {};
  const suppliers: Record<string, SupplierMemory> = {};

  for (const invoice of newestFirst) {
    const supplier = (suppliers[invoice.supplierLedgerId] ??= { billNos: [] });
    const billNo = invoice.supplierBillNo?.trim() ?? "";
    if (billNo && supplier.billNos.length < MAX_BILL_NOS) supplier.billNos.push(billNo.toLowerCase());

    if (!supplier.last) {
      supplier.last = {
        billNo,
        createdAt: invoice.createdAt,
        vat: invoice.tax > 0,
        lines: invoice.items.map((item) => ({
          kind: item.kind,
          materialId: item.materialId,
          itemName: item.itemName,
          design: item.design,
          unit: item.unit,
          quantity: item.quantity,
          rate: item.rate,
          sizeRun: item.sizeRun,
          sizes: item.kind === "Trading Goods" ? sizesFromNote(item.note) : {},
        })),
      };
    }

    for (const item of invoice.items) {
      const key = rateKey(item.kind, item.kind === "Raw Material" ? item.materialId : item.design);
      if (!lastRates[key] && item.rate > 0) {
        lastRates[key] = { rate: item.rate, unit: item.unit, sizeRun: item.sizeRun };
      }
    }
  }

  return { lastRates, suppliers };
}
