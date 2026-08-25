import { bikramMonthKeyOf, bikramMonthRange } from "@/lib/bikram-sambat";
import { numeric, type DbNumeric } from "@/lib/factory-money";
import {
  transactionPostgres,
  type PostgresExecutor,
} from "@/lib/postgres/client";

const STORE = "factory";
const SUBMISSION_KEY_PATTERN = /^[A-Za-z0-9._:-]+$/;
const FACTORY_WORK_STATUSES = new Set(["completed"]);
const FACTORY_LEDGER_TYPES = new Set(["payment", "adjustment"]);

type FactoryProductionPaymentType =
  | "Saturday Kharcha"
  | "Midweek Advance"
  | "Final Settlement"
  | "Bonus"
  | "Deduction"
  | "Correction";

export class FactoryMutationError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "FactoryMutationError";
    this.status = status;
  }
}

export function submissionKeyForFactoryRequest(
  request: Pick<Request, "headers">,
  bodySubmissionKey: unknown,
) {
  const headerKey = request.headers.get("Idempotency-Key");
  const supplied = headerKey ?? bodySubmissionKey;

  // The caller must own this key and reuse it after a lost response. Generating
  // one on the server would make a retry look new and could duplicate money.
  if (supplied === null || supplied === undefined) {
    throw new FactoryMutationError("Idempotency-Key is required for this save.");
  }
  if (typeof supplied !== "string") {
    throw new FactoryMutationError("Idempotency-Key must be text.");
  }

  const key = supplied.trim();
  if (!key || key.length > 200 || !SUBMISSION_KEY_PATTERN.test(key)) {
    throw new FactoryMutationError(
      "Idempotency-Key must be 1-200 letters, numbers, dots, colons, underscores, or hyphens.",
    );
  }

  return key;
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function dbDate(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "").slice(0, 10);
}

function sameText(left: unknown, right: string | null) {
  return optionalText(left) === right;
}

