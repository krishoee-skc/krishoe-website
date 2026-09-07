/**
 * Reading the factory board's day from the database.
 *
 * Kept apart from lib/factory-board, which is pure arithmetic over rows and is
 * tested without a database. This file is the part that talks to Postgres, so
 * importing the sums never drags a connection pool into a unit test.
 *
 * The same query the /api/factory/work GET runs, so the server-rendered board
 * and the API can never drift into reporting different days.
 */
import { queryPostgres } from "@/lib/postgres/client";
import {
  factoryTotalsFromRow,
  normaliseWorkRow,
  type FactoryDayStats,
  type FactoryWorkRow,
} from "@/lib/factory-board";

const STORE = "krishoe";

/**
 * Every piece-rate work entry for one day, with the worker's and the item's
 * name filled in. Only piece-rate people: a monthly-salaried staff member has
 * no pairs to count, and counting them would dilute the day's rate.
 *
 * One day is a bounded read today — twenty-five people, a handful of entries
 * each — but the factory is built for two to five hundred, and a day at that
 * size is hundreds of rows handed to JavaScript to be added up. The ceiling is
 * generous enough that a real day never reaches it and firm enough that a
 * runaway day cannot drag the board down with it. The board's own sums come
 * from getFactoryDayTotals, which counts in the database and does not grow.
 */
const MAX_DAY_ENTRIES = 2000;

export async function getFactoryWorkForDate(date: string): Promise<FactoryWorkRow[]> {
  const rows = await queryPostgres<Record<string, unknown>>(
    STORE,
    `SELECT w.worker_id, w.item_id, w.pairs_count, w.reject_pairs, w.status, w.amount_earned,
            COALESCE(fw.name, 'Unknown Worker') AS worker_name,
            COALESCE(fi.name, 'Unknown Item') AS item_name
       FROM factory_daily_work w
       LEFT JOIN factory_workers fw ON w.worker_id = fw.id
       LEFT JOIN factory_items fi ON w.item_id = fi.id
      WHERE fw.worker_type = 'piece_rate' AND w.date = $1
      ORDER BY w.created_at DESC
      LIMIT ${MAX_DAY_ENTRIES}`,
    [date],
  );

  return rows.map((row) => normaliseWorkRow(row as Partial<FactoryWorkRow>));
}

/**
 * The day's totals, counted in the database.
 *
 * The board's headline numbers must stay right however big the day gets, so
 * they are summed where the rows live rather than by adding up a list that had
 * to be carried across first. This returns one row whether the factory logged
 * eight entries or eight hundred, which is why it has no ceiling to reach.
 */
export async function getFactoryDayTotals(date: string): Promise<FactoryDayStats> {
  const rows = await queryPostgres<Record<string, string | number | null>>(
    STORE,
    `SELECT COALESCE(SUM(w.pairs_count), 0) AS total_pairs,
            COALESCE(SUM(w.reject_pairs), 0) AS total_reject,
            COALESCE(SUM(w.amount_earned), 0) AS total_amount,
            COUNT(DISTINCT w.worker_id) AS workers_active,
            COUNT(*) FILTER (WHERE w.status = 'completed') AS completed_entries,
            COUNT(*) FILTER (WHERE w.status = 'in_progress') AS in_progress_entries,
            COUNT(*) FILTER (WHERE w.status = 'rework') AS rework_entries
       FROM factory_daily_work w
       LEFT JOIN factory_workers fw ON w.worker_id = fw.id
      WHERE fw.worker_type = 'piece_rate' AND w.date = $1`,
    [date],
  );

  return factoryTotalsFromRow(rows[0] ?? {});
}

export type FactoryOwed = { totalOwed: number; workersOwed: number };

/**
 * Wage still to hand over, and how many people are owed it.
 *
 * Worked out from the ledger as earned minus paid per worker — the same net
 * figure the salary screen settles against — rather than a stored running
 * balance, so the board and the payout cannot disagree.
 */
export async function getFactoryOwed(): Promise<FactoryOwed> {
  const rows = await queryPostgres<{ total_owed: string | number; workers_owed: string | number }>(
    STORE,
    `SELECT
       COALESCE(SUM(bal), 0) AS total_owed,
       COUNT(*) FILTER (WHERE bal > 0) AS workers_owed
     FROM (
       SELECT worker_id, SUM(amount_earned) - SUM(payment_given) AS bal
       FROM factory_worker_ledger
       GROUP BY worker_id
     ) per_worker`,
  );

  const row = rows[0] ?? { total_owed: 0, workers_owed: 0 };

  return {
    totalOwed: Math.max(0, Math.round(Number(row.total_owed) || 0)),
    workersOwed: Number(row.workers_owed) || 0,
  };
}
