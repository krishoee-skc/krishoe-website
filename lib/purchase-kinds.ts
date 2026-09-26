import type { PurchaseInvoice, PurchaseKind } from "@/lib/purchasing";

/**
 * A purchase bill's lines, sorted into what they are: ready-made shoes, which
 * go straight to sellable stock and are counted in pairs, and raw material,
 * which goes to the factory store in metres, kilos or pieces.
 *
 * The page used to list every bill under "Material purchase" by its first line
 * alone, so a delivery of Doctor Chappal read as raw material and the other
 * lines of a five-line bill did not show at all. Everything here reads the
 * lines themselves.
 */

export type PurchaseLine = {
  kind: PurchaseKind;
  name: string;
  quantity: number;
  unit: string;
  /** What the line cost once the bill's discount and tax are shared out. */
  total: number;
};

/**
 * The bill's lines. A bill filed before bills had lines carries only its
 * one-line summary, which is read as its single line.
 */
export function purchaseLinesOf(invoice: PurchaseInvoice): PurchaseLine[] {
  if (invoice.items && invoice.items.length > 0) {
    return invoice.items.map((item) => ({
      kind: item.kind,
      name: item.kind === "Trading Goods" ? item.design || item.itemName : item.itemName,
      quantity: item.quantity,
      unit: item.kind === "Trading Goods" ? "pair" : item.unit,
      total: item.lineTotal,
    }));
  }
  const kind: PurchaseKind = invoice.kind === "Trading Goods" ? "Trading Goods" : "Raw Material";
  return [
    {
      kind,
      name: kind === "Trading Goods" ? invoice.design || invoice.materialName : invoice.materialName,
      quantity: invoice.quantity,
      unit: kind === "Trading Goods" ? "pair" : invoice.unit,
      total: invoice.total,
    },
  ];
}

export function billHasKind(invoice: PurchaseInvoice, kind: PurchaseKind) {
  return purchaseLinesOf(invoice).some((line) => line.kind === kind);
}

export type KindTotals = {
  total: number;
  /** Pairs for ready-made; for raw material, lines of mixed units do not add up. */
  pairs: number;
  bills: number;
  /** The items bought the most of, by money, with what was bought. */
  top: Array<{ name: string; quantity: number; unit: string; total: number }>;
};

/** Ready-made and raw material, each added up across the given bills. */
export function purchaseKindTotals(invoices: PurchaseInvoice[], topCount = 4) {
  const empty = (): KindTotals & { byName: Map<string, { name: string; quantity: number; unit: string; total: number }> } => ({
    total: 0,
    pairs: 0,
    bills: 0,
    top: [],
    byName: new Map(),
  });
  const kinds = { ready: empty(), raw: empty() };

  for (const invoice of invoices) {
    const seen = new Set<string>();
    for (const line of purchaseLinesOf(invoice)) {
      const bucket = line.kind === "Trading Goods" ? kinds.ready : kinds.raw;
      const label = line.kind === "Trading Goods" ? "ready" : "raw";
      bucket.total += line.total;
      if (line.kind === "Trading Goods") bucket.pairs += line.quantity;
      if (!seen.has(label)) {
        seen.add(label);
        bucket.bills += 1;
      }
      const key = `${line.name.trim().toLowerCase()}|${line.unit}`;
      const row = bucket.byName.get(key) ?? { name: line.name, quantity: 0, unit: line.unit, total: 0 };
      row.quantity += line.quantity;
      row.total += line.total;
      bucket.byName.set(key, row);
    }
  }

  const finish = ({ byName, ...totals }: ReturnType<typeof empty>): KindTotals => ({
    ...totals,
    total: Math.round(totals.total),
    top: [...byName.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, topCount)
      .map((row) => ({ ...row, total: Math.round(row.total) })),
  });
  return { ready: finish(kinds.ready), raw: finish(kinds.raw) };
}
