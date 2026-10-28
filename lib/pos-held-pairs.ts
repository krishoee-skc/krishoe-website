import { getDataBackendConfig } from "@/lib/data-backend";
import { UNCONFIRMED_HOLD_HOURS } from "@/lib/order-stock";
import { queryPostgres } from "@/lib/postgres/client";

/**
 * Pairs held by open online orders, by shoe name and size, for the counter's
 * "held for an order — sell anyway?" question (KR-BUG-014, owner 2026-10-28).
 *
 * The website already counts these before taking another order (the hold rule
 * of lib/order-stock.ts: a Contacted order holds its pairs, a New one for its
 * first UNCONFIRMED_HOLD_HOURS). The counter did not, and sold the last pair of
 * a size a called customer was waiting for. Names match without case, as the
 * stock does; an order line with no size holds the shoe as a whole. Off
 * Postgres there are no orders here, and the question is never asked.
 */
export type HeldPairs = { pairs: number; orders: string[] };

export function heldKey(design: string, size: string) {
  return `${design.trim().toLowerCase()}::${size.trim().toLowerCase()}`;
}

export async function pairsHeldByOrders(designs: string[]): Promise<Map<string, HeldPairs> | null> {
  if (getDataBackendConfig().backend !== "postgres" || designs.length === 0) return null;
  const rows = await queryPostgres<{ design: string; size: string; pairs: number | string; orders: string[] }>(
    "pos invoices",
    `SELECT lower(p.name) AS design, coalesce(oi.size, '') AS size,
            sum(oi.quantity)::integer AS pairs, array_agg(DISTINCT o.id) AS orders
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN products p ON p.id = oi.product_id
      WHERE lower(p.name) = ANY($1::text[])
        AND (
          o.status = 'Contacted'
          OR (o.status = 'New' AND o.created_at > now() - make_interval(hours => $2::int))
        )
      GROUP BY lower(p.name), coalesce(oi.size, '')`,
    [designs.map((design) => design.trim().toLowerCase()), UNCONFIRMED_HOLD_HOURS],
  );
  const held = new Map<string, HeldPairs>();
  for (const row of rows) {
    held.set(heldKey(row.design, row.size), { pairs: Number(row.pairs) || 0, orders: row.orders ?? [] });
  }
  return held;
}
