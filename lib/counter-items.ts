import { randomUUID } from "node:crypto";
import { counterItemsReady } from "@/lib/counter-items-database";
import {
  counterItemProblem,
  movementTypeForHow,
  similarNames,
  totalPairs,
  type CounterItemChannel,
  type CounterItemHow,
} from "@/lib/counter-item-rules";
import { designKey } from "@/lib/design-name";
import { insertStockMovement } from "@/lib/operations-postgres";
import { queryPostgres, transactionPostgres } from "@/lib/postgres/client";
import { buildDraftProductForDesign, getProducts, upsertProduct } from "@/lib/product-store";
import { categories, formatPrice } from "@/lib/products";
import { nextShoeCode } from "@/lib/shoe-code";
import { placePairs } from "@/lib/stock-transfers";

const STORE = "counter items";

export type CounterItemInput = {
  name: string;
  categorySlug: string;
  how: CounterItemHow;
  supplierName: string;
  supplierBillNo: string;
  /** Pairs per size; empty when the sizes were not counted. */
  sizes: Record<string, number>;
  /** Pairs whose sizes were not counted. */
  pilePairs: number;
  /** Rupees; 0 on a wholesale bill when only the wholesale price was typed. */
  retailPrice: number;
  /** Rupees; 0 when none. Needed when added from a wholesale bill. */
  wholesalePrice?: number;
  /** Least pairs a wholesale buyer takes; 1 or less for no minimum. */
  minWholesaleQty?: number;
  /** The bill it is added from. Retail when not said. */
  channel?: CounterItemChannel;
  /** Rupees; 0 when not known. */
  costPerPair: number;
  lossConfirmed: boolean;
  createdBy: string;
};

export class CounterItemRefusal extends Error {
  readonly ne: string;
  constructor(
    words: { en: string; ne: string },
    /** Existing names the item may be. */
    readonly sameAs: string[] = [],
  ) {
    super(words.en);
    this.ne = words.ne;
  }
}

/**
 * Put goods on the books from the counter, so they can be sold now.
 *
 * The shop had pairs on its shelves that were never entered, and the counter
 * refused them ("not in stock yet"). One press makes the item (a Draft on the
 * website, with the next shoe code), writes its pairs as ordinary stock — by
 * how they came: already on the shelf, arrived with a bill to come, or made
 * here — places them at the shop, and remembers the cost and who added it.
 * The stock rows and the record commit together or not at all.
 */
