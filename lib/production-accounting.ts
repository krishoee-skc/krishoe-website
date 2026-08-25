import { createHash } from "node:crypto";
/**
 * One worker, as the production screens need them.
 *
 * `department` is the factory stage they work in — the field kept its old name
 * so the screens reading it did not all have to change on the same day.
 */
export type ProductionWorker = {
  id: string;
  name: string;
  department: string;
  status: "Active" | "Inactive";
};

/** The shop's people, from the table their wages are actually paid out of. */
async function listProductionWorkers(): Promise<ProductionWorker[]> {
  const rows = await queryPostgres<{ id: string; name: string; category: string; status: string }>(
    "production workers",
    `SELECT id, name, category, status FROM factory_workers ORDER BY status, name`,
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    department: row.category,
    status: row.status === "active" ? "Active" : "Inactive",
  }));
}
import { getProducts } from "@/lib/product-store";
import { insertStockMovement } from "@/lib/operations-postgres";
import { queryPostgres, transactionPostgres } from "@/lib/postgres/client";
import {
  assertWorkQuantity,
  assertFinishedStockPosting,
  calculateEarnedWage,
  normalizeSizeBreakdown,
  nextProductionStage,
  handoverSignal,
  productionStages,
  type ProductionStage,
  type SizeBreakdown,
  type WorkerPaymentDirection,
  type WorkerPaymentType,
} from "@/lib/production-accounting-rules";

export type ProductionItem = {
  id: string;
  name: string;
  category: string;
  productionType: "Manufactured" | "Resale" | "Mixed";
  sizeGroup: "Baby" | "Kids" | "Ladies" | "Gents" | "Mixed";
  catalogProductId: string;
  status: "Active" | "Inactive";
};

export type StageRate = {
  id: string;
  itemId: string;
  stage: ProductionStage;
  ratePerPair: number;
  effectiveFrom: string;
};

export type WorkerStageRate = StageRate & {
  employeeId: string;
  employeeName: string;
  note: string;
};

export type WorkEntry = {
  id: string;
  workDate: string;
  employeeId: string;
  employeeName: string;
  workOrderId: string;
  itemName: string;
  stage: ProductionStage;
  totalPairs: number;
  sizeBreakdown: SizeBreakdown;
  rejectedPairs: number;
  ratePerPair: number;
  earnedWage: number;
  status: "Submitted" | "Approved" | "Reversed";
};

export type ProductionWorkOrder = {
  id: string;
  workOrderNumber: string;
  itemId: string;
  itemName: string;
  colour: string;
  sizeBreakdown: SizeBreakdown;
  plannedPairs: number;
  dueDate: string;
  priority: "Normal" | "High" | "Urgent";
  currentStage: ProductionStage | "Packing / QC";
  status: "Planning" | "In Progress" | "Ready for QC" | "Completed" | "Cancelled";
  createdBy: string;
};

export type ProductionCctvReference = {
  id: string;
  stage: ProductionStage | "Packing / QC";
  cameraZone: string;
  windowStart: string;
  windowEnd: string;
  cctvReference: string;
  evidenceReference: string;
  recordedBy: string;
  note: string;
};

export type ProductionHandover = {
  id: string;
  handoverDate: string;
  workOrderId: string;
  workOrderNumber: string;
  fromStage: ProductionStage;
  toStage: ProductionStage | "Packing / QC";
  fromEmployeeName: string;
  toEmployeeName: string;
  sentPairs: number;
  receivedPairs: number;
  receivedSizeBreakdown: SizeBreakdown;
  signal: "Matched" | "Short" | "Excess";
  difference: number;
};

export type WorkerBalance = {
  employeeId: string;
  employeeName: string;
  earned: number;
  paid: number;
  balance: number;
};

export type WorkerPayment = {
  id: string;
  paymentDate: string;
  employeeId: string;
  employeeName: string;
  paymentType: WorkerPaymentType;
  direction: WorkerPaymentDirection;
  amount: number;
  receiptNumber: string;
  approvedBy: string;
  note: string;
};

export type QcStockPosting = {
  id: string;
  qcDate: string;
  approvalReference: string;
  workOrderId: string;
  itemName: string;
  catalogProductName: string;
  packingEmployeeName: string;
  totalPairs: number;
  rejectedPairs: number;
  sizeBreakdown: SizeBreakdown;
  stockMovementId: string;
  approvedBy: string;
};

export type ProductionMaterial = {
  id: string;
  name: string;
  unit: string;
  averageUnitCost: number;
};

export type ItemMaterial = {
  id: string;
  itemId: string;
  materialId: string;
  materialName: string;
  unit: string;
  quantityPerPair: number;
  wastagePercent: number;
  averageUnitCost: number;
  costPerPair: number;
};

export type ProductionCostCard = {
  id: string;
  effectiveFrom: string;
  itemId: string;
  itemName: string;
  materialCostPerPair: number;
  laborCostPerPair: number;
  otherDirectCostPerPair: number;
  makingCostPerPair: number;
  wholesaleProfitPercent: number;
  wholesalePrice: number;
  retailExtraAmount: number;
  retailPrice: number;
  approvedBy: string;
};

type ItemRow = {
  id: string;
  name: string;
  category: string;
  production_type: ProductionItem["productionType"];
  size_group: ProductionItem["sizeGroup"];
  catalog_product_id: string | null;
  status: ProductionItem["status"];
};

type RateRow = {
  id: string;
  item_id: string;
  stage: ProductionStage;
  rate_per_pair: number | string;
  effective_from: Date | string;
};

type WorkerRateRow = RateRow & {
  employee_id: string;
  employee_name_snapshot: string;
  note: string;
};

type WorkRow = {
  id: string;
  work_date: Date | string;
  employee_id: string;
  employee_name_snapshot: string;
  work_order_id: string | null;
  item_name_snapshot: string;
  stage: ProductionStage;
  total_pairs: number | string;
  size_breakdown: SizeBreakdown | string;
  rejected_pairs: number | string;
  rate_per_pair_snapshot: number | string;
  earned_wage: number | string;
  status: WorkEntry["status"];
};

type WorkOrderRow = {
  id: string;
  work_order_number: string;
  item_id: string;
  item_name_snapshot: string;
  colour: string;
  size_breakdown: SizeBreakdown | string;
  planned_pairs: number | string;
  due_date: Date | string | null;
  priority: ProductionWorkOrder["priority"];
  current_stage: ProductionWorkOrder["currentStage"];
  status: ProductionWorkOrder["status"];
  created_by: string;
};

type HandoverRow = {
  id: string;
  handover_date: Date | string;
  work_order_id: string;
  work_order_number_snapshot: string;
  from_stage: ProductionStage;
  to_stage: ProductionStage | "Packing / QC";
  from_employee_name_snapshot: string;
  to_employee_name_snapshot: string;
  sent_pairs: number | string;
  received_pairs: number | string;
  received_size_breakdown: SizeBreakdown | string;
};

type BalanceRow = {
  employee_id: string;
  employee_name: string;
  earned: number | string;
  paid: number | string;
  balance: number | string;
};

type WorkerAccountTotalsRow = {
  total_earned: number | string;
  total_paid: number | string;
  opening_earned: number | string;
  opening_paid: number | string;
};

type WeeklySettlementRow = {
  employee_id: string;
  employee_name: string;
  opening_balance: number | string;
  completed_pairs: number | string;
  rejected_pairs: number | string;
  earned: number | string;
  paid: number | string;
};

type WorkOrderMaterialPlanRow = {
  material_id: string;
  material_name: string;
  unit: string;
  quantity_per_pair: number | string;
  wastage_percent: number | string;
  opening_stock: number | string;
  received: number | string;
  used: number | string;
  average_unit_cost: number | string;
};

type ProductionMaterialConsumptionRow = {
  id: string;
  consumption_date: Date | string;
  work_order_id: string;
  work_order_number_snapshot: string;
  material_id: string;
  material_name_snapshot: string;
  unit_snapshot: string;
  quantity: number | string;
  wastage: number | string;
  approved_by: string;
  note: string;
};

type PaymentRow = {
  id: string;
  payment_date: Date | string;
  employee_id: string;
  employee_name_snapshot: string;
  payment_type: WorkerPaymentType;
  direction: WorkerPaymentDirection;
  amount: number | string;
  receipt_number: string;
  approved_by: string;
  note: string;
};

type QcPostingRow = {
  id: string;
  qc_date: Date | string;
  approval_reference: string;
  work_order_id: string | null;
  item_name_snapshot: string;
  catalog_product_name_snapshot: string;
  packing_employee_name_snapshot: string;
  total_pairs: number | string;
  rejected_pairs: number | string;
  size_breakdown: SizeBreakdown | string;
  stock_movement_id: string;
  approved_by: string;
};

type ProductionMaterialRow = {
  id: string;
  name: string;
  unit: string;
  average_unit_cost: number | string;
};

type ItemMaterialRow = {
  id: string;
  item_id: string;
  material_id: string;
  material_name_snapshot: string;
  unit_snapshot: string;
  quantity_per_pair: number | string;
  wastage_percent: number | string;
  average_unit_cost: number | string;
};

type CostCardRow = {
  id: string;
  effective_from: Date | string;
  item_id: string;
  item_name_snapshot: string;
  material_cost_per_pair: number | string;
  labor_cost_per_pair: number | string;
  other_direct_cost_per_pair: number | string;
  making_cost_per_pair: number | string;
  wholesale_profit_percent: number | string;
  wholesale_price: number | string;
  retail_extra_amount: number | string;
  retail_price: number | string;
  approved_by: string;
};

type ProductionControlRow = {
  active_work_orders: number | string;
  overdue_work_orders: number | string;
  ready_for_qc: number | string;
  today_good_pairs: number | string;
  today_rejected_pairs: number | string;
  today_earned_wage: number | string;
  active_worker_count: number | string;
  today_stock_pairs: number | string;
  handover_mismatches: number | string;
  worker_balance_due: number | string;
};

export type ProductionPeriodSummary = {
  goodPairs: number;
  rejectedPairs: number;
  earnedWage: number;
  cashPaid: number;
  stockPostedPairs: number;
  completedWorkOrders: number;
  topWorker: { name: string; goodPairs: number } | null;
};

function numeric(value: number | string) {
  return Math.round(Number(value) * 100) / 100;
}

function isoDate(value: Date | string) {
  return (value instanceof Date ? value.toISOString() : String(value)).slice(0, 10);
}

