import { getDataBackendConfig } from "@/lib/data-backend";
import { queryPostgres } from "@/lib/postgres/client";

/**
 * Pairs of each shoe at the shop and at the factory, by design name, for the
 * counter's "from the factory?" question (owner, 2026-10-20, audit 6). Names
 * match without case, as the stock does. Off Postgres there are no places, and
 * the question is never asked.
 */
export async function pairsAtPlaces(designs: string[]): Promise<Map<string, { shop: number; factory: number }> | null> {
  if (getDataBackendConfig().backend !== "postgres" || designs.length === 0) return null;
  const rows = await queryPostgres<{ design: string; location: string; pairs: number }>(
    "pos invoices",
    `SELECT lower(design) AS design, location, COALESCE(SUM(pairs), 0)::integer AS pairs
       FROM stock_locations
      WHERE lower(design) = ANY($1::text[])
      GROUP BY lower(design), location`,
    [designs.map((design) => design.trim().toLowerCase())],
  );
  const places = new Map<string, { shop: number; factory: number }>();
  for (const design of designs) places.set(design.trim().toLowerCase(), { shop: 0, factory: 0 });
  for (const row of rows) {
    const held = places.get(row.design) ?? { shop: 0, factory: 0 };
    if (row.location === "Shop") held.shop += Number(row.pairs) || 0;
    if (row.location === "Factory") held.factory += Number(row.pairs) || 0;
    places.set(row.design, held);
  }
  return places;
}
