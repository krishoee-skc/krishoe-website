/**
 * What a counter bill is made of, apart from how it is drawn.
 *
 * PosBillForm.tsx was 984 lines in one client component — the screen every
 * sale is rung up on. The shape of a sellable design, the shape of a line, the
 * order Enter walks the boxes, and three decisions about a row all sat in the
 * same file as the markup, and the whole of it shipped to the phone as one
 * chunk.
 *
 * Nothing here draws anything or touches React. It is the same code, in a file
 * that says what it is.
 */

export type LedgerOption = { id: string; label: string };

// A design the shop can sell: how many pairs are on hand, and the price for each
// channel. The counter picks from these so the rate fills itself and the stock
// is in view — no typing a name and a price from memory.
export type SellableItem = {
  design: string;
  sku: string;
  stock: number;
  retailRate: number;
  wholesaleRate: number;
  sizes: string;
};

// The items of the shop's most recent sale, ready to drop back into the form so
// a repeat order does not have to be keyed again.
export type RepeatBillItem = {
  sku: string;
  design: string;
  sizeRun: string;
  quantity: string;
  rate: string;
  discount: string;
};

export type RepeatBill = {
  channel: string;
  invoiceNumber: string;
  items: RepeatBillItem[];
};

export type ItemRow = {
  key: number;
  sku: string;
  design: string;
  sizeRun: string;
  quantity: string;
  rate: string;
  discount: string;
};

export function emptyRow(key: number): ItemRow {
  return { key, sku: "", design: "", sizeRun: "", quantity: "", rate: "", discount: "" };
}

export function rowIsTouched(row: ItemRow) {
  return Boolean(row.sku || row.design || row.quantity || row.rate);
}

// Wholesale gets its own price; retail and online sell at the shelf price.
export function rateForChannel(channel: string, item: SellableItem) {
  return channel === "Wholesale" ? item.wholesaleRate : item.retailRate;
}

/**
 * The bill's own boxes, in the order they are filled at the counter.
 *
 * The goods come first and they are scanned, not typed, so the scan box is not
 * on this walk at all — there Enter has to keep meaning "add this item", which
 * is how a scanner works and how several items go in without a hand leaving
 * the counter. This walk is what comes after: who is buying, then what the
 * bill comes to.
 *
 * Discount and VAT before the amount paid, because the amount paid is settled
 * against a total that already has them in it. The cashier's name leads, since
 * it is the first thing typed on a fresh bill.
 *
 * Every name here is the input's own `name`, so the walk and the form cannot
 * drift apart.
 */
export const BILL_WALK = [
  "cashier",
  "customerName",
  "phone",
  "customerAddress",
  "customerPan",
  "invoiceDiscount",
  "tax",
  "paidAmount",
  "paymentReference",
] as const;
export type BillField = (typeof BILL_WALK)[number];