export async function getProductionControlSummary() {
  const [rows, stages] = await Promise.all([
    queryPostgres<ProductionControlRow>(
      "production control summary",
      `WITH earned AS (
         SELECT employee_id, coalesce(sum(earned_wage), 0) AS amount
         FROM production_work_entries WHERE status = 'Approved' GROUP BY employee_id
       ), paid AS (
         SELECT employee_id, coalesce(sum(CASE
           WHEN direction IN ('Paid', 'Recovered') THEN amount
           WHEN direction = 'Added' THEN -amount ELSE 0 END), 0) AS amount
         FROM worker_payments WHERE reversed_at IS NULL GROUP BY employee_id
       ), people AS (
         SELECT employee_id FROM earned UNION SELECT employee_id FROM paid
       )
       SELECT
         (SELECT count(*) FROM production_work_orders
          WHERE status NOT IN ('Completed', 'Cancelled')) AS active_work_orders,
         (SELECT count(*) FROM production_work_orders
          WHERE status NOT IN ('Completed', 'Cancelled')
            AND due_date IS NOT NULL AND due_date < CURRENT_DATE) AS overdue_work_orders,
         (SELECT count(*) FROM production_work_orders
          WHERE status = 'Ready for QC') AS ready_for_qc,
         (SELECT coalesce(sum(total_pairs - rejected_pairs), 0)
          FROM production_work_entries
          WHERE status = 'Approved' AND work_date = CURRENT_DATE) AS today_good_pairs,
         (SELECT coalesce(sum(rejected_pairs), 0)
          FROM production_work_entries
          WHERE status = 'Approved' AND work_date = CURRENT_DATE) AS today_rejected_pairs,
         (SELECT coalesce(sum(earned_wage), 0)
          FROM production_work_entries
          WHERE status = 'Approved' AND work_date = CURRENT_DATE) AS today_earned_wage,
         -- People who actually did work today, not people on the payroll. The
         -- dashboard showed a hardcoded 12 in this place.
         (SELECT count(DISTINCT employee_id)
          FROM production_work_entries
          WHERE status = 'Approved' AND work_date = CURRENT_DATE) AS active_worker_count,
         (SELECT coalesce(sum(total_pairs), 0)
          FROM production_qc_postings
          WHERE qc_date = CURRENT_DATE AND reversed_at IS NULL) AS today_stock_pairs,
         (SELECT count(*) FROM production_stage_handovers
          WHERE sent_pairs <> received_pairs AND reversed_at IS NULL) AS handover_mismatches,
         (SELECT coalesce(sum(greatest(
           coalesce(earned.amount, 0) - coalesce(paid.amount, 0), 0
         )), 0)
          FROM people
          LEFT JOIN earned USING (employee_id)
          LEFT JOIN paid USING (employee_id)) AS worker_balance_due`,
    ),
    queryPostgres<{ current_stage: ProductionWorkOrder["currentStage"]; count: number | string }>(
      "production stage pending summary",
      `SELECT current_stage, count(*) AS count
       FROM production_work_orders
       WHERE status NOT IN ('Completed', 'Cancelled')
       GROUP BY current_stage`,
    ),
  ]);
  const row = rows[0];
  const count = (value: number | string | undefined) => Number(value ?? 0);
  return {
    activeWorkOrders: count(row?.active_work_orders),
    overdueWorkOrders: count(row?.overdue_work_orders),
    readyForQc: count(row?.ready_for_qc),
    todayGoodPairs: count(row?.today_good_pairs),
    todayRejectedPairs: count(row?.today_rejected_pairs),
    todayEarnedWage: numeric(row?.today_earned_wage ?? 0),
    activeWorkerCount: count(row?.active_worker_count),
    todayStockPairs: count(row?.today_stock_pairs),
    handoverMismatches: count(row?.handover_mismatches),
    workerBalanceDue: numeric(row?.worker_balance_due ?? 0),
    stagePending: Object.fromEntries(stages.map((stage) => [stage.current_stage, count(stage.count)])),
  };
}

export async function getProductionAcceptanceAudit() {
  const rows = await queryPostgres<{
    orphan_work_entries: number | string;
    completed_without_qc: number | string;
    qc_without_stock_movement: number | string;
    active_order_item_mismatch: number | string;
    duplicate_submission_keys: number | string;
    items_missing_rates: number | string;
    items_missing_bom: number | string;
    items_missing_catalog: number | string;
  }>(
    "production acceptance audit",
    `SELECT
       (SELECT count(*) FROM production_work_entries entries
        LEFT JOIN factory_workers workers ON workers.id = entries.employee_id
        WHERE workers.id IS NULL) AS orphan_work_entries,
       (SELECT count(*) FROM production_work_orders orders
        WHERE orders.status = 'Completed'
          AND NOT EXISTS (
            SELECT 1 FROM production_qc_postings qc
            WHERE qc.work_order_id = orders.id AND qc.reversed_at IS NULL
          )) AS completed_without_qc,
       (SELECT count(*) FROM production_qc_postings qc
        LEFT JOIN stock_movements movements ON movements.id = qc.stock_movement_id
        WHERE qc.reversed_at IS NULL AND movements.id IS NULL) AS qc_without_stock_movement,
       (SELECT count(*) FROM production_work_orders orders
        LEFT JOIN production_items items ON items.id = orders.item_id
        WHERE orders.status NOT IN ('Completed', 'Cancelled')
          AND (items.id IS NULL OR items.status <> 'Active')) AS active_order_item_mismatch,
       (SELECT count(*) FROM (
          SELECT source_submission_key FROM production_work_entries
          WHERE source_submission_key IS NOT NULL
          GROUP BY source_submission_key HAVING count(*) > 1
        ) duplicates) AS duplicate_submission_keys,
       (SELECT count(*) FROM production_items items
        WHERE items.status = 'Active' AND items.production_type <> 'Resale'
          AND (
            SELECT count(DISTINCT rates.stage) FROM production_stage_rates rates
            WHERE rates.item_id = items.id AND rates.status = 'Active'
              AND rates.effective_from <= CURRENT_DATE
          ) < 4) AS items_missing_rates,
       (SELECT count(*) FROM production_items items
        WHERE items.status = 'Active' AND items.production_type <> 'Resale'
          AND NOT EXISTS (
            SELECT 1 FROM production_item_materials bom WHERE bom.item_id = items.id
          )) AS items_missing_bom,
       (SELECT count(*) FROM production_items items
        WHERE items.status = 'Active' AND items.production_type <> 'Resale'
          AND items.catalog_product_id IS NULL) AS items_missing_catalog`,
  );
  const row = rows[0];
  const count = (value: number | string | undefined) => Number(value ?? 0);
  const integrityIssues =
    count(row?.orphan_work_entries) +
    count(row?.completed_without_qc) +
    count(row?.qc_without_stock_movement) +
    count(row?.active_order_item_mismatch) +
    count(row?.duplicate_submission_keys);
  return {
    integrityIssues,
    orphanWorkEntries: count(row?.orphan_work_entries),
    completedWithoutQc: count(row?.completed_without_qc),
    qcWithoutStockMovement: count(row?.qc_without_stock_movement),
    activeOrderItemMismatch: count(row?.active_order_item_mismatch),
    duplicateSubmissionKeys: count(row?.duplicate_submission_keys),
    itemsMissingRates: count(row?.items_missing_rates),
    itemsMissingBom: count(row?.items_missing_bom),
    itemsMissingCatalog: count(row?.items_missing_catalog),
  };
}

export async function getProductionPeriodSummary(period: {
  start: string;
  end: string;
}): Promise<ProductionPeriodSummary> {
  const [rows, workers] = await Promise.all([
    queryPostgres<{
      good_pairs: number | string;
      rejected_pairs: number | string;
      earned_wage: number | string;
      cash_paid: number | string;
      stock_posted_pairs: number | string;
      completed_work_orders: number | string;
    }>(
      "production period report",
      `SELECT
         (SELECT coalesce(sum(total_pairs - rejected_pairs), 0)
          FROM production_work_entries
          WHERE status = 'Approved'
            AND work_date >= $1::date AND work_date < $2::date) AS good_pairs,
         (SELECT coalesce(sum(rejected_pairs), 0)
          FROM production_work_entries
          WHERE status = 'Approved'
            AND work_date >= $1::date AND work_date < $2::date) AS rejected_pairs,
         (SELECT coalesce(sum(earned_wage), 0)
          FROM production_work_entries
          WHERE status = 'Approved'
            AND work_date >= $1::date AND work_date < $2::date) AS earned_wage,
         (SELECT coalesce(sum(CASE
            WHEN direction = 'Paid' THEN amount
            WHEN direction = 'Recovered' THEN -amount
            WHEN direction = 'Added' THEN -amount ELSE 0 END), 0)
          FROM worker_payments
          WHERE reversed_at IS NULL
            AND payment_date >= $1::date AND payment_date < $2::date) AS cash_paid,
         (SELECT coalesce(sum(total_pairs), 0)
          FROM production_qc_postings
          WHERE reversed_at IS NULL
            AND qc_date >= $1::date AND qc_date < $2::date) AS stock_posted_pairs,
         (SELECT count(*)
          FROM production_work_orders
          WHERE status = 'Completed'
            AND updated_at >= $1::date AND updated_at < $2::date) AS completed_work_orders`,
      [period.start, period.end],
    ),
    queryPostgres<{
      employee_name: string;
      good_pairs: number | string;
    }>(
      "production period top worker",
      `SELECT max(employee_name_snapshot) AS employee_name,
         sum(total_pairs - rejected_pairs) AS good_pairs
       FROM production_work_entries
       WHERE status = 'Approved'
         AND work_date >= $1::date AND work_date < $2::date
       GROUP BY employee_id
       ORDER BY good_pairs DESC, employee_name
       LIMIT 1`,
      [period.start, period.end],
    ),
  ]);
  const row = rows[0];
  return {
    goodPairs: Number(row?.good_pairs ?? 0),
    rejectedPairs: Number(row?.rejected_pairs ?? 0),
    earnedWage: numeric(row?.earned_wage ?? 0),
    cashPaid: numeric(row?.cash_paid ?? 0),
    stockPostedPairs: Number(row?.stock_posted_pairs ?? 0),
    completedWorkOrders: Number(row?.completed_work_orders ?? 0),
    topWorker: workers[0]
      ? { name: workers[0].employee_name, goodPairs: Number(workers[0].good_pairs) }
      : null,
  };
}

export async function getWeeklyWorkerSettlements(period: { start: string; end: string }) {
  const rows = await queryPostgres<WeeklySettlementRow>(
    "weekly worker settlement center",
    `SELECT employees.id AS employee_id, employees.name AS employee_name,
       coalesce((
         SELECT sum(entries.earned_wage)
         FROM production_work_entries entries
         WHERE entries.employee_id = employees.id AND entries.status = 'Approved'
           AND entries.work_date < $1::date
       ), 0) - coalesce((
         SELECT sum(CASE
           WHEN payments.direction IN ('Paid', 'Recovered') THEN payments.amount
           WHEN payments.direction = 'Added' THEN -payments.amount ELSE 0 END)
         FROM worker_payments payments
         WHERE payments.employee_id = employees.id AND payments.reversed_at IS NULL
           AND payments.payment_date < $1::date
       ), 0) AS opening_balance,
       coalesce((
         SELECT sum(entries.total_pairs)
         FROM production_work_entries entries
         WHERE entries.employee_id = employees.id AND entries.status = 'Approved'
           AND entries.work_date BETWEEN $1::date AND $2::date
       ), 0) AS completed_pairs,
       coalesce((
         SELECT sum(entries.rejected_pairs)
         FROM production_work_entries entries
         WHERE entries.employee_id = employees.id AND entries.status = 'Approved'
           AND entries.work_date BETWEEN $1::date AND $2::date
       ), 0) AS rejected_pairs,
       coalesce((
         SELECT sum(entries.earned_wage)
         FROM production_work_entries entries
         WHERE entries.employee_id = employees.id AND entries.status = 'Approved'
           AND entries.work_date BETWEEN $1::date AND $2::date
       ), 0) AS earned,
       coalesce((
         SELECT sum(CASE
           WHEN payments.direction IN ('Paid', 'Recovered') THEN payments.amount
           WHEN payments.direction = 'Added' THEN -payments.amount ELSE 0 END)
         FROM worker_payments payments
         WHERE payments.employee_id = employees.id AND payments.reversed_at IS NULL
           AND payments.payment_date BETWEEN $1::date AND $2::date
       ), 0) AS paid
     FROM factory_workers employees
     WHERE employees.status = 'active'
       AND (
         employees.worker_type = 'piece_rate'
         OR EXISTS (SELECT 1 FROM production_work_entries entry WHERE entry.employee_id = employees.id)
         OR EXISTS (SELECT 1 FROM worker_payments payment WHERE payment.employee_id = employees.id)
       )
     ORDER BY employees.name`,
    [period.start, period.end],
  );

  return rows.map((row) => {
    const openingBalance = numeric(row.opening_balance);
    const earned = numeric(row.earned);
    const paid = numeric(row.paid);
    const closingBalance = numeric(openingBalance + earned - paid);
    return {
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      openingBalance,
      completedPairs: Number(row.completed_pairs),
      rejectedPairs: Number(row.rejected_pairs),
      earned,
      paid,
      closingBalance,
      payable: Math.max(0, closingBalance),
      advanceBalance: Math.max(0, -closingBalance),
    };
  });
}

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function idFromSubmissionKey(prefix: string, sourceSubmissionKey: string) {
  const digest = createHash("sha256").update(sourceSubmissionKey).digest("hex").slice(0, 24).toUpperCase();
  return `${prefix}-SUB-${digest}`;
}