export async function createCounterItem(input: CounterItemInput) {
  const name = input.name.trim().replace(/\s+/g, " ");
  const sizes = input.sizes;
  const pilePairs = Math.max(0, Math.round(input.pilePairs || 0));
  const problem = counterItemProblem({
    name,
    how: input.how,
    sizes,
    pilePairs,
    retailPrice: input.retailPrice,
    wholesalePrice: input.wholesalePrice ?? 0,
    channel: input.channel ?? "Retail",
    costPerPair: input.costPerPair,
    lossConfirmed: input.lossConfirmed,
  });
  if (problem) throw new CounterItemRefusal(problem);
  const wholesalePrice = Math.max(0, Number(input.wholesalePrice) || 0);
  // Added from a wholesale bill with no retail price typed: the item still
  // needs a price for the shop's own customers, so it takes the wholesale one
  // until the Owner sets it in Products.
  const retailPrice = input.retailPrice > 0 ? input.retailPrice : wholesalePrice;
  const minWholesaleQty = Math.max(1, Math.round(Number(input.minWholesaleQty) || 1));

  if (!(await counterItemsReady())) {
    throw new CounterItemRefusal({
      en: "The database is not ready for new goods yet. The Owner can prepare it in Settings.",
      ne: "नयाँ मालका लागि database तयार छैन। मालिकले Settings मा तयार गर्न सक्नुहुन्छ।",
    });
  }

  // One shoe, one name: the same name already on the books is refused here,
  // whatever the form showed, so the stock is never split between two.
  const products = await getProducts({ includeDrafts: true });
  const stockDesigns = await queryPostgres<{ design: string }>(
    STORE,
    "SELECT DISTINCT design FROM finished_stock",
  );
  const known = [...products.map((product) => product.name), ...stockDesigns.map((row) => row.design)];
  const exact = known.find((existing) => designKey(existing) === designKey(name));
  if (exact) {
    throw new CounterItemRefusal(
      {
        en: `"${exact}" is already on the books — add pairs to it instead.`,
        ne: `"${exact}" पहिले नै छ — नयाँ नबनाई त्यसैमा जोडी थप्नुहोस्।`,
      },
      [exact],
    );
  }

  const category = categories.find((entry) => entry.slug === input.categorySlug) ?? categories[0];
  const pairs = totalPairs(sizes, pilePairs);
  const sizeList = Object.keys(sizes).sort((left, right) => Number(left) - Number(right) || left.localeCompare(right));
  const takenCodes = products.map((product) => product.sku);
  const draft = buildDraftProductForDesign(name, pairs, takenCodes);
  const priceValue = Math.round(retailPrice * 100);
  const product = {
    ...draft,
    sku: nextShoeCode(takenCodes, category.slug),
    category: category.title,
    categorySlug: category.slug,
    image: category.image,
    gallery: [category.image],
    price: formatPrice(priceValue),
    priceValue,
    // The wholesale price when one was typed — needed from a wholesale bill,
    // optional from a retail one (owner, 2026-09-30). 0 sells wholesale at the
    // retail price, as before.
    wholesalePriceValue: Math.round(wholesalePrice * 100),
    minWholesaleQty,
    sizes: sizeList.length > 0 ? sizeList : draft.sizes,
    rating: "0",
  };
  await upsertProduct(product);

  const type = movementTypeForHow[input.how];
  const supplier = input.supplierName.trim();
  const note =
    input.how === "old"
      ? "Already on the shop shelf — added from the counter bill."
      : input.how === "pending_bill"
        ? `Arrived, supplier's bill to come${supplier ? ` — ${supplier}` : ""}. Added from the counter bill.`
        : "Made in our factory — added from the counter bill.";
  // The uncounted pile goes in FIRST. A "Mixed" movement looks for a Mixed row
  // and, finding none, falls back to any row of the design — so posted after
  // the sizes, kitto 770's 100 uncounted pairs landed on its size-40 row, which
  // read 120 instead of 20 (owner, 2026-09-29). Posted first, the pile makes
  // its own Mixed row; each real size then matches only its exact row.
  const rows: Array<[string, number]> = [
    ...(pilePairs > 0 ? ([["Mixed", pilePairs]] as Array<[string, number]>) : []),
    ...Object.entries(sizes),
  ];

  const id = `CTR-${randomUUID()}`;
  await transactionPostgres(STORE, async (db) => {
    for (const [sizeRun, count] of rows) {
      const movement = await insertStockMovement(db, {
        design: name,
        channel: "Retail",
        sizeRun,
        type,
        pairs: count,
        note,
      });
      // The pairs are on the shop's shelf: say so, or the Stock screen reads
      // them as "no place" until somebody writes a challan for goods that
      // never travelled.
      await placePairs(db, movement.design, movement.sizeRun, "Shop", count);
    }
    await db.query(
      `INSERT INTO counter_items (
         id, design, product_id, how, supplier_name, supplier_bill_no, pairs,
         size_breakdown, retail_price, cost_per_pair, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)`,
      [
        id,
        name,
        product.id,
        input.how,
        supplier.slice(0, 80),
        input.supplierBillNo.trim().slice(0, 60),
        pairs,
        JSON.stringify(pilePairs > 0 ? { ...sizes, Mixed: pilePairs } : sizes),
        Math.round(retailPrice * 100) / 100,
        Math.max(0, Math.round(input.costPerPair * 100) / 100),
        input.createdBy.slice(0, 80),
      ],
    );
  });

  return {
    id,
    design: name,
    sku: product.sku,
    category: category.title,
    sizes: sizes,
    sizeList,
    pilePairs,
    pairs,
    retailRate: retailPrice,
    wholesaleRate: wholesalePrice > 0 ? wholesalePrice : retailPrice,
    minWholesaleQty,
    costPerPair: input.costPerPair,
  };
}

