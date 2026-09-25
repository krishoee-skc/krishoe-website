import type { PurchaseKind } from "@/lib/purchasing";
import type { StockPlace } from "@/lib/stock-rules";
import type { RawMaterial } from "@/lib/operations";

/**
 * What a purchase bill is made of, apart from how it is drawn.
 *
 * PurchaseInvoiceForm.tsx was 1,074 lines in one client component — the
 * largest file in the admin after the work entry, and the screen a supplier's
 * bill is typed into. The shape of a line, the order Enter walks the boxes,
 * and four small decisions about a row all sat in the same file as the markup,
 * and the whole of it shipped to the phone as one chunk.
 *
 * Nothing here draws anything or touches React. It is the same code, in a file
 * that says what it is.
 */

/** One row as the form holds it. Everything is a string because that is what an
 *  input gives back; the numbers are parsed only to show the running total. */
export type ItemRow = {
  key: number;
  kind: PurchaseKind;
  materialId: string;
  materialName: string;
  materialUnit: string;
  design: string;
  sizeRun: string;
  /** Where the pairs were put. Trading lines only; raw material has no pairs. */
  place: StockPlace;
  quantity: string;
  rate: string;
  /**
   * Pairs by size on a ready-made line, as typed ({ "36": "2" }). Required for
   * those lines — the quantity is their total, never typed on its own — so the
   * shop knows which sizes came in, not just how many pairs.
   */
  sizes: Record<string, string>;
  /** For a design not in the catalog yet: which run of sizes to offer ("36-41"). */
  sizeChoice?: string;
  /** The rate was filled in from the last bill, not typed — so it follows the item if the item changes. */
  rateAuto?: boolean;
};

export const rawMaterialUnits = ["kg", "meter", "pair", "piece", "liter"];

/** The three boxes Enter walks along, in the order a paper bill is read. */
export const WALK = ["item", "quantity", "rate"] as const;
export type WalkField = (typeof WALK)[number];

/**
 * The boxes outside the item table, in the order a paper bill is read.
 *
 * Not the order they sit on screen. Discount and VAT are typed before the
 * amount paid, because that is the order they are printed on the supplier's
 * bill and the order the arithmetic runs — following the screen would send the
 * cursor back up the page halfway through.
 *
 * The item rows sit between the bill number and the discount: Enter on the
 * bill number drops into the first line, and Enter on the last rate of the
 * last line comes back out to the discount.
 *
 * Every name here is the input's own `name`, so the walk and the form cannot
 * drift apart — a renamed field breaks the type, not the cursor.
 */
export const FIELD_WALK = [
  "supplierName",
  "phone",
  "supplierBillNo",
  "discount",
  "tax",
  "paidAmount",
  "paymentReference",
] as const;
export type FormField = (typeof FIELD_WALK)[number];

export function emptyRow(key: number): ItemRow {
  return {
    key,
    kind: "Raw Material",
    materialId: "",
    materialName: "",
    materialUnit: "piece",
    design: "",
    sizeRun: "Mixed",
    // Goods arrive at the factory unless the owner says otherwise, so the
    // common case needs no extra tap.
    place: "Factory",
    quantity: "",
    rate: "",
    sizes: {},
  };
}

/** The pairs a ready-made line's size boxes add up to. */
export function sizesTotalOf(row: Pick<ItemRow, "sizes">) {
  return Object.values(row.sizes).reduce((sum, value) => sum + Math.max(0, Math.floor(Number(value) || 0)), 0);
}

/** The size split as the server reads it: only sizes with pairs, as numbers. */
export function sizesPayload(row: Pick<ItemRow, "sizes">) {
  const counts: Record<string, number> = {};
  for (const [size, value] of Object.entries(row.sizes)) {
    const pairs = Math.floor(Number(value) || 0);
    if (pairs > 0) counts[size] = pairs;
  }
  return counts;
}

export function rowIsTouched(row: ItemRow) {
  return Boolean(
    row.materialId ||
      row.materialName ||
      row.design ||
      row.quantity ||
      row.rate ||
      Object.values(row.sizes ?? {}).some((value) => value),
  );
}

/** What the one item box is showing, whichever kind the line is. */
export function itemNameOf(row: ItemRow, rawMaterials: RawMaterial[]) {
  if (row.kind === "Trading Goods") return row.design;
  if (row.materialId) {
    return rawMaterials.find((material) => material.id === row.materialId)?.name ?? "";
  }
  return row.materialName;
}

export function sameName(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}