export async function getProductionAccountingSnapshot() {
  const [
    items, rates, workerRates, workOrders, handovers, workEntries, payments, qcPostings, balances,
    materials, itemMaterials, costCards, workers, products,
  ] = await Promise.all([
    queryPostgres<ItemRow>(
      "production items",
      `SELECT id, name, category, production_type, size_group, catalog_product_id, status
       FROM production_items ORDER BY status, name`,
    ),
    queryPostgres<RateRow>(
      "production stage rates",
      `SELECT DISTINCT ON (item_id, stage)
         id, item_id, stage, rate_per_pair, effective_from
       FROM production_stage_rates
       WHERE status = 'Active' AND effective_from <= CURRENT_DATE
       ORDER BY item_id, stage, effective_from DESC, created_at DESC`,
    ),
    queryPostgres<WorkerRateRow>(
      "production worker stage rates",
      `SELECT DISTINCT ON (employee_id, item_id, stage)
         id, employee_id, employee_name_snapshot, item_id, stage,
         rate_per_pair, effective_from, note
       FROM production_worker_stage_rates
       WHERE status = 'Active' AND effective_from <= CURRENT_DATE
       ORDER BY employee_id, item_id, stage, effective_from DESC, created_at DESC`,
    ),
    queryPostgres<WorkOrderRow>(
      "production work orders",
      `SELECT id, work_order_number, item_id, item_name_snapshot, colour,
         size_breakdown, planned_pairs, due_date, priority, current_stage,
         status, created_by
       FROM production_work_orders
       ORDER BY CASE status WHEN 'In Progress' THEN 0 WHEN 'Planning' THEN 1
         WHEN 'Ready for QC' THEN 2 ELSE 3 END, due_date NULLS LAST, created_at DESC
       LIMIT 50`,
    ),
    queryPostgres<HandoverRow>(
      "production stage handovers",
      `SELECT id, handover_date, work_order_id, work_order_number_snapshot,
         from_stage, to_stage, from_employee_name_snapshot,
         to_employee_name_snapshot, sent_pairs, received_pairs, received_size_breakdown
       FROM production_stage_handovers
       WHERE reversed_at IS NULL
       ORDER BY handover_date DESC, created_at DESC LIMIT 50`,
    ),
    queryPostgres<WorkRow>(
      "production work entries",
      `SELECT id, work_date, employee_id, employee_name_snapshot, work_order_id,
         item_name_snapshot, stage, total_pairs, size_breakdown, rejected_pairs,
         rate_per_pair_snapshot, earned_wage, status
       FROM production_work_entries
       ORDER BY work_date DESC, created_at DESC LIMIT 30`,
    ),
    queryPostgres<PaymentRow>(
      "recent worker payments",
      `SELECT id, payment_date, employee_id, employee_name_snapshot,
         payment_type, direction, amount, receipt_number, approved_by, note
       FROM worker_payments
       WHERE reversed_at IS NULL
       ORDER BY payment_date DESC, created_at DESC LIMIT 30`,
    ),
    queryPostgres<QcPostingRow>(
      "recent production QC stock postings",
      `SELECT id, qc_date, approval_reference, work_order_id, item_name_snapshot,
         catalog_product_name_snapshot, packing_employee_name_snapshot,
         total_pairs, rejected_pairs, size_breakdown, stock_movement_id, approved_by
       FROM production_qc_postings
       WHERE reversed_at IS NULL
       ORDER BY qc_date DESC, created_at DESC LIMIT 30`,
    ),
    queryPostgres<BalanceRow>(
      "worker balances",
      `WITH earned AS (
         SELECT employee_id, max(employee_name_snapshot) AS employee_name,
           coalesce(sum(earned_wage), 0) AS amount
         FROM production_work_entries WHERE status = 'Approved' GROUP BY employee_id
       ), paid AS (
         SELECT employee_id, max(employee_name_snapshot) AS employee_name,
           coalesce(sum(CASE
             WHEN direction IN ('Paid', 'Recovered') THEN amount
             WHEN direction = 'Added' THEN -amount ELSE 0 END), 0) AS amount
         FROM worker_payments WHERE reversed_at IS NULL GROUP BY employee_id
       ), people AS (
         SELECT employee_id FROM earned UNION SELECT employee_id FROM paid
       )
       SELECT people.employee_id,
         coalesce(earned.employee_name, paid.employee_name, '') AS employee_name,
         coalesce(earned.amount, 0) AS earned,
         coalesce(paid.amount, 0) AS paid,
         coalesce(earned.amount, 0) - coalesce(paid.amount, 0) AS balance
       FROM people
       LEFT JOIN earned USING (employee_id)
       LEFT JOIN paid USING (employee_id)
       ORDER BY employee_name`,
    ),
    queryPostgres<ProductionMaterialRow>(
      "production costing materials",
      `SELECT materials.id, materials.name, materials.unit,
         coalesce(sum(lines.line_total) / nullif(sum(lines.quantity), 0), 0) AS average_unit_cost
       FROM raw_materials materials
       LEFT JOIN purchase_invoice_items lines
         ON lines.material_id = materials.id AND lines.kind = 'Raw Material'
       GROUP BY materials.id, materials.name, materials.unit
       ORDER BY materials.name`,
    ),
    queryPostgres<ItemMaterialRow>(
      "production item materials",
      `SELECT bom.id, bom.item_id, bom.material_id, bom.material_name_snapshot,
         bom.unit_snapshot, bom.quantity_per_pair, bom.wastage_percent,
         coalesce(sum(lines.line_total) / nullif(sum(lines.quantity), 0), 0) AS average_unit_cost
       FROM production_item_materials bom
       LEFT JOIN purchase_invoice_items lines
         ON lines.material_id = bom.material_id AND lines.kind = 'Raw Material'
       GROUP BY bom.id, bom.item_id, bom.material_id, bom.material_name_snapshot,
         bom.unit_snapshot, bom.quantity_per_pair, bom.wastage_percent
       ORDER BY bom.item_id, bom.material_name_snapshot`,
    ),
    queryPostgres<CostCardRow>(
      "production cost cards",
      `SELECT DISTINCT ON (item_id)
         id, effective_from, item_id, item_name_snapshot,
         material_cost_per_pair, labor_cost_per_pair, other_direct_cost_per_pair,
         making_cost_per_pair, wholesale_profit_percent, wholesale_price,
         retail_extra_amount, retail_price, approved_by
       FROM production_cost_cards
       WHERE effective_from <= CURRENT_DATE
       ORDER BY item_id, effective_from DESC, created_at DESC`,
    ),
    listProductionWorkers(),
    getProducts({ includeDrafts: true }),
  ]);

  return {
    items: items.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      productionType: row.production_type,
      sizeGroup: row.size_group,
      catalogProductId: row.catalog_product_id ?? "",
      status: row.status,
    })),
    rates: rates.map((row) => ({
      id: row.id,
      itemId: row.item_id,
      stage: row.stage,
      ratePerPair: numeric(row.rate_per_pair),
      effectiveFrom: isoDate(row.effective_from),
    })),
    workerRates: workerRates.map((row) => ({
      id: row.id,
      employeeId: row.employee_id,
      employeeName: row.employee_name_snapshot,
      itemId: row.item_id,
      stage: row.stage,
      ratePerPair: numeric(row.rate_per_pair),
      effectiveFrom: isoDate(row.effective_from),
      note: row.note,
    })),
    workOrders: workOrders.map(workOrderFromRow),
    handovers: handovers.map((row) => {
      const result = handoverSignal(Number(row.sent_pairs), Number(row.received_pairs));
      return {
        id: row.id,
        handoverDate: isoDate(row.handover_date),
        workOrderId: row.work_order_id,
        workOrderNumber: row.work_order_number_snapshot,
        fromStage: row.from_stage,
        toStage: row.to_stage,
        fromEmployeeName: row.from_employee_name_snapshot,
        toEmployeeName: row.to_employee_name_snapshot,
        sentPairs: Number(row.sent_pairs),
        receivedPairs: Number(row.received_pairs),
        receivedSizeBreakdown: jsonSizes(row.received_size_breakdown),
        ...result,
      };
    }),
    workEntries: workEntries.map((row) => ({
      id: row.id,
      workDate: isoDate(row.work_date),
      employeeId: row.employee_id,
      employeeName: row.employee_name_snapshot,
      workOrderId: row.work_order_id ?? "",
      itemName: row.item_name_snapshot,
      stage: row.stage,
      totalPairs: Number(row.total_pairs),
      sizeBreakdown: jsonSizes(row.size_breakdown),
      rejectedPairs: Number(row.rejected_pairs),
      ratePerPair: numeric(row.rate_per_pair_snapshot),
      earnedWage: numeric(row.earned_wage),
      status: row.status,
    })),
    payments: payments.map(paymentFromRow),
    qcPostings: qcPostings.map((row) => ({
      id: row.id,
      qcDate: isoDate(row.qc_date),
      approvalReference: row.approval_reference,
      workOrderId: row.work_order_id ?? "",
      itemName: row.item_name_snapshot,
      catalogProductName: row.catalog_product_name_snapshot,
      packingEmployeeName: row.packing_employee_name_snapshot,
      totalPairs: Number(row.total_pairs),
      rejectedPairs: Number(row.rejected_pairs),
      sizeBreakdown: jsonSizes(row.size_breakdown),
      stockMovementId: row.stock_movement_id,
      approvedBy: row.approved_by,
    })),
    balances: balances.map((row) => ({
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      earned: numeric(row.earned),
      paid: numeric(row.paid),
      balance: numeric(row.balance),
    })),
    materials: materials.map((row) => ({
      id: row.id,
      name: row.name,
      unit: row.unit,
      averageUnitCost: numeric(row.average_unit_cost),
    })),
    itemMaterials: itemMaterials.map((row) => {
      const quantity = numeric(row.quantity_per_pair);
      const wastage = numeric(row.wastage_percent);
      const rate = numeric(row.average_unit_cost);
      return {
        id: row.id,
        itemId: row.item_id,
        materialId: row.material_id,
        materialName: row.material_name_snapshot,
        unit: row.unit_snapshot,
        quantityPerPair: quantity,
        wastagePercent: wastage,
        averageUnitCost: rate,
        costPerPair: numeric(quantity * (1 + wastage / 100) * rate),
      };
    }),
    costCards: costCards.map(costCardFromRow),
    employees: workers.filter((worker) => worker.status === "Active"),
    products,
  };
}

export async function getProductionFactoryEntrySnapshot() {
  const [items, workOrders, workers] = await Promise.all([
    queryPostgres<ItemRow>(
      "factory entry production items",
      `SELECT id, name, category, production_type, size_group, catalog_product_id, status
       FROM production_items
       WHERE status = 'Active' AND production_type <> 'Resale'
       ORDER BY name`,
    ),
    queryPostgres<WorkOrderRow>(
      "factory entry work orders",
      `SELECT id, work_order_number, item_id, item_name_snapshot, colour,
         size_breakdown, planned_pairs, due_date, priority, current_stage,
         status, created_by
       FROM production_work_orders
       WHERE status NOT IN ('Completed', 'Cancelled')
       ORDER BY due_date NULLS LAST, created_at DESC
       LIMIT 100`,
    ),
    listProductionWorkers(),
  ]);
  return {
    items: items.map((row) => ({
      id: row.id,
      name: row.name,
      sizeGroup: row.size_group,
    })),
    workOrders: workOrders.map(workOrderFromRow),
    employees: workers
      .filter((worker) => worker.status === "Active")
      .map((worker) => ({ id: worker.id, name: worker.name, department: worker.department })),
  };
}

