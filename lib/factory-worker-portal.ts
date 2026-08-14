import { numeric } from "@/lib/factory-money";
import { queryPostgres } from "@/lib/postgres/client";

const STORE = "factory";

export type FactoryPortalWorker = {
  id: string;
  name: string;
  category: string;
  workerType: string;
  status: string;
};

export type FactoryPortalWorkEntry = {
  id: string;
  date: string;
  itemName: string;
  color: string;
  size: string;
  pairs: number;
  amountEarned: number;
  status: string;
};

export type FactoryPortalMonth = {
  month: string;
  totalPairs: number;
  totalEarned: number;
  totalPaid: number;
  finalBalance: number;
  status: string;
};

export type FactoryPortalDetail = {
  worker: FactoryPortalWorker;
  work: FactoryPortalWorkEntry[];
  months: FactoryPortalMonth[];
  balance: number;
};

function dateKey(value: string | Date) {
  return (value instanceof Date ? value.toISOString() : String(value)).slice(0, 10);
}

/**
 * Active factory workers, for the picker that attaches a sign-in to a worker.
 */
export async function listFactoryWorkerOptions() {
  const rows = await queryPostgres<{ id: string; name: string; category: string }>(
    STORE,
    `SELECT id, name, category
     FROM factory_workers
     WHERE status = 'active'
     ORDER BY name ASC`,
  );

  return rows.map((row) => ({ id: row.id, name: row.name, category: row.category }));
}

/**
 * Everything the worker portal shows one worker, read from the factory tables
 * the shop floor actually runs on.
 *
 * Read-only by design: the portal is a window onto the owner's records, never a
 * way to edit them. Scoped to a single worker_id throughout, so one signed-in
 * worker can never see another's pairs or pay.
 */
export async function getFactoryWorkerPortalDetail(
  workerId: string,
): Promise<FactoryPortalDetail | null> {
  const workers = await queryPostgres<{
    id: string;
    name: string;
    category: string;
    worker_type: string;
    status: string;
  }>(
    STORE,
    `SELECT id, name, category, worker_type, status
     FROM factory_workers
     WHERE id = $1
     LIMIT 1`,
    [workerId],
  );
  const worker = workers[0];
  if (!worker) return null;

  const [workRows, monthRows, balanceRows] = await Promise.all([
    // Bounded on purpose: a worker checking their phone wants their recent
    // entries, not several years of history pulled into memory.
    queryPostgres<{
      id: string;
      date: string | Date;
      item_name: string | null;
      color: string | null;
      size: string | null;
      pairs_count: number | string;
      amount_earned: string | number;
      status: string;
    }>(
      STORE,
      `SELECT w.id, w.date, i.name AS item_name, w.color, w.size,
              w.pairs_count, w.amount_earned, w.status
       FROM factory_daily_work w
       LEFT JOIN factory_items i ON i.id = w.item_id
       WHERE w.worker_id = $1
       ORDER BY w.date DESC, w.created_at DESC
       LIMIT 60`,
      [workerId],
    ),
    queryPostgres<{
      month: string | Date;
      total_pairs: number | string;
      total_earned: string | number;
      total_paid: string | number;
      final_balance: string | number;
      status: string;
    }>(
      STORE,
      `SELECT month, total_pairs, total_earned, total_paid, final_balance, status
       FROM factory_monthly_summary
       WHERE worker_id = $1
       ORDER BY month DESC
       LIMIT 12`,
      [workerId],
    ),
    // The running balance comes from the ledger rather than the latest monthly
    // row, so a payment recorded today is reflected before anyone regenerates
    // the month.
    queryPostgres<{ balance: string | number }>(
      STORE,
      `SELECT COALESCE(
                SUM(COALESCE(amount_earned, 0) - COALESCE(payment_given, 0)),
                0
              ) AS balance
       FROM factory_worker_ledger
       WHERE worker_id = $1 AND status <> 'reversed'`,
      [workerId],
    ),
  ]);

  return {
    worker: {
      id: worker.id,
      name: worker.name,
      category: worker.category,
      workerType: worker.worker_type,
      status: worker.status,
    },
    work: workRows.map((row) => ({
      id: row.id,
      date: dateKey(row.date),
      itemName: row.item_name ?? "Item removed",
      color: row.color ?? "",
      size: row.size ?? "",
      pairs: numeric(row.pairs_count),
      amountEarned: numeric(row.amount_earned),
      status: row.status,
    })),
    months: monthRows.map((row) => ({
      month: dateKey(row.month).slice(0, 7),
      totalPairs: numeric(row.total_pairs),
      totalEarned: numeric(row.total_earned),
      totalPaid: numeric(row.total_paid),
      finalBalance: numeric(row.final_balance),
      status: row.status,
    })),
    balance: numeric(balanceRows[0]?.balance),
  };
}
