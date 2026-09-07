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
  normalisePayrollRow,
  normaliseWorker,
  normaliseWorkRow,
  type FactoryDayStats,
  type FactoryPayrollRow,
  type FactoryWorker,
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

/**
 * The payroll already worked out for a Bikram Sambat month.
 *
 * One query for the whole team, however many people that is. The reports
 * screen rebuilds each worker's summary on demand — a write, one worker at a
 * time — but opening the screen should not have to wait for that; it reads
 * what is already there and offers to refresh.
 *
 * Bounded by headcount, which is a number of people rather than a table that
 * grows every day, so there is nothing here to cap.
 */
export async function getFactoryPayrollForMonth(
  startKey: string,
  endKey: string,
): Promise<FactoryPayrollRow[]> {
  const rows = await queryPostgres<Record<string, unknown>>(
    STORE,
    `SELECT ms.worker_id, ms.total_pairs, ms.total_earned, ms.total_paid,
            ms.final_balance, ms.status,
            fw.name AS worker_name, fw.category
       FROM factory_monthly_summary ms
       JOIN factory_workers fw ON ms.worker_id = fw.id
      WHERE ms.month >= $1::date AND ms.month < $2::date
        AND fw.worker_type = 'piece_rate'
      ORDER BY fw.name ASC`,
    [startKey, endKey],
  );

  return rows.map((row) => normalisePayrollRow(row as Partial<FactoryPayrollRow>));
}

/**
 * Everyone on the factory's books, with the pairs they have made today and
 * this week.
 *
 * `includeRetired` is for the team screen, the only place that can bring
 * someone back; every other list and form hides them.
 *
 * Bounded by headcount — a number of people, not a table that grows daily —
 * so there is nothing here to cap. Both the /api/factory/workers GET and the
 * server-rendered team screen read through this, so the running week beside a
 * name means the same thing wherever it is shown.
 */