function costCardFromRow(row: CostCardRow): ProductionCostCard {
  return {
    id: row.id,
    effectiveFrom: isoDate(row.effective_from),
    itemId: row.item_id,
    itemName: row.item_name_snapshot,
    materialCostPerPair: numeric(row.material_cost_per_pair),
    laborCostPerPair: numeric(row.labor_cost_per_pair),
    otherDirectCostPerPair: numeric(row.other_direct_cost_per_pair),
    makingCostPerPair: numeric(row.making_cost_per_pair),
    wholesaleProfitPercent: numeric(row.wholesale_profit_percent),
    wholesalePrice: numeric(row.wholesale_price),
    retailExtraAmount: numeric(row.retail_extra_amount),
    retailPrice: numeric(row.retail_price),
    approvedBy: row.approved_by,
  };
}

function paymentFromRow(row: PaymentRow): WorkerPayment {
  return {
    id: row.id,
    paymentDate: isoDate(row.payment_date),
    employeeId: row.employee_id,
    employeeName: row.employee_name_snapshot,
    paymentType: row.payment_type,
    direction: row.direction,
    amount: numeric(row.amount),
    receiptNumber: row.receipt_number,
    approvedBy: row.approved_by,
    note: row.note,
  };
}

function jsonSizes(value: SizeBreakdown | string) {
  if (typeof value !== "string") return normalizeSizeBreakdown(value ?? {});
  try {
    return normalizeSizeBreakdown(JSON.parse(value));
  } catch {
    return {};
  }
}

function assertCumulativeSizePlan(
  planned: SizeBreakdown,
  existing: SizeBreakdown[],
  incoming: SizeBreakdown,
  label: string,
) {
  if (Object.keys(planned).length === 0) return;
  const normalizedIncoming = normalizeSizeBreakdown(incoming);
  if (Object.keys(normalizedIncoming).length === 0) {
    throw new Error(`${label} size-wise quantity is required for this Work Order.`);
  }
  for (const [size, pairs] of Object.entries(normalizedIncoming)) {
    if (!planned[size]) throw new Error(`Size ${size} is not in this Work Order plan.`);
    const previous = existing.reduce((total, row) => total + (row[size] ?? 0), 0);
    if (previous + pairs > planned[size]) {
      throw new Error(`Size ${size} exceeds planned ${planned[size]} pairs.`);
    }
  }
}

function workOrderFromRow(row: WorkOrderRow): ProductionWorkOrder {
  return {
    id: row.id,
    workOrderNumber: row.work_order_number,
    itemId: row.item_id,
    itemName: row.item_name_snapshot,
    colour: row.colour,
    sizeBreakdown: jsonSizes(row.size_breakdown),
    plannedPairs: Number(row.planned_pairs),
    dueDate: row.due_date ? isoDate(row.due_date) : "",
    priority: row.priority,
    currentStage: row.current_stage,
    status: row.status,
    createdBy: row.created_by,
  };
}

function workFromRow(row: WorkRow): WorkEntry {
  return {
    id: row.id,
    workDate: isoDate(row.work_date),
    employeeId: row.employee_id,
    employeeName: row.employee_name_snapshot,
    workOrderId: row.work_order_id ?? "",
    itemName: row.item_name_snapshot,
    stage: row.stage,
    totalPairs: Number(row.total_pairs),
    sizeBreakdown: jsonSizes(row.size_breakdown),
    rejectedPairs: Number(row.rejected_pairs),
    ratePerPair: numeric(row.rate_per_pair_snapshot),
    earnedWage: numeric(row.earned_wage),
    status: row.status,
  };
}

export async function getWorkerProductionAccount(
  employeeId: string,
  period: { start: string; end: string },
) {
  const workers = await listProductionWorkers();
  const employee = workers.find((row) => row.id === employeeId);
  if (!employee) return null;

  const [allWork, allPayments, periodWork, periodPayments, totalsRows] = await Promise.all([
    queryPostgres<WorkRow>(
      "worker work ledger",
      `SELECT id, work_date, employee_id, employee_name_snapshot, work_order_id,
         item_name_snapshot, stage, total_pairs, size_breakdown, rejected_pairs,
         rate_per_pair_snapshot, earned_wage, status
       FROM production_work_entries
       WHERE employee_id = $1 ORDER BY work_date DESC, created_at DESC LIMIT 100`,
      [employeeId],
    ),
    queryPostgres<PaymentRow>(
      "worker payment ledger",
      `SELECT id, payment_date, employee_id, employee_name_snapshot,
         payment_type, direction, amount, receipt_number, approved_by, note
       FROM worker_payments
       WHERE employee_id = $1 AND reversed_at IS NULL
       ORDER BY payment_date DESC, created_at DESC LIMIT 100`,
      [employeeId],
    ),
    queryPostgres<WorkRow>(
      "worker Friday work statement",
      `SELECT id, work_date, employee_id, employee_name_snapshot, work_order_id,
         item_name_snapshot, stage, total_pairs, size_breakdown, rejected_pairs,
         rate_per_pair_snapshot, earned_wage, status
       FROM production_work_entries
       WHERE employee_id = $1 AND status = 'Approved'
         AND work_date BETWEEN $2::date AND $3::date
       ORDER BY work_date, created_at
       LIMIT 500
     `,
      [employeeId, period.start, period.end],
    ),
    queryPostgres<PaymentRow>(
      "worker Friday payment statement",
      `SELECT id, payment_date, employee_id, employee_name_snapshot,
         payment_type, direction, amount, receipt_number, approved_by, note
       FROM worker_payments
       WHERE employee_id = $1 AND reversed_at IS NULL
         AND payment_date BETWEEN $2::date AND $3::date
       ORDER BY payment_date, created_at
       LIMIT 500
     `,
      [employeeId, period.start, period.end],
    ),
    queryPostgres<WorkerAccountTotalsRow>(
      "worker account totals",
      `SELECT
         (SELECT coalesce(sum(earned_wage), 0)
          FROM production_work_entries
          WHERE employee_id = $1 AND status = 'Approved') AS total_earned,
         (SELECT coalesce(sum(CASE
            WHEN direction IN ('Paid', 'Recovered') THEN amount
            WHEN direction = 'Added' THEN -amount ELSE 0 END), 0)
          FROM worker_payments
          WHERE employee_id = $1 AND reversed_at IS NULL) AS total_paid,
         (SELECT coalesce(sum(earned_wage), 0)
          FROM production_work_entries
          WHERE employee_id = $1 AND status = 'Approved'
            AND work_date < $2::date) AS opening_earned,
         (SELECT coalesce(sum(CASE
            WHEN direction IN ('Paid', 'Recovered') THEN amount
            WHEN direction = 'Added' THEN -amount ELSE 0 END), 0)
          FROM worker_payments
          WHERE employee_id = $1 AND reversed_at IS NULL
            AND payment_date < $2::date) AS opening_paid`,
      [employeeId, period.start],
    ),
  ]);

  const work = allWork.map(workFromRow);
  const payments = allPayments.map(paymentFromRow);
  const weekWork = periodWork.map(workFromRow);
  const weekPayments = periodPayments.map(paymentFromRow);
  const totals = totalsRows[0];
  const totalEarned = numeric(totals?.total_earned ?? 0);
  const totalPaid = numeric(totals?.total_paid ?? 0);
  const openingBalance = numeric(
    numeric(totals?.opening_earned ?? 0) - numeric(totals?.opening_paid ?? 0),
  );
  const periodEarned = numeric(weekWork.reduce((total, row) => total + row.earnedWage, 0));
  const periodPaid = numeric(
    weekPayments.reduce(
      (total, row) => total + (row.direction === "Added" ? -row.amount : row.amount),
      0,
    ),
  );
  const closingBalance = numeric(openingBalance + periodEarned - periodPaid);

  return {
    employee,
    work,
    payments,
    period,
    statement: {
      pairs: weekWork.reduce((total, row) => total + row.totalPairs, 0),
      rejectedPairs: weekWork.reduce((total, row) => total + row.rejectedPairs, 0),
      openingBalance,
      earned: periodEarned,
      paid: periodPaid,
      closingBalance,
      payable: Math.max(0, closingBalance),
      advanceBalance: Math.max(0, -closingBalance),
      work: weekWork,
      payments: weekPayments,
    },
    lifetime: {
      earned: numeric(totalEarned),
      paid: numeric(totalPaid),
      balance: numeric(totalEarned - totalPaid),
    },
  };
}

