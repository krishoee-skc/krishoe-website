import { randomUUID } from "node:crypto";
import { queryPostgres } from "@/lib/postgres/client";
import { designKey } from "@/lib/design-name";
import { getProducts } from "@/lib/product-store";
import {
  factoryPriceOf,
  getFactoryPrices,
  shoeOrigins,
  shopPaymentsReady,
  twoBusinessReady,
  type ShoeOrigin,
} from "@/lib/two-business";

/**
 * The shop buying from the factory (owner, 2026-10-31, two businesses, part
 * three). A challan that carries a made shoe from the factory to the shop is
 * the factory's sale and the shop's purchase, at the shoe's factory price
 * (blank: its wholesale price) — counted once the shop has counted the pairs
 * in, and only the pairs that arrived. The other way it is a return. Bought
 * goods on a challan are only moved. What the shop then pays the factory is
 * kept here, and what is left is what the shop owes.
 */

const STORE = "shop factory account";

export type ChallanShoe = {
  /** Made or bought; absent when nobody has said. */
  origin?: ShoeOrigin;
  /** The catalog product, which keeps the word and the price; absent for a shoe not in Items. */
  productId?: string;
  /** Its factory price, else its wholesale price; 0 when it has neither. */
  price: number;
};

/** What the challan form needs per shoe, by lower-case design name. */
export async function challanShoes(): Promise<Record<string, ChallanShoe>> {
  if (!(await twoBusinessReady())) return {};
  const [origins, prices, products] = await Promise.all([
    shoeOrigins(),
    getFactoryPrices(),
    getProducts({ includeDrafts: true }).catch(() => []),
  ]);
  const shoes: Record<string, ChallanShoe> = {};
  for (const product of products) {
    const origin = origins[designKey(product.name)];
    shoes[product.name.trim().toLowerCase()] = {
      ...(origin ? { origin } : {}),
      productId: product.id,
      price: factoryPriceOf(prices[product.id] ?? 0, Math.round((product.wholesalePriceValue ?? 0) / 100)),
    };
  }
  return shoes;
}

/** Made shoes with no factory price and no wholesale price: what a challan cannot price. */
export async function madeShoesWithoutPrice(): Promise<Array<{ id: string; name: string }>> {
  const shoes = await challanShoes();
  const products = await getProducts({ includeDrafts: true }).catch(() => []);
  return products
    .filter((product) => {
      const shoe = shoes[product.name.trim().toLowerCase()];
      return shoe?.origin === "made" && !(shoe.price > 0);
    })
    .map((product) => ({ id: product.id, name: product.name }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export type ShopFactoryPayment = {
  id: string;
  paidOn: string;
  amount: number;
  method: "Cash" | "Bank" | "Cheque";
  note: string;
  createdBy: string;
};

export type ShopFactoryAccount = {
  /** Made shoes the shop counted in from the factory, at their price. */
  bought: number;
  /** Made shoes the shop sent back, at their price. */
  returned: number;
  /** Priced pairs still on the road, not owed until counted in. */
  onRoad: number;
  paid: number;
  /** bought − returned − paid. */
  owed: number;
  payments: ShopFactoryPayment[];
};

function rupees(value: unknown) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/** The shop's account with the factory, or null before its table is there. */
export async function getShopFactoryAccount(): Promise<ShopFactoryAccount | null> {
  if (!(await twoBusinessReady()) || !(await shopPaymentsReady())) return null;
  const [moved] = await queryPostgres<{ bought: string | number; returned: string | number; on_road: string | number }>(
    STORE,
    `SELECT
       COALESCE(SUM(CASE WHEN t.status = 'Received' AND t.from_location = 'Factory' THEN COALESCE(i.received_pairs, 0) * i.unit_price END), 0) AS bought,
       COALESCE(SUM(CASE WHEN t.status = 'Received' AND t.from_location = 'Shop' THEN COALESCE(i.received_pairs, 0) * i.unit_price END), 0) AS returned,
       COALESCE(SUM(CASE WHEN t.status = 'Sent' AND t.from_location = 'Factory' THEN i.sent_pairs * i.unit_price END), 0) AS on_road
     FROM stock_transfer_items i
     JOIN stock_transfers t ON t.id = i.transfer_id
     WHERE i.unit_price > 0`,
  );
  const payments = await queryPostgres<{
    id: string;
    paid_on: Date | string;
    amount: string | number;
    method: ShopFactoryPayment["method"];
    note: string;
    created_by: string;
  }>(
    STORE,
    `SELECT id, paid_on, amount, method, note, created_by FROM shop_factory_payments
      WHERE removed_at IS NULL ORDER BY paid_on DESC, created_at DESC LIMIT 500`,
  );
  const [paidRow] = await queryPostgres<{ paid: string | number }>(
    STORE,
    "SELECT COALESCE(SUM(amount), 0) AS paid FROM shop_factory_payments WHERE removed_at IS NULL",
  );
  const bought = rupees(moved?.bought);
  const returned = rupees(moved?.returned);
  const paid = rupees(paidRow?.paid);
  return {
    bought,
    returned,
    onRoad: rupees(moved?.on_road),
    paid,
    owed: rupees(bought - returned - paid),
    payments: payments.slice(0, 30).map((row) => ({
      id: row.id,
      paidOn: row.paid_on instanceof Date ? dayOf(row.paid_on) : String(row.paid_on).slice(0, 10),
      amount: rupees(row.amount),
      method: row.method,
      note: row.note ?? "",
      createdBy: row.created_by ?? "",
    })),
  };
}

function dayOf(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export const SHOP_PAYMENT_METHODS = ["Cash", "Bank", "Cheque"] as const;

export async function addShopFactoryPayment(input: {
  paidOn: string;
  amount: number;
  method: string;
  note: string;
  by: string;
}) {
  if (!(await shopPaymentsReady())) throw new Error("Prepare the database for the shop's payments, in Settings, first.");
  const amount = rupees(input.amount);
  if (!(amount > 0)) throw new Error("Type how much the shop paid.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidOn)) throw new Error("Choose the day it was paid.");
  const method = SHOP_PAYMENT_METHODS.find((option) => option === input.method) ?? "Cash";
  const id = `sfp-${randomUUID()}`;
  await queryPostgres(
    STORE,
    `INSERT INTO shop_factory_payments (id, paid_on, amount, method, note, created_by)
     VALUES ($1, $2::date, $3, $4, $5, $6)`,
    [id, input.paidOn, amount, method, input.note.trim().slice(0, 200), input.by.slice(0, 80)],
  );
  return { id, amount, method };
}

/** A wrong entry, marked removed with the reason; it stays on file. */
export async function removeShopFactoryPayment(id: string, by: string, reason: string) {
  if (!(await shopPaymentsReady())) return false;
  const why = reason.trim().slice(0, 200);
  if (!why) throw new Error("Say why it is removed.");
  const rows = await queryPostgres<{ id: string }>(
    STORE,
    `UPDATE shop_factory_payments SET removed_at = now(), removed_by = $2, removed_reason = $3
      WHERE id = $1 AND removed_at IS NULL RETURNING id`,
    [id, by.slice(0, 80), why],
  );
  return rows.length > 0;
}
