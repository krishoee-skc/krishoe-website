import { queryPostgres } from "@/lib/postgres/client";
import { KATHMANDU_TODAY_SQL } from "@/lib/kathmandu-today-sql";
import { getPosInvoices } from "@/lib/pos";
import { salesByDay, type SaleLike } from "@/lib/dashboard-figures";

const STORE = "krishoe";

/**
 * What the last days really were, for the Analytics "Forecast" tab (owner,
 * 2026-10-14: "2 garau").
 *
 * The tab showed "180 pairs/day, confidence 85%" and "Rs. 35,000/day,
 * confidence 80%" written into the code since 2026-08-06 — numbers from no
 * data at all. It now shows the plain average of the shop's own records: pairs
 * from the piece ledger (taken-back lines left out, as the factory board does),
 * and sales from the POS bills less returns (voided bills left out, as the
 * dashboard does). No confidence figure: an average of real days needs none.
 */
export type RecentAverages = {
  days: number;
  pairsTotal: number;
  /** Days on which any work was entered. */
  pairsDays: number;
  /** The last day with work, YYYY-MM-DD, or "" — entries may simply have stopped. */
  lastPairsDay: string;
  salesTotal: number;
  /** Days on which the net sale was not zero. */
  salesDays: number;
  lastSalesDay: string;
};

/** Pure: the day-by-day figures in, the totals out. */
export function averagesOf(
  days: number,
  pairsByDay: Array<{ day: string; pairs: number }>,
  salesNetByDay: Array<{ day: string; net: number }>,
): RecentAverages {
  const sold = salesNetByDay.filter((row) => row.net !== 0);
  const worked = pairsByDay.filter((row) => row.pairs > 0);
  return {
    days,
    pairsTotal: worked.reduce((sum, row) => sum + row.pairs, 0),
    pairsDays: worked.length,
    lastPairsDay: worked.map((row) => row.day).sort().at(-1) ?? "",
    salesTotal: sold.reduce((sum, row) => sum + row.net, 0),
    salesDays: sold.length,
    lastSalesDay: sold.map((row) => row.day).sort().at(-1) ?? "",
  };
}

/** The last `days` Nepal days, today included. */
export async function getRecentAverages(days = 30): Promise<RecentAverages> {
  const [pairRows, invoices] = await Promise.all([
    queryPostgres<{ day: string; pairs: number }>(
      STORE,
      `SELECT work.date::text AS day, SUM(work.pairs_count)::integer AS pairs
         FROM factory_daily_work work
        WHERE work.status <> 'reversed'
          AND work.date > ${KATHMANDU_TODAY_SQL} - $1::integer
          AND work.date <= ${KATHMANDU_TODAY_SQL}
        GROUP BY work.date`,
      [days],
    ),
    getPosInvoices(),
  ]);
  const sales = salesByDay(invoices as SaleLike[], days).map((day) => ({ day: day.key, net: day.net }));
  return averagesOf(
    days,
    pairRows.map((row) => ({ day: String(row.day), pairs: Number(row.pairs) || 0 })),
    sales,
  );
}