/** Names on the books close to the one typed — for the form's "is it one of these?". */
export function counterItemLookAlikes(name: string, known: string[]) {
  return similarNames(name, known);
}

export type CounterItemRow = {
  id: string;
  createdAt: string;
  design: string;
  how: CounterItemHow;
  supplierName: string;
  supplierBillNo: string;
  pairs: number;
  /** Pairs by size as counted in; "Mixed" for the uncounted pile. */
  sizes: Record<string, number>;
  retailPrice: number;
  costPerPair: number;
  createdBy: string;
};

type CounterItemDbRow = {
  id: string;
  created_at: Date | string;
  design: string;
  how: CounterItemHow;
  supplier_name: string;
  supplier_bill_no: string;
  pairs: number | string;
  size_breakdown: Record<string, number | string> | null;
  retail_price: number | string;
  cost_per_pair: number | string;
  created_by: string;
};

function counterItemFromRow(row: CounterItemDbRow): CounterItemRow {
  return {
    id: row.id,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    design: row.design,
    how: row.how,
    supplierName: row.supplier_name ?? "",
    supplierBillNo: row.supplier_bill_no ?? "",
    pairs: Number(row.pairs) || 0,
    sizes: Object.fromEntries(
      Object.entries(row.size_breakdown ?? {})
        .map(([size, pairs]) => [size, Math.round(Number(pairs) || 0)] as const)
        .filter(([, pairs]) => pairs > 0),
    ),
    retailPrice: Number(row.retail_price) || 0,
    costPerPair: Number(row.cost_per_pair) || 0,
    createdBy: row.created_by ?? "",
  };
}

const COLUMNS = `id, created_at, design, how, supplier_name, supplier_bill_no, pairs, size_breakdown, retail_price, cost_per_pair, created_by`;

/**
 * What the Owner still has to look at: goods added at the counter and not yet
 * seen, and goods whose supplier's bill has not come. Empty lists when the
 * table is not there yet.
 */
export async function getCounterItemsToWatch(): Promise<{ toReview: CounterItemRow[]; billToCome: CounterItemRow[] }> {
  if (!(await counterItemsReady().catch(() => false))) return { toReview: [], billToCome: [] };
  const [toReview, billToCome] = await Promise.all([
    queryPostgres<CounterItemDbRow>(
      STORE,
      `SELECT ${COLUMNS} FROM counter_items WHERE reviewed_at IS NULL ORDER BY created_at DESC LIMIT 50`,
    ),
    queryPostgres<CounterItemDbRow>(
      STORE,
      `SELECT ${COLUMNS} FROM counter_items
        WHERE how = 'pending_bill' AND bill_linked_at IS NULL
        ORDER BY created_at ASC LIMIT 50`,
    ),
  ]);
  return { toReview: toReview.map(counterItemFromRow), billToCome: billToCome.map(counterItemFromRow) };
}

/** The Owner has looked at an item added at the counter; it leaves the list. */
export async function markCounterItemReviewed(id: string, by: string) {
  if (!(await counterItemsReady())) return;
  await queryPostgres(
    STORE,
    `UPDATE counter_items SET reviewed_at = now(), reviewed_by = $2 WHERE id = $1 AND reviewed_at IS NULL`,
    [id, by.slice(0, 80)],
  );
}

/** How many counter items wait for the Owner's look — for the dashboard's reminder. */
export async function countCounterItemsToReview() {
  if (!(await counterItemsReady().catch(() => false))) return 0;
  const rows = await queryPostgres<{ n: number | string }>(
    STORE,
    "SELECT count(*)::int AS n FROM counter_items WHERE reviewed_at IS NULL",
  );
  return Number(rows[0]?.n ?? 0);
}