export async function getProductionWorkOrderDetail(workOrderId: string) {
  const orderRows = await queryPostgres<WorkOrderRow>(
    "production Work Order detail",
    `SELECT id, work_order_number, item_id, item_name_snapshot, colour,
       size_breakdown, planned_pairs, due_date, priority, current_stage,
       status, created_by
     FROM production_work_orders WHERE id = $1 LIMIT 1`,
    [workOrderId],
  );
  if (!orderRows[0]) return null;

  const [workRows, handoverRows, qcRows, materialRows, consumptionRows, cctvRows] = await Promise.all([
    queryPostgres<WorkRow>(
      "Work Order production entries",
      `SELECT id, work_date, employee_id, employee_name_snapshot, work_order_id,
         item_name_snapshot, stage, total_pairs, size_breakdown, rejected_pairs,
         rate_per_pair_snapshot, earned_wage, status
       FROM production_work_entries
       WHERE work_order_id = $1 ORDER BY work_date, created_at
       LIMIT 500
     `,
      [workOrderId],
    ),
    queryPostgres<HandoverRow>(
      "Work Order handovers",
      `SELECT id, handover_date, work_order_id, work_order_number_snapshot,
         from_stage, to_stage, from_employee_name_snapshot,
         to_employee_name_snapshot, sent_pairs, received_pairs, received_size_breakdown
       FROM production_stage_handovers
       WHERE work_order_id = $1 AND reversed_at IS NULL ORDER BY handover_date, created_at
       LIMIT 500
     `,
      [workOrderId],
    ),
    queryPostgres<QcPostingRow>(
      "Work Order QC postings",
      `SELECT id, qc_date, approval_reference, work_order_id, item_name_snapshot,
         catalog_product_name_snapshot, packing_employee_name_snapshot,
         total_pairs, rejected_pairs, size_breakdown, stock_movement_id, approved_by
       FROM production_qc_postings
       WHERE work_order_id = $1 AND reversed_at IS NULL ORDER BY qc_date, created_at
       LIMIT 500
     `,
      [workOrderId],
    ),
    queryPostgres<WorkOrderMaterialPlanRow>(
      "Work Order material plan",
      `SELECT bom.material_id, bom.material_name_snapshot AS material_name,
         bom.unit_snapshot AS unit, bom.quantity_per_pair, bom.wastage_percent,
         materials.opening_stock, materials.received, materials.used,
         coalesce(rates.average_unit_cost, 0) AS average_unit_cost
       FROM production_item_materials bom
       JOIN raw_materials materials ON materials.id = bom.material_id
       LEFT JOIN (
         SELECT material_id, sum(line_total) / nullif(sum(quantity), 0) AS average_unit_cost
         FROM purchase_invoice_items
         WHERE kind = 'Raw Material'
         GROUP BY material_id
       ) rates ON rates.material_id = bom.material_id
       WHERE bom.item_id = $1
       ORDER BY bom.material_name_snapshot`,
      [orderRows[0].item_id],
    ),
    queryPostgres<ProductionMaterialConsumptionRow>(
      "Work Order material consumption",
      `SELECT id, consumption_date, work_order_id, work_order_number_snapshot,
         material_id, material_name_snapshot, unit_snapshot, quantity, wastage,
         approved_by, note
       FROM production_material_consumptions
       WHERE work_order_id = $1 AND reversed_at IS NULL
       ORDER BY consumption_date DESC, created_at DESC`,
      [workOrderId],
    ),
    queryPostgres<{
      id: string;
      stage: ProductionCctvReference["stage"];
      camera_zone: string;
      window_start: Date | string;
      window_end: Date | string;
      cctv_reference: string;
      evidence_reference: string;
      recorded_by: string;
      note: string;
    }>(
      "Work Order CCTV references",
      `SELECT id, stage, camera_zone, window_start, window_end,
         cctv_reference, evidence_reference, recorded_by, note
       FROM production_cctv_references
       WHERE work_order_id = $1
       ORDER BY window_start DESC, created_at DESC`,
      [workOrderId],
    ),
  ]);

  const work = workRows.map(workFromRow);
  const handovers = handoverRows.map((row) => ({
    id: row.id,
    handoverDate: isoDate(row.handover_date),
    workOrderId: row.work_order_id,
    workOrderNumber: row.work_order_number_snapshot,
    fromStage: row.from_stage,
    toStage: row.to_stage,
    fromEmployeeName: row.from_employee_name_snapshot,
    toEmployeeName: row.to_employee_name_snapshot,
    sentPairs: Number(row.sent_pairs),
    receivedPairs: Number(row.received_pairs),
    receivedSizeBreakdown: jsonSizes(row.received_size_breakdown),
    ...handoverSignal(Number(row.sent_pairs), Number(row.received_pairs)),
  }));
  const qcPostings: QcStockPosting[] = qcRows.map((row) => ({
    id: row.id,
    qcDate: isoDate(row.qc_date),
    approvalReference: row.approval_reference,
    workOrderId: row.work_order_id ?? "",
    itemName: row.item_name_snapshot,
    catalogProductName: row.catalog_product_name_snapshot,
    packingEmployeeName: row.packing_employee_name_snapshot,
    totalPairs: Number(row.total_pairs),
    rejectedPairs: Number(row.rejected_pairs),
    sizeBreakdown: jsonSizes(row.size_breakdown),
    stockMovementId: row.stock_movement_id,
    approvedBy: row.approved_by,
  }));
  const order = workOrderFromRow(orderRows[0]);
  const materialConsumptions = consumptionRows.map((row) => ({
    id: row.id,
    consumptionDate: isoDate(row.consumption_date),
    workOrderId: row.work_order_id,
    workOrderNumber: row.work_order_number_snapshot,
    materialId: row.material_id,
    materialName: row.material_name_snapshot,
    unit: row.unit_snapshot,
    quantity: numeric(row.quantity),
    wastage: numeric(row.wastage),
    total: numeric(Number(row.quantity) + Number(row.wastage)),
    approvedBy: row.approved_by,
    note: row.note,
  }));
  const materialPlan = materialRows.map((row) => {
    const quantityPerPair = numeric(row.quantity_per_pair);
    const wastagePercent = numeric(row.wastage_percent);
    const requiredQuantity = numeric(
      order.plannedPairs * quantityPerPair * (1 + wastagePercent / 100),
    );
    const availableQuantity = numeric(
      Number(row.opening_stock) + Number(row.received) - Number(row.used),
    );
    const shortageQuantity = numeric(Math.max(0, requiredQuantity - availableQuantity));
    const averageUnitCost = numeric(row.average_unit_cost);
    const actualConsumed = numeric(
      materialConsumptions
        .filter((entry) => entry.materialId === row.material_id)
        .reduce((total, entry) => total + entry.total, 0),
    );
    return {
      materialId: row.material_id,
      materialName: row.material_name,
      unit: row.unit,
      quantityPerPair,
      wastagePercent,
      requiredQuantity,
      availableQuantity,
      shortageQuantity,
      actualConsumed,
      plannedRemaining: numeric(Math.max(0, requiredQuantity - actualConsumed)),
      consumptionVariance: numeric(actualConsumed - requiredQuantity),
      averageUnitCost,
      estimatedCost: numeric(requiredQuantity * averageUnitCost),
      signal: shortageQuantity > 0 ? "Shortage" as const : "Ready" as const,
    };
  });

  return {
    order,
    materialPlan,
    materialConsumptions,
    cctvReferences: cctvRows.map((row) => ({
      id: row.id,
      stage: row.stage,
      cameraZone: row.camera_zone,
      windowStart: new Date(row.window_start).toISOString(),
      windowEnd: new Date(row.window_end).toISOString(),
      cctvReference: row.cctv_reference,
      evidenceReference: row.evidence_reference,
      recordedBy: row.recorded_by,
      note: row.note,
    })),
    materialSummary: {
      materialCount: materialPlan.length,
      shortageCount: materialPlan.filter((row) => row.signal === "Shortage").length,
      estimatedCost: numeric(materialPlan.reduce((total, row) => total + row.estimatedCost, 0)),
    },
    work,
    handovers,
    qcPostings,
    stageProgress: productionStages.map((stage) => {
      const rows = work.filter((entry) => entry.stage === stage && entry.status === "Approved");
      const goodPairs = rows.reduce(
        (total, entry) => total + entry.totalPairs - entry.rejectedPairs,
        0,
      );
      return {
        stage,
        goodPairs,
        rejectedPairs: rows.reduce((total, entry) => total + entry.rejectedPairs, 0),
        wage: numeric(rows.reduce((total, entry) => total + entry.earnedWage, 0)),
        complete: goodPairs >= order.plannedPairs,
        sizeProgress: Object.fromEntries(
          Object.keys(order.sizeBreakdown).map((size) => [
            size,
            rows.reduce((total, entry) => total + (entry.sizeBreakdown[size] ?? 0), 0),
          ]),
        ),
      };
    }),
    qcSummary: {
      goodPairs: qcPostings.reduce((total, row) => total + row.totalPairs, 0),
      rejectedPairs: qcPostings.reduce((total, row) => total + row.rejectedPairs, 0),
    },
  };
}

export async function addProductionCctvReference(input: {
  workOrderId: string;
  stage: ProductionStage | "Packing / QC";
  cameraZone: string;
  windowStart: string;
  windowEnd: string;
  cctvReference: string;
  evidenceReference: string;
  recordedBy: string;
  note: string;
}) {
  if (!input.cameraZone.trim()) throw new Error("Camera zone is required.");
  if (!input.windowStart || !input.windowEnd) throw new Error("Camera start and end time are required.");
  if (new Date(input.windowEnd).getTime() < new Date(input.windowStart).getTime()) {
    throw new Error("Camera end time cannot be before start time.");
  }
  const rows = await queryPostgres<{ id: string; work_order_number: string }>(
    "add production CCTV reference",
    `INSERT INTO production_cctv_references (
       id, work_order_id, work_order_number_snapshot, stage, camera_zone,
       window_start, window_end, cctv_reference, evidence_reference, recorded_by, note
     )
     SELECT $1, orders.id, orders.work_order_number, $3, $4,
       $5::timestamptz, $6::timestamptz, $7, $8, $9, $10
     FROM production_work_orders orders
     WHERE orders.id = $2
     RETURNING id, work_order_number_snapshot AS work_order_number`,
    [
      id("cctv"), input.workOrderId, input.stage, input.cameraZone.trim(),
      input.windowStart, input.windowEnd, input.cctvReference.trim(),
      input.evidenceReference.trim(), input.recordedBy, input.note.trim(),
    ],
  );
  if (!rows[0]) throw new Error("Work Order not found.");
  return rows[0];
}

export async function addProductionItem(input: Omit<ProductionItem, "id" | "status">) {
  const rows = await queryPostgres<ItemRow>(
    "create production item",
    `INSERT INTO production_items
       (id, name, category, production_type, size_group, catalog_product_id, status)
     VALUES ($1, $2, $3, $4, $5, nullif($6, ''), 'Active')
     RETURNING id, name, category, production_type, size_group, catalog_product_id, status`,
    [
      id("pitem"), input.name, input.category, input.productionType,
      input.sizeGroup, input.catalogProductId,
    ],
  );
  return rows[0];
}

export async function mapProductionItemToCatalog(itemId: string, catalogProductId: string) {
  const rows = await queryPostgres<{ id: string }>(
    "map production item to catalog",
    `UPDATE production_items
     SET catalog_product_id = nullif($2, ''), updated_at = now()
     WHERE id = $1 RETURNING id`,
    [itemId, catalogProductId],
  );
  if (!rows[0]) throw new Error("Production item not found.");
}

export async function setProductionItemMaterial(input: {
  itemId: string;
  materialId: string;
  quantityPerPair: number;
  wastagePercent: number;
  note: string;
}) {
  const materialRows = await queryPostgres<{ id: string; name: string; unit: string }>(
    "production item material lookup",
    "SELECT id, name, unit FROM raw_materials WHERE id = $1",
    [input.materialId],
  );
  const material = materialRows[0];
  if (!material) throw new Error("Raw material not found.");
  if (input.quantityPerPair <= 0) throw new Error("Material quantity per pair must be greater than zero.");

  await queryPostgres(
    "set production item material",
    `INSERT INTO production_item_materials (
       id, item_id, material_id, material_name_snapshot, unit_snapshot,
       quantity_per_pair, wastage_percent, note
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (item_id, material_id) DO UPDATE SET
       material_name_snapshot = EXCLUDED.material_name_snapshot,
       unit_snapshot = EXCLUDED.unit_snapshot,
       quantity_per_pair = EXCLUDED.quantity_per_pair,
       wastage_percent = EXCLUDED.wastage_percent,
       note = EXCLUDED.note, updated_at = now()`,
    [
      id("bom"), input.itemId, material.id, material.name, material.unit,
      input.quantityPerPair, input.wastagePercent, input.note,
    ],
  );
}

