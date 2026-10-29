import { getDataBackend } from "@/lib/data-backend";
import { queryPostgres } from "@/lib/postgres/client";

/**
 * What waits behind the buttons of the menu pages (owner, 2026-10-29): orders
 * not billed yet, cheques the bank returned, customers owing for over 30 days.
 * Workers' photos are counted where the menu already counts them. One small
 * read; a part that fails or a table not there yet counts as nothing, so a
 * menu page never breaks over a number.
 */
export type HubCounts = Record<string, number>;

export async function getHubCounts(want: { orders: boolean; cheques: boolean; dues: boolean }): Promise<HubCounts> {
  if (getDataBackend() !== "postgres") return {};
  const counts: HubCounts = {};

  const [main, cheques] = await Promise.all([
    want.orders || want.dues
      ? queryPostgres<{ orders: number; old_dues: number }>(
          "hub counts",
          `SELECT
             (SELECT count(*) FROM orders WHERE status IN ('New', 'Contacted'))::int AS orders,
             (SELECT count(*) FROM customer_ledgers
               WHERE balance_due > 0
                 AND last_transaction < (now() AT TIME ZONE 'Asia/Kathmandu')::date - 30)::int AS old_dues`,
        ).catch(() => [])
      : Promise.resolve([]),
    want.cheques
      ? queryPostgres<{ n: number }>("hub counts", "SELECT count(*)::int AS n FROM cheques WHERE state = 'bounced'").catch(() => [])
      : Promise.resolve([]),
  ]);

  if (want.orders && main[0]?.orders) counts["/admin/orders"] = main[0].orders;
  if (want.dues && main[0]?.old_dues) counts["/admin/dues"] = main[0].old_dues;
  if (want.cheques && cheques[0]?.n) counts["/admin/cheques"] = cheques[0].n;
  return counts;
}
