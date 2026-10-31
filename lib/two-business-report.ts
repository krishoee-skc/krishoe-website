import { queryPostgres } from "@/lib/postgres/client";
import { designKey } from "@/lib/design-name";
import { getCostingSnapshot } from "@/lib/costing";
import { getProducts } from "@/lib/product-store";
import { getShopFactoryAccount } from "@/lib/shop-factory-account";
import { factoryPriceOf, getFactoryPrices, shoeOrigins, twoBusinessReady } from "@/lib/two-business";

/**
 * Each business's profit, and the factory's price list (owner, 2026-10-31,
 * two businesses, part four). A management view, not the tax books:
 *
 *   factory  its own bills (KRF less KRFR) + made shoes the shop counted in
 *            from it on challans (less those sent back), less what those
 *            pairs cost to make;
 *   shop     its bills (KRB less KRR, online too), less what the pairs it
 *            sold cost it — a made shoe at its factory price, anything bought
 *            at what it was bought for.
 *
 * The factory price is paid by one and earned by the other, so the two
 * profits add up to the whole shop's, only split. Costs are costing's own
 * figure a pair; a shoe without one is counted at 0 and named.
 */

const STORE = "two business report";
const CEILING = 20000;

export type BusinessFigures = {
  sales: number;
  /** The factory's challan sales to the shop, less what came back; 0 for the shop. */
  toShop: number;
  cost: number;
  profit: number;
};

export type FactoryPriceRow = {
  id: string;
  name: string;
  /** What a pair costs to make; 0 when costing has no figure. */
  cost: number;
  /** Its own factory price; 0 when it takes the wholesale price. */
  ownPrice: number;
  /** The price the shop pays: its own, else wholesale; 0 when neither. */
  price: number;
  wholesale: number;
  retail: number;
};

export type TwoBusinessReport = {
  factory: BusinessFigures;
  shop: BusinessFigures;
  /** What the shop still owes the factory, all time; null before its table is there. */
  shopOwes: number | null;
  /** Shoes sold in the stretch with no cost a pair. */
  withoutCost: string[];
  prices: FactoryPriceRow[];
};

type BillRow = { kind: string; business: string; total: number | string; items: unknown };
type ChallanRow = { from_location: string; design: string; pairs: number | string; unit_price: number | string };

/** The stretch as a timestamp range on the Nepal day, or the whole history. */
function rangeSql(column: string, range: { startKey: string; endKey: string } | null, first: number) {
  if (!range) return { sql: "TRUE", params: [] as string[] };
  return {
    sql: `${column} >= ($${first}::date::timestamp AT TIME ZONE 'Asia/Kathmandu') AND ${column} < ($${first + 1}::date::timestamp AT TIME ZONE 'Asia/Kathmandu')`,
    params: [range.startKey, range.endKey],
  };
}

function itemsOf(raw: unknown): Array<{ design: string; quantity: number }> {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((item) => ({
      design: String((item as { design?: unknown })?.design ?? (item as { sku?: unknown })?.sku ?? ""),
      quantity: Number((item as { quantity?: unknown })?.quantity) || 0,
    }))
    .filter((item) => item.design && item.quantity > 0);
}

/** The two businesses over one stretch; null before they are set up. */
export async function getTwoBusinessReport(range: { startKey: string; endKey: string } | null): Promise<TwoBusinessReport | null> {
  if (!(await twoBusinessReady())) return null;
  const bills = rangeSql("created_at", range, 1);
  const received = rangeSql("t.received_at", range, 1);
  const [billRows, challanRows, costing, products, factoryPrices, origins, account] = await Promise.all([
    queryPostgres<BillRow>(
      STORE,
      `SELECT kind, business, total, items FROM pos_invoices
        WHERE status <> 'Voided' AND ${bills.sql} LIMIT ${CEILING}`,
      bills.params,
    ),
    queryPostgres<ChallanRow>(
      STORE,
      `SELECT t.from_location, i.design, COALESCE(i.received_pairs, 0) AS pairs, i.unit_price
         FROM stock_transfer_items i JOIN stock_transfers t ON t.id = i.transfer_id
        WHERE t.status = 'Received' AND i.unit_price > 0 AND ${received.sql} LIMIT ${CEILING}`,
      received.params,
    ),
    getCostingSnapshot().catch(() => null),
    getProducts({ includeDrafts: true }).catch(() => []),
    getFactoryPrices(),
    shoeOrigins(),
    getShopFactoryAccount().catch(() => null),
  ]);

  const costOf = (design: string) => costing?.unitCostByDesign[designKey(design)] ?? 0;
  const byKey = new Map(products.map((product) => [designKey(product.name), product]));
  const priceOf = (design: string) => {
    const product = byKey.get(designKey(design));
    if (!product) return 0;
    return factoryPriceOf(factoryPrices[product.id] ?? 0, Math.round((product.wholesalePriceValue ?? 0) / 100));
  };
  const made = (design: string) => origins[designKey(design)] === "made";
  const withoutCost = new Set<string>();
  const cost = (design: string) => {
    const value = costOf(design);
    if (!(value > 0)) withoutCost.add(design);
    return value;
  };

  const factory: BusinessFigures = { sales: 0, toShop: 0, cost: 0, profit: 0 };
  const shop: BusinessFigures = { sales: 0, toShop: 0, cost: 0, profit: 0 };

  for (const bill of billRows) {
    const sign = bill.kind === "Return" ? -1 : 1;
    const side = bill.business === "factory" ? factory : shop;
    side.sales += sign * (Number(bill.total) || 0);
    for (const item of itemsOf(bill.items)) {
      const each = side === factory ? cost(item.design) : made(item.design) ? priceOf(item.design) : cost(item.design);
      side.cost += sign * item.quantity * each;
    }
  }
  for (const line of challanRows) {
    const sign = line.from_location === "Shop" ? -1 : 1;
    const pairs = Number(line.pairs) || 0;
    factory.toShop += sign * pairs * (Number(line.unit_price) || 0);
    factory.cost += sign * pairs * cost(line.design);
  }
  for (const side of [factory, shop]) {
    side.sales = Math.round(side.sales);
    side.toShop = Math.round(side.toShop);
    side.cost = Math.round(side.cost);
    side.profit = side.sales + side.toShop - side.cost;
  }

  const prices: FactoryPriceRow[] = products
    .filter((product) => made(product.name))
    .map((product) => {
      const wholesale = Math.round((product.wholesalePriceValue ?? 0) / 100);
      const ownPrice = factoryPrices[product.id] ?? 0;
      return {
        id: product.id,
        name: product.name,
        cost: Math.round(costOf(product.name)),
        ownPrice,
        price: factoryPriceOf(ownPrice, wholesale),
        wholesale,
        retail: Math.round((product.priceValue ?? 0) / 100),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    factory,
    shop,
    shopOwes: account ? account.owed : null,
    withoutCost: [...withoutCost].sort(),
    prices,
  };
}