export async function addWorkOrderMaterialConsumption(input: {
  workOrderId: string;
  materialId: string;
  consumptionDate: string;
  quantity: number;
  wastage: number;
  approvedBy: string;
  note: string;
  sourceSubmissionKey?: string;
}) {
  const total = numeric(input.quantity + input.wastage);
  if (total <= 0) throw new Error("Material quantity or wastage must be greater than zero.");
  const sourceSubmissionKey = input.sourceSubmissionKey?.trim().slice(0, 180) ?? "";
  const consumptionId = sourceSubmissionKey ? idFromSubmissionKey("matuse", sourceSubmissionKey) : id("matuse");

  const existingReceipt = (row: ProductionMaterialConsumptionRow) => ({
    id: row.id,
    workOrderNumber: row.work_order_number_snapshot,
    materialName: row.material_name_snapshot,
    unit: row.unit_snapshot,
    total: numeric(Number(row.quantity) + Number(row.wastage)),
  });

  try {
    return await transactionPostgres("approve Work Order material consumption", async (db) => {
      if (sourceSubmissionKey) {
        const existing = await db.query<ProductionMaterialConsumptionRow>(
          `SELECT id, consumption_date, work_order_id, work_order_number_snapshot,
             material_id, material_name_snapshot, unit_snapshot, quantity, wastage,
             approved_by, note
           FROM production_material_consumptions
           WHERE id = $1 AND reversed_at IS NULL
           LIMIT 1`,
          [consumptionId],
        );
        if (existing[0]) {
          return existingReceipt(existing[0]);
        }
      }

      const rows = await db.query<{
        work_order_number: string;
        material_name: string;
        unit: string;
        opening_stock: number | string;
        received: number | string;
        used: number | string;
      }>(
        `SELECT orders.work_order_number, materials.name AS material_name, materials.unit,
           materials.opening_stock, materials.received, materials.used
         FROM production_work_orders orders
         JOIN production_item_materials bom
           ON bom.item_id = orders.item_id AND bom.material_id = $2
         JOIN raw_materials materials ON materials.id = bom.material_id
         WHERE orders.id = $1 AND orders.status <> 'Cancelled'
         FOR UPDATE OF orders, materials`,
        [input.workOrderId, input.materialId],
      );
      const row = rows[0];
      if (!row) throw new Error("Open Work Order material recipe was not found.");
      const available = numeric(Number(row.opening_stock) + Number(row.received) - Number(row.used));
      if (total > available) {
        throw new Error(`${row.material_name} has only ${available} ${row.unit} available.`);
      }

      await db.query(
        `INSERT INTO production_material_consumptions (
           id, consumption_date, work_order_id, work_order_number_snapshot,
           material_id, material_name_snapshot, unit_snapshot, quantity, wastage,
           approved_by, note
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          consumptionId, input.consumptionDate, input.workOrderId, row.work_order_number,
          input.materialId, row.material_name, row.unit, input.quantity, input.wastage,
          input.approvedBy, input.note,
        ],
      );
      await db.query(
        `UPDATE raw_materials SET used = used + $2 WHERE id = $1`,
        [input.materialId, total],
      );
      return {
        id: consumptionId,
        workOrderNumber: row.work_order_number,
        materialName: row.material_name,
        unit: row.unit,
        total,
      };
    });
  } catch (error) {
    const duplicateSubmission =
      sourceSubmissionKey &&
      (error as { code?: string } | null)?.code === "23505";

    if (duplicateSubmission) {
      const existing = await queryPostgres<ProductionMaterialConsumptionRow>(
        "production material consumption by id",
        `SELECT id, consumption_date, work_order_id, work_order_number_snapshot,
           material_id, material_name_snapshot, unit_snapshot, quantity, wastage,
           approved_by, note
         FROM production_material_consumptions
         WHERE id = $1 AND reversed_at IS NULL
         LIMIT 1`,
        [consumptionId],
      );
      if (existing[0]) {
        return existingReceipt(existing[0]);
      }
    }

    throw error;
  }
}

export async function reverseWorkOrderMaterialConsumption(input: {
  consumptionId: string;
  reason: string;
  reversedBy: string;
}) {
  return transactionPostgres("reverse Work Order material consumption", async (db) => {
    const rows = await db.query<ProductionMaterialConsumptionRow>(
      `SELECT id, consumption_date, work_order_id, work_order_number_snapshot,
         material_id, material_name_snapshot, unit_snapshot, quantity, wastage,
         approved_by, note
       FROM production_material_consumptions
       WHERE id = $1 AND reversed_at IS NULL FOR UPDATE`,
      [input.consumptionId],
    );
    const row = rows[0];
    if (!row) throw new Error("Active material consumption was not found or is already reversed.");
    const total = numeric(Number(row.quantity) + Number(row.wastage));
    const materialRows = await db.query<{ used: number | string }>(
      `SELECT used FROM raw_materials WHERE id = $1 FOR UPDATE`,
      [row.material_id],
    );
    if (!materialRows[0] || Number(materialRows[0].used) < total) {
      throw new Error("Raw material used balance is lower than this entry; review stock first.");
    }
    await db.query(
      `UPDATE raw_materials SET used = used - $2 WHERE id = $1`,
      [row.material_id, total],
    );
    await db.query(
      `UPDATE production_material_consumptions
       SET reversed_at = now(), reversal_reason = $2 WHERE id = $1`,
      [row.id, `${input.reason} · Reversed by ${input.reversedBy}`],
    );
    return {
      workOrderId: row.work_order_id,
      workOrderNumber: row.work_order_number_snapshot,
      materialName: row.material_name_snapshot,
      total,
      unit: row.unit_snapshot,
    };
  });
}

export async function createProductionWorkOrder(input: {
  itemId: string;
  colour: string;
  sizeBreakdown: SizeBreakdown;
  plannedPairs: number;
  dueDate: string;
  priority: ProductionWorkOrder["priority"];
  createdBy: string;
  note: string;
}) {
  if (input.plannedPairs <= 0) throw new Error("Planned pairs must be greater than zero.");
  const sizedPairs = Object.values(normalizeSizeBreakdown(input.sizeBreakdown))
    .reduce((total, pairs) => total + pairs, 0);
  if (sizedPairs > 0 && sizedPairs !== input.plannedPairs) {
    throw new Error("Work Order size-wise pairs must match planned pairs.");
  }

  return transactionPostgres("create production work order", async (db) => {
    const itemRows = await db.query<ItemRow>(
      `SELECT id, name, category, production_type, size_group, catalog_product_id, status
       FROM production_items WHERE id = $1 AND status = 'Active' FOR SHARE`,
      [input.itemId],
    );
    const item = itemRows[0];
    if (!item || item.production_type === "Resale") {
      throw new Error("Active manufactured production item not found.");
    }
    const orderId = id("wo");
    const workOrderNumber =
      `WO-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const rows = await db.query<WorkOrderRow>(
      `INSERT INTO production_work_orders (
         id, work_order_number, item_id, item_name_snapshot, colour,
         size_breakdown, planned_pairs, due_date, priority, current_stage,
         status, created_by, note
       ) VALUES (
         $1, $2, $3, $4, $5, $6::jsonb, $7, nullif($8, '')::date,
         $9, 'Upper', 'Planning', $10, $11
       )
       RETURNING id, work_order_number, item_id, item_name_snapshot, colour,
         size_breakdown, planned_pairs, due_date, priority, current_stage,
         status, created_by`,
      [
        orderId, workOrderNumber, item.id, item.name, input.colour,
        JSON.stringify(normalizeSizeBreakdown(input.sizeBreakdown)),
        input.plannedPairs, input.dueDate, input.priority, input.createdBy, input.note,
      ],
    );
    return workOrderFromRow(rows[0]);
  });
}

export async function updateProductionWorkOrderSchedule(input: {
  workOrderId: string;
  dueDate: string;
  priority: ProductionWorkOrder["priority"];
}) {
  const rows = await queryPostgres<{ work_order_number: string }>(
    "update Work Order schedule",
    `UPDATE production_work_orders
     SET due_date = nullif($2, '')::date, priority = $3, updated_at = now()
     WHERE id = $1 AND status NOT IN ('Completed', 'Cancelled')
     RETURNING work_order_number`,
    [input.workOrderId, input.dueDate, input.priority],
  );
  if (!rows[0]) throw new Error("Open Work Order was not found.");
  return { workOrderNumber: rows[0].work_order_number };
}

export async function cancelProductionWorkOrder(input: {
  workOrderId: string;
  reason: string;
  cancelledBy: string;
}) {
  return transactionPostgres("cancel production Work Order", async (db) => {
    const orders = await db.query<{ work_order_number: string; status: ProductionWorkOrder["status"] }>(
      `SELECT work_order_number, status FROM production_work_orders
       WHERE id = $1 FOR UPDATE`,
      [input.workOrderId],
    );
    const order = orders[0];
    if (!order || order.status === "Cancelled") {
      throw new Error("Work Order was not found or is already cancelled.");
    }
    if (order.status === "Completed") {
      throw new Error("Completed Work Order cannot be cancelled.");
    }
    const qcRows = await db.query<{ count: number | string }>(
      `SELECT count(*) AS count FROM production_qc_postings
       WHERE work_order_id = $1 AND reversed_at IS NULL`,
      [input.workOrderId],
    );
    if (Number(qcRows[0]?.count ?? 0) > 0) {
      throw new Error("Reverse active QC/finished-stock postings before cancelling this Work Order.");
    }
    await db.query(
      `UPDATE production_work_orders
       SET status = 'Cancelled', cancelled_at = now(), cancellation_reason = $2,
         updated_at = now()
       WHERE id = $1`,
      [input.workOrderId, `${input.reason} · Cancelled by ${input.cancelledBy}`],
    );
    return { workOrderNumber: order.work_order_number };
  });
}

export async function createProductionHandover(input: {
  workOrderId: string;
  handoverDate: string;
  fromStage: ProductionStage;
  fromEmployee?: ProductionWorker;
  toEmployee?: ProductionWorker;
  sentPairs: number;
  receivedPairs: number;
  receivedSizeBreakdown: SizeBreakdown;
  approvedBy: string;
  note: string;
}) {
  const toStage = nextProductionStage(input.fromStage);
  handoverSignal(input.sentPairs, input.receivedPairs);

  return transactionPostgres("create production handover", async (db) => {
    const orders = await db.query<WorkOrderRow>(
      `SELECT id, work_order_number, item_id, item_name_snapshot, colour,
         size_breakdown, planned_pairs, due_date, priority, current_stage,
         status, created_by
       FROM production_work_orders
       WHERE id = $1 AND status NOT IN ('Completed', 'Cancelled') FOR UPDATE`,
      [input.workOrderId],
    );
    const order = orders[0];
    if (!order) throw new Error("Open Work Order not found.");
    if (input.sentPairs > Number(order.planned_pairs) || input.receivedPairs > Number(order.planned_pairs)) {
      throw new Error("Handover quantity cannot exceed Work Order planned pairs.");
    }
    const receivedSizes = normalizeSizeBreakdown(input.receivedSizeBreakdown);
    const sizedTotal = Object.values(receivedSizes).reduce((total, pairs) => total + pairs, 0);
    if (sizedTotal !== input.receivedPairs) {
      throw new Error("Handover received size-wise pairs must match received pairs.");
    }
    if (input.receivedPairs > 0) {
      const previousSizes = await db.query<{ received_size_breakdown: SizeBreakdown | string }>(
        `SELECT received_size_breakdown FROM production_stage_handovers
         WHERE work_order_id = $1 AND to_stage = $2 AND reversed_at IS NULL
       LIMIT 500
     `,
        [input.workOrderId, toStage],
      );
      assertCumulativeSizePlan(
        jsonSizes(order.size_breakdown),
        previousSizes.map((row) => jsonSizes(row.received_size_breakdown)),
        receivedSizes,
        `${toStage} handover`,
      );
    }

    const handoverId = id("handover");
    await db.query(
      `INSERT INTO production_stage_handovers (
         id, handover_date, work_order_id, work_order_number_snapshot,
         from_stage, to_stage, from_employee_id, from_employee_name_snapshot,
         to_employee_id, to_employee_name_snapshot, sent_pairs, received_pairs,
         received_size_breakdown, approved_by, note
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15
       )`,
      [
        handoverId, input.handoverDate, order.id, order.work_order_number,
        input.fromStage, toStage, input.fromEmployee?.id ?? null,
        input.fromEmployee?.name ?? "", input.toEmployee?.id ?? null,
        input.toEmployee?.name ?? "", input.sentPairs, input.receivedPairs,
        JSON.stringify(receivedSizes), input.approvedBy, input.note,
      ],
    );
    return { id: handoverId, workOrderNumber: order.work_order_number, toStage };
  });
}

export async function reverseProductionHandover(input: {
  handoverId: string;
  reason: string;
  reversedBy: string;
}) {
  const rows = await queryPostgres<{
    work_order_id: string;
    work_order_number_snapshot: string;
    from_stage: ProductionStage;
    to_stage: ProductionStage | "Packing / QC";
  }>(
    "reverse production handover",
    `UPDATE production_stage_handovers
     SET reversed_at = now(), reversal_reason = $2
     WHERE id = $1 AND reversed_at IS NULL
     RETURNING work_order_id, work_order_number_snapshot, from_stage, to_stage`,
    [input.handoverId, `${input.reason} · Reversed by ${input.reversedBy}`],
  );
  if (!rows[0]) {
    throw new Error("Active handover was not found or has already been reversed.");
  }
  return {
    workOrderId: rows[0].work_order_id,
    workOrderNumber: rows[0].work_order_number_snapshot,
    fromStage: rows[0].from_stage,
    toStage: rows[0].to_stage,
  };
}

export async function approveProductionCostCard(input: {
  itemId: string;
  effectiveFrom: string;
  otherDirectCostPerPair: number;
  wholesaleProfitPercent: number;
  retailExtraAmount: number;
  approvedBy: string;
  note: string;
}) {
  return transactionPostgres("approve production cost card", async (db) => {
    const itemRows = await db.query<ItemRow>(
      `SELECT id, name, category, production_type, size_group, catalog_product_id, status
       FROM production_items WHERE id = $1 AND status = 'Active' FOR SHARE`,
      [input.itemId],
    );
    const item = itemRows[0];
    if (!item) throw new Error("Active production item not found.");
    if (item.production_type === "Resale") {
      throw new Error("Resale item cost comes from Purchasing.");
    }

    const materialRows = await db.query<{
      cost: number | string;
      material_count: number | string;
      missing_rate_count: number | string;
    }>(
      `SELECT coalesce(sum(
         bom.quantity_per_pair * (1 + bom.wastage_percent / 100) *
         coalesce(rates.average_unit_cost, 0)
       ), 0) AS cost,
       count(bom.id) AS material_count,
       count(bom.id) FILTER (WHERE coalesce(rates.average_unit_cost, 0) <= 0) AS missing_rate_count
       FROM production_item_materials bom
       LEFT JOIN (
         SELECT material_id, sum(line_total) / nullif(sum(quantity), 0) AS average_unit_cost
         FROM purchase_invoice_items WHERE kind = 'Raw Material' GROUP BY material_id
       ) rates ON rates.material_id = bom.material_id
       WHERE bom.item_id = $1`,
      [input.itemId],
    );
    const laborRows = await db.query<{ cost: number | string; stage_count: number | string }>(
      `SELECT coalesce(sum(rate_per_pair), 0) AS cost, count(*) AS stage_count
       FROM (
         SELECT DISTINCT ON (stage) stage, rate_per_pair
         FROM production_stage_rates
         WHERE item_id = $1 AND status = 'Active' AND effective_from <= $2::date
         ORDER BY stage, effective_from DESC, created_at DESC
       ) current_rates`,
      [input.itemId, input.effectiveFrom],
    );

    if (Number(materialRows[0]?.material_count ?? 0) <= 0) {
      throw new Error("Add at least one material recipe before approving cost.");
    }
    if (Number(materialRows[0]?.missing_rate_count ?? 0) > 0) {
      throw new Error("Every recipe material needs a real Purchasing rate before cost approval.");
    }
    if (Number(laborRows[0]?.stage_count ?? 0) < productionStages.length) {
      throw new Error("Set all four production stage wage rates before approving cost.");
    }

    const materialCost = numeric(materialRows[0]?.cost ?? 0);
    const laborCost = numeric(laborRows[0]?.cost ?? 0);
    const directCost = numeric(input.otherDirectCostPerPair);
    const makingCost = numeric(materialCost + laborCost + directCost);
    const wholesalePrice = numeric(makingCost * (1 + input.wholesaleProfitPercent / 100));
    const retailPrice = numeric(wholesalePrice + input.retailExtraAmount);
    const cardId = id("cost");

    const rows = await db.query<CostCardRow>(
      `INSERT INTO production_cost_cards (
         id, effective_from, item_id, item_name_snapshot,
         material_cost_per_pair, labor_cost_per_pair, other_direct_cost_per_pair,
         making_cost_per_pair, wholesale_profit_percent, wholesale_price,
         retail_extra_amount, retail_price, approved_by, note
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
       )
       RETURNING id, effective_from, item_id, item_name_snapshot,
         material_cost_per_pair, labor_cost_per_pair, other_direct_cost_per_pair,
         making_cost_per_pair, wholesale_profit_percent, wholesale_price,
         retail_extra_amount, retail_price, approved_by`,
      [
        cardId, input.effectiveFrom, item.id, item.name, materialCost, laborCost,
        directCost, makingCost, input.wholesaleProfitPercent, wholesalePrice,
        input.retailExtraAmount, retailPrice, input.approvedBy, input.note,
      ],
    );
    return costCardFromRow(rows[0]);
  });
}

export async function setProductionStageRate(input: {
  itemId: string;
  stage: ProductionStage;
  ratePerPair: number;
  effectiveFrom: string;
}) {
  await queryPostgres(
    "set production stage rate",
    `INSERT INTO production_stage_rates
       (id, item_id, stage, rate_per_pair, effective_from, status)
     VALUES ($1, $2, $3, $4, $5, 'Active')
     ON CONFLICT (item_id, stage, effective_from) DO UPDATE SET
       rate_per_pair = EXCLUDED.rate_per_pair, status = 'Active', updated_at = now()`,
    [id("prate"), input.itemId, input.stage, input.ratePerPair, input.effectiveFrom],
  );
}

export async function setProductionWorkerStageRate(input: {
  employee: ProductionWorker;
  itemId: string;
  stage: ProductionStage;
  ratePerPair: number;
  effectiveFrom: string;
  note: string;
}) {
  await queryPostgres(
    "set production worker stage rate",
    `INSERT INTO production_worker_stage_rates (
       id, employee_id, employee_name_snapshot, item_id, stage,
       rate_per_pair, effective_from, status, note
     )
     SELECT $1, $2, $3, items.id, $5, $6, $7, 'Active', $8
     FROM production_items items
     WHERE items.id = $4 AND items.status = 'Active'
     ON CONFLICT (employee_id, item_id, stage, effective_from) DO UPDATE SET
       employee_name_snapshot = EXCLUDED.employee_name_snapshot,
       rate_per_pair = EXCLUDED.rate_per_pair,
       status = 'Active',
       note = EXCLUDED.note,
       updated_at = now()`,
    [
      id("pwrate"), input.employee.id, input.employee.name, input.itemId, input.stage,
      input.ratePerPair, input.effectiveFrom, input.note,
    ],
  );
}

export async function addApprovedWorkEntry(input: {
  employee: ProductionWorker;
  workOrderId: string;
  itemId: string;
  stage: ProductionStage;
  workDate: string;
  totalPairs: number;
  rejectedPairs: number;
  reworkPairs: number;
  sizeBreakdown: SizeBreakdown;
  approvedBy: string;
  note: string;
  sourceSubmissionKey?: string;
}) {
  assertWorkQuantity({ ...input, ratePerPair: 0 }, input.sizeBreakdown);

  return transactionPostgres("approve production work", async (db) => {
    if (input.sourceSubmissionKey) {
      const existing = await db.query<{ id: string; earned_wage: number | string }>(
        `SELECT id, earned_wage FROM production_work_entries
         WHERE source_submission_key = $1 LIMIT 1`,
        [input.sourceSubmissionKey],
      );
      if (existing[0]) {
        return { id: existing[0].id, earned: numeric(existing[0].earned_wage) };
      }
    }

    const itemRows = await db.query<ItemRow>(
      `SELECT id, name, category, production_type, size_group, catalog_product_id, status
       FROM production_items WHERE id = $1 AND status = 'Active' FOR SHARE`,
      [input.itemId],
    );
    if (!itemRows[0]) throw new Error("Active production item not found.");

    if (input.workOrderId) {
      const orderRows = await db.query<WorkOrderRow>(
        `SELECT id, work_order_number, item_id, item_name_snapshot, colour,
           size_breakdown, planned_pairs, due_date, priority, current_stage,
           status, created_by
         FROM production_work_orders
         WHERE id = $1 AND status NOT IN ('Completed', 'Cancelled') FOR UPDATE`,
        [input.workOrderId],
      );
      const order = orderRows[0];
      if (!order) throw new Error("Open Work Order not found.");
      if (order.item_id !== input.itemId) throw new Error("Work Order item does not match work entry item.");
      const previousSizes = await db.query<{ size_breakdown: SizeBreakdown | string }>(
        `SELECT size_breakdown FROM production_work_entries
         WHERE work_order_id = $1 AND stage = $2 AND status = 'Approved'
       LIMIT 500
     `,
        [input.workOrderId, input.stage],
      );
      assertCumulativeSizePlan(
        jsonSizes(order.size_breakdown),
        previousSizes.map((row) => jsonSizes(row.size_breakdown)),
        input.sizeBreakdown,
        input.stage,
      );
    }

    const rateRows = await db.query<RateRow>(
      `SELECT id, item_id, stage, rate_per_pair, effective_from
       FROM (
         SELECT id, item_id, stage, rate_per_pair, effective_from,
           created_at, 0 AS rate_priority
         FROM production_worker_stage_rates
         WHERE employee_id = $1 AND item_id = $2 AND stage = $3
           AND status = 'Active' AND effective_from <= $4::date
         UNION ALL
         SELECT id, item_id, stage, rate_per_pair, effective_from,
           created_at, 1 AS rate_priority
         FROM production_stage_rates
         WHERE item_id = $2 AND stage = $3
           AND status = 'Active' AND effective_from <= $4::date
       ) available_rates
       ORDER BY rate_priority, effective_from DESC, created_at DESC
       LIMIT 1`,
      [input.employee.id, input.itemId, input.stage, input.workDate],
    );
    if (!rateRows[0]) throw new Error("Set this item and stage wage rate first.");

    const rate = numeric(rateRows[0].rate_per_pair);
    const earned = calculateEarnedWage({ ...input, ratePerPair: rate, status: "Approved" });
    const entryId = id("work");
    await db.query(
      `INSERT INTO production_work_entries (
         id, work_date, employee_id, employee_name_snapshot, work_order_id, item_id,
         item_name_snapshot, stage, total_pairs, size_breakdown,
         rejected_pairs, rework_pairs, rate_per_pair_snapshot, earned_wage,
         status, approved_by, approved_at, note, source_submission_key
       ) VALUES (
         $1, $2, $3, $4, nullif($5, ''), $6, $7, $8, $9, $10::jsonb,
         $11, $12, $13, $14, 'Approved', $15, now(), $16, nullif($17, '')
       )`,
      [
        entryId, input.workDate, input.employee.id, input.employee.name,
        input.workOrderId, input.itemId, itemRows[0].name, input.stage, input.totalPairs,
        JSON.stringify(normalizeSizeBreakdown(input.sizeBreakdown)),
        input.rejectedPairs, input.reworkPairs, rate, earned, input.approvedBy, input.note,
        input.sourceSubmissionKey ?? "",
      ],
    );

    if (input.workOrderId) {
      const totals = await db.query<{ completed: number | string; planned: number | string }>(
        `SELECT coalesce(sum(entries.total_pairs - entries.rejected_pairs), 0) AS completed,
           orders.planned_pairs AS planned
         FROM production_work_orders orders
         LEFT JOIN production_work_entries entries
           ON entries.work_order_id = orders.id AND entries.stage = $2
             AND entries.status = 'Approved'
         WHERE orders.id = $1
         GROUP BY orders.planned_pairs`,
        [input.workOrderId, input.stage],
      );
      const stageComplete = Number(totals[0]?.completed ?? 0) >= Number(totals[0]?.planned ?? 0);
      await db.query(
        `UPDATE production_work_orders SET
           status = CASE WHEN $3 THEN
             CASE WHEN $2 = 'Bottom Final' THEN 'Ready for QC' ELSE 'In Progress' END
             ELSE 'In Progress' END,
           current_stage = CASE WHEN $3 THEN $4 ELSE current_stage END,
           updated_at = now()
         WHERE id = $1`,
        [input.workOrderId, input.stage, stageComplete, nextProductionStage(input.stage)],
      );
    }
    return { id: entryId, earned };
  });
}

export async function reverseProductionWorkEntry(input: {
  entryId: string;
  reason: string;
  reversedBy: string;
}) {
  return transactionPostgres("reverse production work entry", async (db) => {
    const entryRows = await db.query<{
      id: string;
      employee_id: string;
      employee_name_snapshot: string;
      work_order_id: string | null;
      earned_wage: number | string;
      status: WorkEntry["status"];
    }>(
      `SELECT id, employee_id, employee_name_snapshot, work_order_id, earned_wage, status
       FROM production_work_entries WHERE id = $1 FOR UPDATE`,
      [input.entryId],
    );
    const entry = entryRows[0];
    if (!entry || entry.status !== "Approved") {
      throw new Error("Approved work entry was not found or has already been reversed.");
    }

    if (entry.work_order_id) {
      const qcRows = await db.query<{ count: number | string }>(
        `SELECT count(*) AS count FROM production_qc_postings
         WHERE work_order_id = $1 AND reversed_at IS NULL`,
        [entry.work_order_id],
      );
      if (Number(qcRows[0]?.count ?? 0) > 0) {
        throw new Error("This lot already posted finished stock. Reverse its QC/stock posting first.");
      }
    }

    await db.query(
      `UPDATE production_work_entries
       SET status = 'Reversed', reversed_at = now(), reversal_reason = $2
       WHERE id = $1`,
      [input.entryId, `${input.reason} · Reversed by ${input.reversedBy}`],
    );

    if (entry.work_order_id) {
      const orderRows = await db.query<{ planned_pairs: number | string; status: ProductionWorkOrder["status"] }>(
        `SELECT planned_pairs, status FROM production_work_orders WHERE id = $1 FOR UPDATE`,
        [entry.work_order_id],
      );
      if (orderRows[0] && orderRows[0].status !== "Cancelled") {
        const progressRows = await db.query<{ stage: ProductionStage; good_pairs: number | string }>(
          `SELECT stage, coalesce(sum(total_pairs - rejected_pairs), 0) AS good_pairs
           FROM production_work_entries
           WHERE work_order_id = $1 AND status = 'Approved'
           GROUP BY stage`,
          [entry.work_order_id],
        );
        const progress = new Map(progressRows.map((row) => [row.stage, Number(row.good_pairs)]));
        const plannedPairs = Number(orderRows[0].planned_pairs);
        const firstIncomplete = productionStages.find((stage) => (progress.get(stage) ?? 0) < plannedPairs);
        const approvedEntryCount = progressRows.length;

        await db.query(
          `UPDATE production_work_orders SET current_stage = $2, status = $3, updated_at = now()
           WHERE id = $1`,
          [
            entry.work_order_id,
            firstIncomplete ?? "Packing / QC",
            firstIncomplete
              ? firstIncomplete === "Upper" && approvedEntryCount === 0 ? "Planning" : "In Progress"
              : "Ready for QC",
          ],
        );
      }
    }

    return {
      employeeId: entry.employee_id,
      employeeName: entry.employee_name_snapshot,
      workOrderId: entry.work_order_id ?? "",
      earnedWage: numeric(entry.earned_wage),
    };
  });
}

export async function addWorkerPayment(input: {
  employee: ProductionWorker;
  paymentDate: string;
  paymentType: WorkerPaymentType;
  direction: WorkerPaymentDirection;
  amount: number;
  approvedBy: string;
  note: string;
}) {
  const receiptNumber = `KR-PAY-${input.paymentDate.replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  await queryPostgres(
    "create worker payment",
    `INSERT INTO worker_payments (
       id, payment_date, employee_id, employee_name_snapshot, payment_type,
       direction, amount, payment_method, receipt_number, approved_by, note
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Cash', $8, $9, $10)`,
    [
      id("wpay"), input.paymentDate, input.employee.id, input.employee.name,
      input.paymentType, input.direction, input.amount, receiptNumber,
      input.approvedBy, input.note,
    ],
  );
  return receiptNumber;
}

export async function reverseWorkerPayment(input: {
  paymentId: string;
  reason: string;
  reversedBy: string;
}) {
  const rows = await queryPostgres<{
    receipt_number: string;
    employee_id: string;
    employee_name_snapshot: string;
    amount: number | string;
  }>(
    "reverse worker payment",
    `UPDATE worker_payments
     SET reversed_at = now(), reversal_reason = $2
     WHERE id = $1 AND reversed_at IS NULL
     RETURNING receipt_number, employee_id, employee_name_snapshot, amount`,
    [input.paymentId, `${input.reason} · Reversed by ${input.reversedBy}`],
  );
  if (!rows[0]) {
    throw new Error("Payment was not found or has already been reversed.");
  }
  return {
    receiptNumber: rows[0].receipt_number,
    employeeId: rows[0].employee_id,
    employeeName: rows[0].employee_name_snapshot,
    amount: numeric(rows[0].amount),
  };
}

export async function approvePackingQcAndPostStock(input: {
  itemId: string;
  workOrderId: string;
  packingEmployee?: ProductionWorker;
  qcDate: string;
  totalPairs: number;
  rejectedPairs: number;
  sizeBreakdown: SizeBreakdown;
  approvedBy: string;
  note: string;
}) {
  return transactionPostgres("approve packing QC and post stock", async (db) => {
    const itemRows = await db.query<ItemRow>(
      `SELECT id, name, category, production_type, size_group, catalog_product_id, status
       FROM production_items WHERE id = $1 AND status = 'Active' FOR UPDATE`,
      [input.itemId],
    );
    const item = itemRows[0];
    if (!item) throw new Error("Active production item not found.");

    const productRows = await db.query<{ id: string; name: string }>(
      `SELECT id, name FROM products WHERE id = $1 FOR UPDATE`,
      [item.catalog_product_id ?? ""],
    );
    const product = productRows[0];

    assertFinishedStockPosting({
      productionType: item.production_type,
      catalogProductId: product?.id ?? "",
      packingQcApproved: true,
      totalPairs: input.totalPairs,
      sizeBreakdown: input.sizeBreakdown,
    });

    let workOrder: WorkOrderRow | undefined;
    if (input.workOrderId) {
      const orders = await db.query<WorkOrderRow>(
        `SELECT id, work_order_number, item_id, item_name_snapshot, colour,
           size_breakdown, planned_pairs, due_date, priority, current_stage,
           status, created_by
         FROM production_work_orders
         WHERE id = $1 AND status = 'Ready for QC' FOR UPDATE`,
        [input.workOrderId],
      );
      workOrder = orders[0];
      if (!workOrder) throw new Error("Work Order must be Ready for QC.");
      if (workOrder.item_id !== item.id) throw new Error("QC item does not match Work Order item.");

      const previousSizes = await db.query<{ size_breakdown: SizeBreakdown | string }>(
        `SELECT size_breakdown FROM production_qc_postings
         WHERE work_order_id = $1 AND reversed_at IS NULL
       LIMIT 500
     `,
        [input.workOrderId],
      );
      assertCumulativeSizePlan(
        jsonSizes(workOrder.size_breakdown),
        previousSizes.map((row) => jsonSizes(row.size_breakdown)),
        input.sizeBreakdown,
        "Packing/QC",
      );
      const previous = await db.query<{ accounted: number | string }>(
        `SELECT coalesce(sum(total_pairs + rejected_pairs), 0) AS accounted
         FROM production_qc_postings WHERE work_order_id = $1 AND reversed_at IS NULL`,
        [input.workOrderId],
      );
      if (Number(previous[0]?.accounted ?? 0) + input.totalPairs + input.rejectedPairs > Number(workOrder.planned_pairs)) {
        throw new Error("QC good and rejected pairs exceed Work Order planned pairs.");
      }
    }

    const approvalReference =
      `KR-QC-${input.qcDate.replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const movement = await insertStockMovement(db, {
      design: product.name,
      channel: "Factory",
      sizeRun: "Mixed",
      type: "Production In",
      pairs: input.totalPairs,
      note: `${approvalReference} · ${item.name} packing/QC approved`,
    });
    const postingId = id("qc");

    await db.query(
      `INSERT INTO production_qc_postings (
         id, qc_date, approval_reference, work_order_id, item_id, item_name_snapshot,
         catalog_product_id, catalog_product_name_snapshot,
         packing_employee_id, packing_employee_name_snapshot,
         total_pairs, rejected_pairs, size_breakdown, stock_movement_id,
         approved_by, note
       ) VALUES (
         $1, $2, $3, nullif($4, ''), $5, $6, $7, $8, $9, $10,
         $11, $12, $13::jsonb, $14, $15, $16
       )`,
      [
        postingId, input.qcDate, approvalReference, input.workOrderId, item.id,
        item.name, product.id, product.name, input.packingEmployee?.id ?? null,
        input.packingEmployee?.name ?? "", input.totalPairs, input.rejectedPairs,
        JSON.stringify(normalizeSizeBreakdown(input.sizeBreakdown)),
        movement.id, input.approvedBy, input.note,
      ],
    );

    if (workOrder) {
      const totals = await db.query<{ accounted: number | string }>(
        `SELECT coalesce(sum(total_pairs + rejected_pairs), 0) AS accounted
         FROM production_qc_postings WHERE work_order_id = $1 AND reversed_at IS NULL`,
        [workOrder.id],
      );
      if (Number(totals[0]?.accounted ?? 0) >= Number(workOrder.planned_pairs)) {
        await db.query(
          `UPDATE production_work_orders
           SET status = 'Completed', current_stage = 'Packing / QC', updated_at = now()
           WHERE id = $1`,
          [workOrder.id],
        );
      }
    }

    return { id: postingId, approvalReference, stockMovementId: movement.id };
  });
}

export async function reversePackingQcAndStock(input: {
  postingId: string;
  reason: string;
  reversedBy: string;
}) {
  return transactionPostgres("reverse packing QC and stock", async (db) => {
    const postingRows = await db.query<{
      id: string;
      approval_reference: string;
      work_order_id: string | null;
      catalog_product_name_snapshot: string;
      total_pairs: number | string;
      stock_movement_id: string;
    }>(
      `SELECT id, approval_reference, work_order_id, catalog_product_name_snapshot,
         total_pairs, stock_movement_id
       FROM production_qc_postings
       WHERE id = $1 AND reversed_at IS NULL FOR UPDATE`,
      [input.postingId],
    );
    const posting = postingRows[0];
    if (!posting) throw new Error("Active QC posting was not found or is already reversed.");

    const movementRows = await db.query<{
      id: string;
      design: string;
      channel: string;
      size_run: string;
      type: string;
      pairs: number | string;
    }>(
      `SELECT id, design, channel, size_run, type, pairs
       FROM stock_movements WHERE id = $1 FOR UPDATE`,
      [posting.stock_movement_id],
    );
    const movement = movementRows[0];
    if (!movement || movement.type !== "Production In") {
      throw new Error("Original Production In movement was not found.");
    }

    const stockRows = await db.query<{ id: string; stock_pairs: number | string }>(
      `SELECT id, stock_pairs FROM finished_stock
       WHERE lower(design) = lower($1) AND channel = $2
       ORDER BY CASE WHEN size_run = $3 THEN 0 WHEN size_run = 'Mixed' THEN 1 ELSE 2 END,
         created_at DESC
       LIMIT 1 FOR UPDATE`,
      [movement.design, movement.channel, movement.size_run || "Mixed"],
    );
    const stock = stockRows[0];
    const pairs = Number(posting.total_pairs);
    if (!stock || Number(stock.stock_pairs) < pairs) {
      throw new Error(
        "Finished stock is lower than this QC posting. Return sold/dispatched pairs before reversal.",
      );
    }

    await db.query(
      `UPDATE finished_stock SET stock_pairs = stock_pairs - $2, updated_at = now()
       WHERE id = $1`,
      [stock.id, pairs],
    );

    const reversalMovementId = id("MOVE");
    await db.query(
      `INSERT INTO stock_movements
         (id, created_at, design, channel, size_run, type, pairs, note)
       VALUES ($1, now(), $2, $3, $4, 'Adjustment', $5, $6)`,
      [
        reversalMovementId, movement.design, movement.channel, movement.size_run || "Mixed",
        pairs, `${posting.approval_reference} reversal · ${input.reason}`,
      ],
    );
    await db.query(
      `UPDATE production_qc_postings SET reversed_at = now(), reversal_reason = $2,
         reversal_stock_movement_id = $3 WHERE id = $1`,
      [
        posting.id, `${input.reason} · Reversed by ${input.reversedBy}`,
        reversalMovementId,
      ],
    );

    if (posting.work_order_id) {
      const orderRows = await db.query<{ planned_pairs: number | string }>(
        `SELECT planned_pairs FROM production_work_orders WHERE id = $1 FOR UPDATE`,
        [posting.work_order_id],
      );
      const totals = await db.query<{ accounted: number | string }>(
        `SELECT coalesce(sum(total_pairs + rejected_pairs), 0) AS accounted
         FROM production_qc_postings
         WHERE work_order_id = $1 AND reversed_at IS NULL`,
        [posting.work_order_id],
      );
      const completed =
        Number(totals[0]?.accounted ?? 0) >= Number(orderRows[0]?.planned_pairs ?? 0);
      await db.query(
        `UPDATE production_work_orders
         SET status = $2, current_stage = 'Packing / QC', updated_at = now()
         WHERE id = $1 AND status <> 'Cancelled'`,
        [posting.work_order_id, completed ? "Completed" : "Ready for QC"],
      );
    }

    return {
      approvalReference: posting.approval_reference,
      workOrderId: posting.work_order_id ?? "",
      productName: posting.catalog_product_name_snapshot,
      pairs,
      reversalMovementId,
    };
  });
}