function sameNumber(left: DbNumeric, right: number) {
  return Math.abs(numeric(left) - right) < 0.005;
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function lockSubmissionKey(db: PostgresExecutor, key: string) {
  // This closes the tiny race between "find by key" and INSERT. The database
  // unique indexes remain the final guard, while this lock lets us return the
  // original response cleanly even for two simultaneous retries.
  await db.query(
    "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
    [key],
  );
}

async function lockWorker(
  db: PostgresExecutor,
  workerId: string,
  options: { activeOnly?: boolean } = { activeOnly: true },
) {
  const rows = await db.query<{
    id: string;
    name: string;
    category: string;
    worker_type: string;
  }>(
    `SELECT id, name, category, worker_type
     FROM factory_workers
     WHERE id = $1${options.activeOnly === false ? "" : " AND status = 'active'"}
     FOR UPDATE`,
    [workerId],
  );

  if (!rows[0]) {
    throw new FactoryMutationError(
      options.activeOnly === false ? "Worker not found." : "Active worker not found.",
      404,
    );
  }
  return rows[0];
}

export function productionStageForFactoryCategory(category: string) {
  if (category === "Upper") return "Upper";
  if (category === "Fibermen" || category === "Fiber Preparation") return "Fiber Preparation";
  if (category === "Fiber Silai") return "Fiber Silai";
  if (category === "Bottom Final") return "Bottom Final";
  return null;
}

interface WorkRow {
  id: string;
  date: string | Date;
  worker_id: string;
  item_id: string;
  color: string | null;
  size: string | null;
  pairs_count: number;
  status: string;
  rate_applied: DbNumeric;
  amount_earned: DbNumeric;
  work_order_id: string | null;
}

export interface FactoryWorkInput {
  submissionKey: string;
  date: string;
  workerId: string;
  itemId: string;
  workOrderId?: string | null;
  color: string | null;
  size: string | null;
  pairsCount: number;
  status: string;
}

function workResponse(row: WorkRow, submissionKey: string, replayed: boolean) {
  return {
    id: row.id,
    date: dbDate(row.date),
    worker_id: row.worker_id,
    item_id: row.item_id,
    work_order_id: row.work_order_id ?? null,
    color: row.color,
    size: row.size,
    pairs_count: Number(row.pairs_count),
    rate: numeric(row.rate_applied),
    amount_earned: numeric(row.amount_earned),
    status: row.status,
    submission_key: submissionKey,
    replayed,
  };
}

function assertSameWork(row: WorkRow, input: FactoryWorkInput) {
  const matches =
    dbDate(row.date) === input.date &&
    row.worker_id === input.workerId &&
    row.item_id === input.itemId &&
    (row.work_order_id ?? null) === (input.workOrderId ?? null) &&
    sameText(row.color, input.color) &&
    sameText(row.size, input.size) &&
    Number(row.pairs_count) === input.pairsCount &&
    row.status === input.status;

  if (!matches) {
    throw new FactoryMutationError(
      "This submission key was already used for different factory work.",
      409,
    );
  }
}

export async function createFactoryWork(input: FactoryWorkInput) {
  if (!FACTORY_WORK_STATUSES.has(input.status)) {
    throw new FactoryMutationError(
      "Only completed work handed over by the worker can be posted for wage.",
    );
  }

  return transactionPostgres(STORE, async (db) => {
    await lockSubmissionKey(db, input.submissionKey);

    const existing = await db.query<WorkRow>(
      `SELECT id, date, worker_id, item_id, color, size, pairs_count, status,
              rate_applied, amount_earned, work_order_id
       FROM factory_daily_work
       WHERE submission_key = $1
       LIMIT 1`,
      [input.submissionKey],
    );
    if (existing[0]) {
      assertSameWork(existing[0], input);
      return workResponse(existing[0], input.submissionKey, true);
    }

    const worker = await lockWorker(db, input.workerId);
    if (worker.worker_type !== "piece_rate") {
      throw new FactoryMutationError(
        "Factory work and item-stage wage entries are only for piece-rate workers.",
        409,
      );
    }
    const items = await db.query<{
      id: string;
      production_item_id: string | null;
      production_item_name: string | null;
    }>(
      `SELECT items.id, items.production_item_id,
              production.name AS production_item_name
       FROM factory_items items
       LEFT JOIN production_items production
         ON production.id = items.production_item_id AND production.status = 'Active'
       WHERE items.id = $1 AND items.status = 'active'
       FOR SHARE OF items`,
      [input.itemId],
    );
    if (!items[0]) throw new FactoryMutationError("Active factory item not found.", 404);

    const stage = productionStageForFactoryCategory(worker.category);
    let linkedWorkOrder: {
      id: string;
      plannedPairs: number;
      completedBefore: number;
    } | null = null;

    if (input.workOrderId) {
      if (!items[0].production_item_id || !stage) {
        throw new FactoryMutationError(
          "Link this item to the Production Item Master before selecting a Work Order.",
          409,
        );
      }
      const orders = await db.query<{
        id: string;
        item_id: string;
        colour: string;
        size_breakdown: Record<string, number> | string;
        planned_pairs: number | string;
        current_stage: string;
      }>(
        `SELECT id, item_id, colour, size_breakdown, planned_pairs, current_stage
         FROM production_work_orders
         WHERE id = $1 AND status NOT IN ('Completed', 'Cancelled')
         FOR UPDATE`,
        [input.workOrderId],
      );
      const order = orders[0];
      if (!order) throw new FactoryMutationError("Open Work Order not found.", 404);
      if (order.item_id !== items[0].production_item_id) {
        throw new FactoryMutationError("The selected Work Order belongs to a different item.", 409);
      }
      if (order.current_stage !== stage) {
        throw new FactoryMutationError(
          `This Work Order is currently at ${order.current_stage}; select a ${order.current_stage} worker.`,
          409,
        );
      }
      if (input.color && order.colour && input.color.toLowerCase() !== order.colour.toLowerCase()) {
        throw new FactoryMutationError(`This Work Order colour is ${order.colour}.`, 409);
      }

      const sizePlan =
        typeof order.size_breakdown === "string"
          ? (JSON.parse(order.size_breakdown) as Record<string, number>)
          : order.size_breakdown;
      const sizeLabel = input.size?.trim();
      if (!sizeLabel || !(Number(sizePlan[sizeLabel]) > 0)) {
        throw new FactoryMutationError("Select one planned size from this Work Order.", 409);
      }
      const completed = await db.query<{
        completed_pairs: number | string;
        completed_size_pairs: number | string;
      }>(
        `SELECT
           COALESCE(SUM(total_pairs - rejected_pairs), 0) AS completed_pairs,
           COALESCE(SUM(COALESCE((size_breakdown ->> $3)::integer, 0)), 0)
             AS completed_size_pairs
         FROM production_work_entries
         WHERE work_order_id = $1 AND stage = $2 AND status = 'Approved'`,
        [input.workOrderId, stage, sizeLabel],
      );
      const completedPairs = Number(completed[0]?.completed_pairs ?? 0);
      const completedSizePairs = Number(completed[0]?.completed_size_pairs ?? 0);
      if (completedSizePairs + input.pairsCount > Number(sizePlan[sizeLabel])) {
        throw new FactoryMutationError(
          `${sizeLabel} exceeds its planned ${Number(sizePlan[sizeLabel])} pairs for this stage.`,
          409,
        );
      }
      if (completedPairs + input.pairsCount > Number(order.planned_pairs)) {
        throw new FactoryMutationError("This entry exceeds the Work Order planned pairs.", 409);
      }
      linkedWorkOrder = {
        id: order.id,
        plannedPairs: Number(order.planned_pairs),
        completedBefore: completedPairs,
      };
    }

    const rates = await db.query<{ rate_per_pair: DbNumeric; rate_source: string }>(
      `SELECT rate_per_pair, rate_source
       FROM (
         SELECT rate_per_pair, effective_from AS effective_date, created_at,
                0 AS priority, 'Worker override'::text AS rate_source
         FROM production_worker_stage_rates
         WHERE employee_id = $4 AND item_id = $5 AND stage = $6
           AND status = 'Active' AND effective_from <= $3::date
         UNION ALL
         SELECT rate_per_pair, effective_from AS effective_date, created_at,
                1 AS priority, 'Production stage'::text AS rate_source
         FROM production_stage_rates
         WHERE item_id = $5 AND stage = $6
           AND status = 'Active' AND effective_from <= $3::date
         UNION ALL
         SELECT rate_per_pair, effective_date, created_at,
                2 AS priority, 'Legacy Factory'::text AS rate_source
         FROM factory_rates
         WHERE item_id = $1 AND worker_category = $2
           AND effective_date <= $3::date
       ) available_rates
       ORDER BY priority, effective_date DESC, created_at DESC
       LIMIT 1`,
      [
        input.itemId,
        worker.category,
        input.date,
        worker.id,
        items[0].production_item_id,
        stage,
      ],
    );
    if (!rates[0]) {
      throw new FactoryMutationError(
        "Set this item and worker-category wage rate for the work date first.",
        409,
      );
    }

    const rate = numeric(rates[0].rate_per_pair);
    if (!(rate > 0)) {
      throw new FactoryMutationError("The applicable wage rate is invalid.", 409);
    }
    const workId = crypto.randomUUID();
    const inserted = await db.query<WorkRow>(
      `INSERT INTO factory_daily_work
       (id, submission_key, date, worker_id, item_id, color, size, pairs_count,
        status, rate_applied, amount_earned, work_order_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
               ROUND($10::numeric * $8::integer, 2), $11)
       RETURNING id, date, worker_id, item_id, color, size, pairs_count, status,
                 rate_applied, amount_earned, work_order_id`,
      [
        workId,
        input.submissionKey,
        input.date,
        input.workerId,
        input.itemId,
        input.color,
        input.size,
        input.pairsCount,
        input.status,
        rate,
        input.workOrderId ?? null,
      ],
    );
    const amountEarned = numeric(inserted[0].amount_earned);
    let productionSynced = false;

    if (
      items[0].production_item_id &&
      items[0].production_item_name &&
      stage
    ) {
      const sizeLabel = input.size?.trim() || "Mixed";
      await db.query(
        `INSERT INTO production_work_entries (
           id, work_date, employee_id, employee_name_snapshot, work_order_id,
           item_id, item_name_snapshot, stage, total_pairs, size_breakdown,
           rejected_pairs, rework_pairs, rate_per_pair_snapshot, earned_wage,
           status, approved_by, approved_at, note, source_submission_key
         ) VALUES (
           $1, $2, $3, $4, nullif($14, ''), $5, $6, $7, $8, $9::jsonb,
           0, 0, $10, $11, 'Approved', 'Factory quick entry', now(), $12, $13
         )`,
        [
          crypto.randomUUID(), input.date, worker.id, worker.name,
          items[0].production_item_id, items[0].production_item_name, stage,
          input.pairsCount, JSON.stringify({ [sizeLabel]: input.pairsCount }),
          rate, amountEarned, `Synced from Factory work ${workId}`, input.submissionKey,
          input.workOrderId ?? "",
        ],
      );
      productionSynced = true;

      if (linkedWorkOrder) {
        const stageComplete =
          linkedWorkOrder.completedBefore + input.pairsCount >= linkedWorkOrder.plannedPairs;
        await db.query(
          `UPDATE production_work_orders SET
             status = CASE WHEN $3 THEN
               CASE WHEN $2 = 'Bottom Final' THEN 'Ready for QC' ELSE 'In Progress' END
               ELSE 'In Progress' END,
             current_stage = CASE WHEN $3 THEN
               CASE $2
                 WHEN 'Upper' THEN 'Fiber Preparation'
                 WHEN 'Fiber Preparation' THEN 'Fiber Silai'
                 WHEN 'Fiber Silai' THEN 'Bottom Final'
                 ELSE 'Packing / QC'
               END
               ELSE current_stage END,
             updated_at = now()
           WHERE id = $1`,
          [linkedWorkOrder.id, stage, stageComplete],
        );
      }
    }

    if (worker.worker_type === "piece_rate") {
      const keyCollision = await db.query<{ id: string }>(
        `SELECT id FROM factory_worker_ledger
         WHERE submission_key = $1
         LIMIT 1`,
        [input.submissionKey],
      );
      if (keyCollision[0]) {
        throw new FactoryMutationError(
          "This submission key was already used for a different worker ledger entry.",
          409,
        );
      }

      const latest = await db.query<{ running_balance: DbNumeric }>(
        `SELECT COALESCE(
                  SUM(COALESCE(amount_earned, 0) - COALESCE(payment_given, 0)),
                  0
                ) AS running_balance
         FROM factory_worker_ledger
         WHERE worker_id = $1 AND status <> 'reversed'`,
        [input.workerId],
      );
      const newBalance = money(numeric(latest[0]?.running_balance) + amountEarned);

      await db.query(
        `INSERT INTO factory_worker_ledger
         (id, submission_key, source_work_id, worker_id, date, entry_type,
          work_pairs, amount_earned, payment_given, running_balance, status)
         VALUES ($1, $2, $3, $4, $5, 'work', $6, $7, 0, $8, 'pending')`,
        [
          crypto.randomUUID(),
          input.submissionKey,
          workId,
          input.workerId,
          input.date,
          input.pairsCount,
          amountEarned,
          newBalance,
        ],
      );
    }

    // Keep the worker's month current in the same transaction that recorded the
    // work. It used to be recomputed only when someone opened the reports page,
    // so any work posted afterwards was missing from the month it belonged to —
    // and the monthly figure is what the wage payment is read from. A locked
    // month is left untouched (writeMonthlySummary returns null): the work is
    // still real and still recorded, but a finalised month is not rewritten
    // behind the owner's back.
    // The Bikram Sambat month the work date falls in — .slice(0, 7) gave the
    // English one, which would put work done on 17 August into the month the
    // shop had already closed.
    await writeMonthlySummary(db, input.workerId, bikramMonthKeyOf(input.date));

    return {
      ...workResponse(inserted[0], input.submissionKey, false),
      production_synced: productionSynced,
      production_sync_reason: productionSynced
        ? "Linked HR worker, Production Item, stage and wage snapshot saved."
        : "Link this Factory worker and item to HR and Production Item Master for production-history sync.",
    };
  });
}

interface LedgerRow {
  id: string;
  worker_id: string;
  date: string | Date;
  entry_type: string;
  work_pairs: number | null;
  amount_earned: DbNumeric;
  payment_given: DbNumeric;
  running_balance: DbNumeric;
  status: string;
  notes: string | null;
  salary_period_month: string | Date | null;
}

export interface FactoryLedgerInput {
  submissionKey: string;
  workerId: string;
  date: string;
  entryType: string;
  workPairs: number | null;
  amountEarned: number;
  paymentGiven: number;
  status: "pending" | "settled";
  notes: string | null;
  salaryPeriodMonth?: string | null;
  allowedWorkerTypes?: readonly string[];
  productionPaymentType?: FactoryProductionPaymentType;
}

function ledgerResponse(row: LedgerRow, submissionKey: string, replayed: boolean) {
  return {
    id: row.id,
    worker_id: row.worker_id,
    date: dbDate(row.date),
    entry_type: row.entry_type,
    work_pairs: row.work_pairs === null ? null : Number(row.work_pairs),
    amount_earned: numeric(row.amount_earned),
    payment_given: numeric(row.payment_given),
    running_balance: numeric(row.running_balance),
    status: row.status,
    notes: row.notes,
    salary_period_month: row.salary_period_month
      ? dbDate(row.salary_period_month).slice(0, 7)
      : null,
    submission_key: submissionKey,
    replayed,
  };
}

function assertSameLedger(row: LedgerRow, input: FactoryLedgerInput) {
  const matches =
    row.worker_id === input.workerId &&
    dbDate(row.date) === input.date &&
    row.entry_type === input.entryType &&
    Number(row.work_pairs ?? 0) === Number(input.workPairs ?? 0) &&
    sameNumber(row.amount_earned, input.amountEarned) &&
    sameNumber(row.payment_given, input.paymentGiven) &&
    row.status === input.status &&
    sameText(row.notes, input.notes) &&
    (row.salary_period_month ? dbDate(row.salary_period_month).slice(0, 7) : null) ===
      (input.salaryPeriodMonth ?? null);

  if (!matches) {
    throw new FactoryMutationError(
      "This submission key was already used for a different worker ledger entry.",
      409,
    );
  }
}

export async function createFactoryLedgerEntry(input: FactoryLedgerInput) {
  if (!FACTORY_LEDGER_TYPES.has(input.entryType)) {
    throw new FactoryMutationError("Invalid worker ledger entry type.");
  }
  if (!(input.amountEarned > 0) && !(input.paymentGiven > 0)) {
    throw new FactoryMutationError("A positive earned or payment amount is required.");
  }
  if (input.amountEarned > 0 && input.paymentGiven > 0) {
    throw new FactoryMutationError("Earned and payment amounts must be separate entries.");
  }
  if (input.entryType === "payment" && !(input.paymentGiven > 0)) {
    throw new FactoryMutationError("A payment entry requires a positive payment amount.");
  }
  if (input.entryType === "payment" && (input.amountEarned > 0 || input.workPairs !== null)) {
    throw new FactoryMutationError("A payment cannot include work pairs or earned wages.");
  }
  if (input.entryType === "adjustment" && !input.notes) {
    throw new FactoryMutationError("An adjustment requires a note explaining the reason.");
  }

  return transactionPostgres(STORE, async (db) => {
    await lockSubmissionKey(db, input.submissionKey);
    // Former workers can still be paid or have an Owner-approved correction;
    // only new production work/advances require an active worker.
    const worker = await lockWorker(db, input.workerId, { activeOnly: false });
    if (
      input.allowedWorkerTypes &&
      !input.allowedWorkerTypes.includes(worker.worker_type)
    ) {
      throw new FactoryMutationError("This payment screen does not match the worker type.", 409);
    }
    const existing = await db.query<LedgerRow>(
      `SELECT id, worker_id, date, entry_type, work_pairs, amount_earned,
              payment_given, running_balance, status, notes, salary_period_month
       FROM factory_worker_ledger
       WHERE submission_key = $1
       LIMIT 1`,
      [input.submissionKey],
    );
    if (existing[0]) {
      assertSameLedger(existing[0], input);
      return {
        ...ledgerResponse(existing[0], input.submissionKey, true),
        production_payment_synced:
          input.entryType === "payment" &&
          worker.worker_type === "piece_rate",
      };
    }

    const latest = await db.query<{ running_balance: DbNumeric }>(
      `SELECT COALESCE(
                SUM(COALESCE(amount_earned, 0) - COALESCE(payment_given, 0)),
                0
              ) AS running_balance
       FROM factory_worker_ledger
       WHERE worker_id = $1 AND status <> 'reversed'`,
      [input.workerId],
    );
    const newBalance = money(
      numeric(latest[0]?.running_balance) + input.amountEarned - input.paymentGiven,
    );
    const ledgerId = crypto.randomUUID();
    const inserted = await db.query<LedgerRow>(
      `INSERT INTO factory_worker_ledger
       (id, submission_key, worker_id, date, entry_type, work_pairs,
        amount_earned, payment_given, running_balance, status, notes,
        salary_period_month)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::date)
       RETURNING id, worker_id, date, entry_type, work_pairs, amount_earned,
                 payment_given, running_balance, status, notes, salary_period_month`,
      [
        ledgerId,
        input.submissionKey,
        input.workerId,
        input.date,
        input.entryType,
        input.workPairs,
        input.amountEarned,
        input.paymentGiven,
        newBalance,
        input.status,
        input.notes,
        input.salaryPeriodMonth ? (bikramMonthRange(input.salaryPeriodMonth)?.startKey ?? null) : null,
      ],
    );

    let productionPaymentSynced = false;
    if (
      input.entryType === "payment" &&
      worker.worker_type === "piece_rate"
    ) {
      const paymentType = input.productionPaymentType ?? "Midweek Advance";
      await db.query(
        `INSERT INTO worker_payments (
           id, payment_date, employee_id, employee_name_snapshot, payment_type,
           direction, amount, payment_method, receipt_number, approved_by, note,
           source_submission_key
         ) VALUES ($1, $2, $3, $4, $5, 'Paid', $6, 'Cash', $7, 'Owner', $8, $9)`,
        [
          crypto.randomUUID(),
          input.date,
          worker.id,
          worker.name,
          paymentType,
          input.paymentGiven,
          `KR-FAC-${ledgerId.toUpperCase()}`,
          input.notes ?? "Factory cash payment",
          input.submissionKey,
        ],
      );
      productionPaymentSynced = true;
    }

    return {
      ...ledgerResponse(inserted[0], input.submissionKey, false),
      production_payment_synced: productionPaymentSynced,
      production_payment_sync_reason: productionPaymentSynced
        ? "Linked HR worker payment saved in Production Accounts."
        : "Link this piece-rate Factory worker to HR to synchronize Production Accounts.",
    };
  });
}

interface AdvanceRow {
  id: string;
  worker_id: string;
  week_of_date: string | Date;
  advance_amount: DbNumeric;
  date_given: string | Date;
  notes: string | null;
  salary_period_month: string | Date;
}

export interface FactoryAdvanceInput {
  submissionKey: string;
  workerId: string;
  amount: number;
  date: string;
  notes: string | null;
  periodMonth: string;
}

export function saturdayFor(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const week = new Date(Date.UTC(year, month - 1, day));
  const daysSinceSaturday = (week.getUTCDay() + 1) % 7;
  week.setUTCDate(week.getUTCDate() - daysSinceSaturday);
  return week.toISOString().slice(0, 10);
}

function advanceResponse(row: AdvanceRow, submissionKey: string, replayed: boolean) {
  return {
    id: row.id,
    worker_id: row.worker_id,
    amount: numeric(row.advance_amount),
    date: dbDate(row.date_given),
    week_of_date: dbDate(row.week_of_date),
    notes: row.notes,
    salary_period_month: dbDate(row.salary_period_month).slice(0, 7),
    submission_key: submissionKey,
    replayed,
  };
}

export async function createFactoryAdvance(input: FactoryAdvanceInput) {
  return transactionPostgres(STORE, async (db) => {
    await lockSubmissionKey(db, input.submissionKey);
    const existing = await db.query<AdvanceRow>(
      `SELECT id, worker_id, week_of_date, advance_amount, date_given, notes,
              salary_period_month
       FROM factory_weekly_advance
       WHERE submission_key = $1
       LIMIT 1`,
      [input.submissionKey],
    );
    if (existing[0]) {
      const matches =
        existing[0].worker_id === input.workerId &&
        dbDate(existing[0].date_given) === input.date &&
        sameNumber(existing[0].advance_amount, input.amount) &&
        sameText(existing[0].notes, input.notes) &&
        dbDate(existing[0].salary_period_month).slice(0, 7) === input.periodMonth;
      if (!matches) {
        throw new FactoryMutationError(
          "This submission key was already used for a different salary advance.",
          409,
        );
      }
      return advanceResponse(existing[0], input.submissionKey, true);
    }

    const worker = await lockWorker(db, input.workerId);
    if (worker.worker_type !== "monthly_staff") {
      throw new FactoryMutationError(
        "Factory salary advances are only for monthly staff; use HR payroll for daily staff.",
        409,
      );
    }
    const advanceId = crypto.randomUUID();
    const inserted = await db.query<AdvanceRow>(
      `INSERT INTO factory_weekly_advance
       (id, submission_key, worker_id, week_of_date, advance_amount, date_given,
        notes, salary_period_month)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date)
       RETURNING id, worker_id, week_of_date, advance_amount, date_given, notes,
                 salary_period_month`,
      [
        advanceId,
        input.submissionKey,
        input.workerId,
        saturdayFor(input.date),
        input.amount,
        input.date,
        input.notes,
        `${input.periodMonth}-01`,
      ],
    );
    return advanceResponse(inserted[0], input.submissionKey, false);
  });
}

interface SummaryRow {
  id: string;
  month: string | Date;
  worker_id: string;
  total_pairs: DbNumeric;
  total_earned: DbNumeric;
  total_paid: DbNumeric;
  final_balance: DbNumeric;
  status: string;
}

/**
 * Recomputes one worker's month from the daily work and ledger rows and writes
 * it back, using a transaction the caller already opened.
 *
 * Split out so posting work can keep the summary current in the same
 * transaction as the work itself. The alternative — calling
 * refreshFactoryMonthlySummary — would open a second transaction and take the
 * worker lock again while the first still holds it.
 *
 * Returns null when the month is locked, because the upsert declines to touch a
 * finalised month. Callers decide what that means: a deliberate refresh reports
 * the locked figures, while posting work simply leaves them alone.
 */
/**
 * `month` is a Bikram Sambat month key — "2083-05" for Bhadra.
 *
 * This function decides what a worker is owed for a month, so the month it
 * counts has to be the one the wage was agreed in. Filtered on the English
 * month, Bhadra split in half: the work from 17 August landed in "August" and
 * the rest in "September", and "how much did this worker earn in Bhadra" was a
 * question the app could not answer.
 *
 * The row is stored against the month's first A.D. day — 2026-08-17 for Bhadra
 * — so the dates in the database stay A.D. and every comparison Postgres does
 * keeps working. Only the boundary moved.
 */
async function writeMonthlySummary(db: PostgresExecutor, workerId: string, month: string) {
  const range = bikramMonthRange(month);
  if (!range) {
    throw new Error(`Not a Bikram Sambat month: ${month}`);
  }

  const workRows = await db.query<{
    total_pairs: DbNumeric;
    total_earned: DbNumeric;
  }>(
    `SELECT COALESCE(SUM(pairs_count), 0) AS total_pairs,
            COALESCE(SUM(amount_earned), 0) AS total_earned
     FROM factory_daily_work
     WHERE worker_id = $1
       AND date >= $2::date
       AND date < $3::date
       AND status = 'completed'`,
    [workerId, range.startKey, range.endKey],
  );
  const paymentRows = await db.query<{ total_paid: DbNumeric }>(
    `SELECT COALESCE(SUM(payment_given), 0) AS total_paid
     FROM factory_worker_ledger
     WHERE worker_id = $1
       AND entry_type = 'payment'
       AND status <> 'reversed'
       AND date >= $2::date
       AND date < $3::date`,
    [workerId, range.startKey, range.endKey],
  );
  const balanceRows = await db.query<{ closing_balance: DbNumeric }>(
    `SELECT COALESCE(
              SUM(COALESCE(amount_earned, 0) - COALESCE(payment_given, 0)),
              0
            ) AS closing_balance
     FROM factory_worker_ledger
     WHERE worker_id = $1
       AND status <> 'reversed'
       AND date < $2::date`,
    [workerId, range.endKey],
  );

  const rows = await db.query<SummaryRow>(
    `INSERT INTO factory_monthly_summary
     (id, month, worker_id, total_pairs, total_earned, total_paid, final_balance, status)
     VALUES ($1, $2::date, $3, $4, $5, $6, $7, 'draft')
     ON CONFLICT (month, worker_id) DO UPDATE SET
       total_pairs = EXCLUDED.total_pairs,
       total_earned = EXCLUDED.total_earned,
       total_paid = EXCLUDED.total_paid,
       final_balance = EXCLUDED.final_balance,
       updated_at = now()
     WHERE factory_monthly_summary.status <> 'locked'
     RETURNING id, month, worker_id, total_pairs, total_earned, total_paid,
               final_balance, status`,
    [
      crypto.randomUUID(),
      range.startKey,
      workerId,
      numeric(workRows[0]?.total_pairs),
      numeric(workRows[0]?.total_earned),
      numeric(paymentRows[0]?.total_paid),
      money(numeric(balanceRows[0]?.closing_balance)),
    ],
  );

  return rows[0] ?? null;
}

export async function refreshFactoryMonthlySummary(input: {
  submissionKey: string;
  month: string;
  workerId: string;
}) {
  return transactionPostgres(STORE, async (db) => {
    // The natural record identity, rather than only a browser key, serialises
    // two admins refreshing the same worker/month at once.
    await lockSubmissionKey(db, `summary:${input.workerId}:${input.month}`);
    const worker = await lockWorker(db, input.workerId, { activeOnly: false });
    if (worker.worker_type !== "piece_rate") {
      throw new FactoryMutationError(
        "Monthly production wage summaries are only for piece-rate workers.",
      );
    }

    let summary = await writeMonthlySummary(db, input.workerId, input.month);
    if (!summary) {
      const lockedRows = await db.query<SummaryRow>(
        `SELECT id, month, worker_id, total_pairs, total_earned, total_paid,
                final_balance, status
         FROM factory_monthly_summary
         WHERE month = $1::date AND worker_id = $2 AND status = 'locked'
         LIMIT 1`,
        [`${input.month}-01`, input.workerId],
      );
      summary = lockedRows[0];
      if (!summary) {
        throw new FactoryMutationError("Monthly summary could not be refreshed.", 409);
      }
    }

    return {
      id: summary.id,
      month: input.month,
      worker_id: summary.worker_id,
      total_pairs: numeric(summary.total_pairs),
      total_earned: numeric(summary.total_earned),
      total_paid: numeric(summary.total_paid),
      final_balance: numeric(summary.final_balance),
      status: summary.status,
      submission_key: input.submissionKey,
      replayed: summary.status === "locked",
    };
  });
}
