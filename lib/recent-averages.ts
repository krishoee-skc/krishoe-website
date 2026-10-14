import { queryPostgres } from "@/lib/postgres/client";
import { KATHMANDU_TODAY_SQL } from "@/lib/kathmandu-today-sql";
import { getPosInvoices } from "@/lib/pos";
import { nepalDayKey, salesByDay, type SaleLike } from "@/lib/dashboard-figures";

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

export type DayPoint = { date: string; label: string; value: number };

function shortLabel(key: string) {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
}

/**
 * The "30-day trends" tab, from the same records (owner, 2026-10-14: "garau").
 *
 * The old trends read the first digits of a website order's total text
 * ("Rs. 2,100" counted as 2), dropped the days without an order, counted
 * taken-back work, and used the server's day, not Nepal's. Now: bills cut,
 * pairs in the piece ledger, and sales less returns, for every Nepal day.
 */
export function trendsFrom(
  keys: string[],
  pairsByDay: Array<{ day: string; pairs: number }>,
  invoices: SaleLike[],
) {
  const pairs = new Map(pairsByDay.map((row) => [row.day, row.pairs]));
  const bills = new Map<string, number>();
  for (const invoice of invoices) {
    if (invoice.kind !== "Sale" || invoice.status === "Voided") continue;
    const key = nepalDayKey(invoice.createdAt);
    bills.set(key, (bills.get(key) ?? 0) + 1);
  }
  const net = new Map(salesByDay(invoices, keys.length, new Date(`${keys.at(-1)}T12:00:00+05:45`)).map((day) => [day.key, day.net]));
  const point = (key: string, value: number): DayPoint => ({ date: key, label: shortLabel(key), value });
  return {
    salesTrend: keys.map((key) => point(key, bills.get(key) ?? 0)),
    productionTrend: keys.map((key) => point(key, pairs.get(key) ?? 0)),
    revenueTrend: keys.map((key) => point(key, Math.round(net.get(key) ?? 0))),
  };
}

export async function getDailyTrends(days = 30) {
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
  const keys = salesByDay([], days).map((day) => day.key);
  return trendsFrom(
    keys,
    pairRows.map((row) => ({ day: String(row.day), pairs: Number(row.pairs) || 0 })),
    invoices as SaleLike[],
  );
}