export async function getFactoryWorkers(
  options: { includeRetired?: boolean; workerType?: string } = {},
): Promise<FactoryWorker[]> {
  // The piece-wage ledger wants piece-rate people and the salary screen wants
  // monthly staff. Both used to read the whole team and drop two thirds of it
  // in the browser; asked for here, the database sends only what is wanted.
  const conditions: string[] = [];
  const params: string[] = [];

  if (!options.includeRetired) {
    conditions.push("workers.status = 'active'");
  }
  if (options.workerType) {
    params.push(options.workerType);
    conditions.push(`workers.worker_type = $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await queryPostgres<Record<string, unknown>>(
    STORE,
    `SELECT workers.id, workers.name, workers.worker_type, workers.category,
            workers.monthly_salary, workers.weekly_advance, workers.status,
            workers.created_at,
            COALESCE(today_work.today_pairs, 0)::integer AS today_pairs,
            COALESCE(week_work.week_pairs, 0)::integer AS week_pairs,
            COALESCE(week_work.week_earned, 0)::numeric AS week_earned
       FROM factory_workers workers
       LEFT JOIN LATERAL (
         SELECT SUM(work.pairs_count)::integer AS today_pairs
         FROM factory_daily_work work
         WHERE work.worker_id = workers.id AND work.date = CURRENT_DATE
       ) today_work ON true
       -- This week's pairs and wage, Sunday to today, so the work-entry screen
       -- can show the worker's running week beside their name.
       LEFT JOIN LATERAL (
         SELECT SUM(work.pairs_count)::integer AS week_pairs,
                SUM(work.amount_earned)::numeric AS week_earned
         FROM factory_daily_work work
         WHERE work.worker_id = workers.id
           AND work.date >= date_trunc('week', CURRENT_DATE)
       ) week_work ON true
       ${where}
       ORDER BY workers.status ASC, workers.name ASC`,
    params,
  );

  return rows.map((row) => normaliseWorker(row as Partial<FactoryWorker>));
}

export type FactoryItem = {
  id: string;
  name: string;
  code: string | null;
  status: string;
  created_at: string;
  material_cost_per_pair: number | null;
  production_item_id: string | null;
  production_item_name: string | null;
};

export type ProductionItemOption = {
  id: string;
  name: string;
  category: string;
  production_type: string;
  size_group: string;
};

export type WorkOrderOption = {
  id: string;
  work_order_number: string;
  item_id: string;
  item_name_snapshot: string;
  colour: string;
  size_breakdown: Record<string, number>;
  planned_pairs: number;
  current_stage: string;
  status: string;
  due_date: string | null;
};

/**
 * A work order as the screens want it: the size breakdown parsed, the pairs a
 * number, the due date a plain day.
 *
 * Postgres hands JSONB back as an object through some drivers and a string
 * through others, and a date as a Date. Settling all three here means neither
 * the API nor the server-rendered screen has to remember to.
 */
function normaliseWorkOrder(row: Record<string, unknown>): WorkOrderOption {
  const breakdown = row.size_breakdown;
  const dueDate = row.due_date;

  return {
    id: String(row.id ?? ""),
    work_order_number: String(row.work_order_number ?? ""),
    item_id: String(row.item_id ?? ""),
    item_name_snapshot: String(row.item_name_snapshot ?? ""),
    colour: String(row.colour ?? ""),
    size_breakdown:
      typeof breakdown === "string"
        ? (JSON.parse(breakdown) as Record<string, number>)
        : ((breakdown ?? {}) as Record<string, number>),
    planned_pairs: Number(row.planned_pairs) || 0,
    current_stage: String(row.current_stage ?? ""),
    status: String(row.status ?? ""),
    due_date:
      dueDate instanceof Date
        ? dueDate.toISOString().slice(0, 10)
        : dueDate
          ? String(dueDate).slice(0, 10)
          : null,
  };
}

/**
 * The factory's items, the production items they can point at, and the work
 * orders still open.
 *
 * Read together because the item screen needs all three to draw one row — the
 * item, what it is linked to, and what is being made from it — and the
 * work-entry screen needs the last two. Both the /api/factory/items GET and
 * the server-rendered item screen come through here.
 */
export async function getFactoryItems(
  options: { includeRetired?: boolean } = {},
): Promise<{
  items: FactoryItem[];
  productionItems: ProductionItemOption[];
  workOrders: WorkOrderOption[];
}> {
  const [items, productionItems, workOrders] = await Promise.all([
    queryPostgres<Record<string, unknown>>(
      STORE,
      `SELECT items.id, items.name, items.code, items.status, items.created_at,
              items.material_cost_per_pair,
              items.production_item_id, production.name AS production_item_name
         FROM factory_items items
         LEFT JOIN production_items production ON production.id = items.production_item_id
         ${options.includeRetired ? "" : "WHERE items.status = 'active'"}
        ORDER BY items.status ASC, items.name ASC`,
    ),
    queryPostgres<ProductionItemOption>(
      STORE,
      `SELECT id, name, category, production_type, size_group
         FROM production_items
        WHERE status = 'Active'
        ORDER BY name ASC`,
    ),
    queryPostgres<Record<string, unknown>>(
      STORE,
      `SELECT id, work_order_number, item_id, item_name_snapshot, colour,
              size_breakdown, planned_pairs, current_stage, status, due_date
         FROM production_work_orders
        WHERE status NOT IN ('Completed', 'Cancelled')
        ORDER BY due_date NULLS LAST, created_at DESC
        LIMIT 100`,
    ),
  ]);

  return {
    items: items.map((row) => ({
      id: String(row.id ?? ""),
      name: String(row.name ?? ""),
      code: row.code ? String(row.code) : null,
      status: String(row.status ?? ""),
      created_at: String(row.created_at ?? ""),
      // A material cost that was never set is unset, not free — the form shows
      // an empty box rather than a cost of zero.
      material_cost_per_pair:
        row.material_cost_per_pair === null || row.material_cost_per_pair === undefined
          ? null
          : Number(row.material_cost_per_pair) || 0,
      production_item_id: row.production_item_id ? String(row.production_item_id) : null,
      production_item_name: row.production_item_name ? String(row.production_item_name) : null,
    })),
    productionItems,
    workOrders: workOrders.map(normaliseWorkOrder),
  };
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
