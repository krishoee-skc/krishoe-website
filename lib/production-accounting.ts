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
  assertFinishedStockPosting,
  normalizeSizeBreakdown,
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
  today_good_pairs: number | string;
  today_rejected_pairs: number | string;
  today_earned_wage: number | string;
  active_worker_count: number | string;
  today_stock_pairs: number | string;
  worker_balance_due: number | string;
};

export type ProductionPeriodSummary = {
  goodPairs: number;
  rejectedPairs: number;
  earnedWage: number;
  cashPaid: number;
  stockPostedPairs: number;
  topWorker: { name: string; goodPairs: number } | null;
};

function numeric(value: number | string) {
  return Math.round(Number(value) * 100) / 100;
}

function isoDate(value: Date | string) {
  return (value instanceof Date ? value.toISOString() : String(value)).slice(0, 10);
}

export async function getProductionControlSummary() {
  const rows = await queryPostgres<ProductionControlRow>(
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
         (SELECT coalesce(sum(greatest(
           coalesce(earned.amount, 0) - coalesce(paid.amount, 0), 0
         )), 0)
          FROM people
          LEFT JOIN earned USING (employee_id)
          LEFT JOIN paid USING (employee_id)) AS worker_balance_due`,
  );
  const row = rows[0];
  const count = (value: number | string | undefined) => Number(value ?? 0);
  return {
    todayGoodPairs: count(row?.today_good_pairs),
    todayRejectedPairs: count(row?.today_rejected_pairs),
    todayEarnedWage: numeric(row?.today_earned_wage ?? 0),
    activeWorkerCount: count(row?.active_worker_count),
    todayStockPairs: count(row?.today_stock_pairs),
    workerBalanceDue: numeric(row?.worker_balance_due ?? 0),
  };
}

export async function getProductionAcceptanceAudit() {
  const rows = await queryPostgres<{
    orphan_work_entries: number | string;
    qc_without_stock_movement: number | string;
    duplicate_submission_keys: number | string;
    items_missing_rates: number | string;
    items_missing_bom: number | string;
    items_missing_catalog: number | string;
    ledger_mismatch_workers: number | string;
  }>(
    "production acceptance audit",
    `SELECT
       (SELECT count(*) FROM production_work_entries entries
        LEFT JOIN factory_workers workers ON workers.id = entries.employee_id
        WHERE workers.id IS NULL) AS orphan_work_entries,
       (SELECT count(*) FROM production_qc_postings qc
        LEFT JOIN stock_movements movements ON movements.id = qc.stock_movement_id
        WHERE qc.reversed_at IS NULL AND movements.id IS NULL) AS qc_without_stock_movement,
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
          AND items.catalog_product_id IS NULL) AS items_missing_catalog,
       -- Workers whose two ledgers no longer tell the same story. Rounded to
       -- the paisa before comparing, because one side stores numeric and the
       -- other sums it, and a half-paisa difference is not a mismatch worth
       -- turning the board red over.
       (SELECT count(*) FROM factory_workers workers
        WHERE round(coalesce((
                SELECT sum(entries.earned_wage) FROM production_work_entries entries
                WHERE entries.employee_id = workers.id AND entries.status = 'Approved'
              ), 0), 2)
           <> round(coalesce((
                SELECT sum(work.amount_earned) FROM factory_daily_work work
                WHERE work.worker_id = workers.id AND work.status = 'completed'
              ), 0), 2)) AS ledger_mismatch_workers`,
  );
  const row = rows[0];
  const count = (value: number | string | undefined) => Number(value ?? 0);
  const integrityIssues =
    count(row?.orphan_work_entries) +
    count(row?.qc_without_stock_movement) +
    count(row?.duplicate_submission_keys) +
    count(row?.ledger_mismatch_workers);
  return {
    integrityIssues,
    orphanWorkEntries: count(row?.orphan_work_entries),
    qcWithoutStockMovement: count(row?.qc_without_stock_movement),
    duplicateSubmissionKeys: count(row?.duplicate_submission_keys),
    itemsMissingRates: count(row?.items_missing_rates),
    itemsMissingBom: count(row?.items_missing_bom),
    itemsMissingCatalog: count(row?.items_missing_catalog),
    ledgerMismatchWorkers: count(row?.ledger_mismatch_workers),
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
            AND qc_date >= $1::date AND qc_date < $2::date) AS stock_posted_pairs`,
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

export async function getProductionAccountingSnapshot() {
  const [
    items, rates, workerRates, workEntries, payments, qcPostings, balances,
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
      source_submission_key: string | null;
      work_date: Date | string;
    }>(
      `SELECT id, employee_id, employee_name_snapshot, work_order_id, earned_wage, status,
              source_submission_key, work_date
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

    // The same work on the factory side. One save wrote all three rows under
    // this key; undoing the work has to undo all three, or the wages screen
    // and the worker's balance disagree about whether it happened.
    let factoryWorkReversed = false;
    if (entry.source_submission_key) {
      const work = await db.query<{ id: string }>(
        `UPDATE factory_daily_work
         SET status = 'reversed', updated_at = now()
         WHERE submission_key = $1 AND status <> 'reversed'
         RETURNING id`,
        [entry.source_submission_key],
      );
      factoryWorkReversed = work.length > 0;

      // The ledger row too, so the worker's running balance stops counting a
      // wage that is no longer owed. Every sum that decides what is owed
      // already skips a reversed row. Only the work row: cash handed over is
      // not undone by undoing the work it was against.
      await db.query(
        `UPDATE factory_worker_ledger
         SET status = 'reversed', updated_at = now(),
             notes = concat_ws(' · ', nullif(notes, ''), $2::text)
         WHERE submission_key = $1 AND entry_type = 'work' AND status <> 'reversed'`,
        [
          entry.source_submission_key,
          `Work reversed: ${input.reason} · by ${input.reversedBy}`,
        ],
      );
    }

    return {
      employeeId: entry.employee_id,
      employeeName: entry.employee_name_snapshot,
      earnedWage: numeric(entry.earned_wage),
      factoryWorkReversed,
      // So the caller can rebuild the worker's month once this transaction has
      // committed and let go of the worker lock.
      workDate:
        entry.work_date instanceof Date
          ? entry.work_date.toISOString().slice(0, 10)
          : String(entry.work_date).slice(0, 10),
      submissionKey: entry.source_submission_key ?? "",
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
  return transactionPostgres("create worker payment", async (db) => {
    // The same worker, the same amount, the same day, entered minutes apart is
    // one payment recorded twice — a worker's Rs. 9,720 was entered here twice
    // twenty-three seconds apart and the screen then read Rs. 19,440 paid
    // against Rs. 9,720 earned. The check and the insert share a transaction so
    // a second press arriving mid-check cannot slip between them.
    const recent = await db.query<{ receipt_number: string; minutes_ago: number }>(
      `SELECT receipt_number, EXTRACT(EPOCH FROM (now() - created_at)) / 60 AS minutes_ago
       FROM worker_payments
       WHERE employee_id = $1
         AND payment_date = $2::date
         AND amount = $3
         AND payment_type = $4
         AND reversed_at IS NULL
         AND created_at > now() - interval '10 minutes'
       LIMIT 1`,
      [input.employee.id, input.paymentDate, input.amount, input.paymentType],
    );
    if (recent[0]) {
      const minutes = Math.max(1, Math.round(Number(recent[0].minutes_ago) || 1));
      throw new Error(
        `${input.employee.name} was already given this amount ${minutes} minute${minutes === 1 ? "" : "s"} ago today (${recent[0].receipt_number}). ` +
          "If that was this payment, it is already recorded. If it is a second, separate payment, wait a few minutes or add a note saying what it is for.",
      );
    }

    await db.query(
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
  });
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

    const approvalReference =
      `KR-QC-${input.qcDate.replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const movement = await insertStockMovement(db, {
      design: product.name,
      channel: "Factory",
      sizeRun: "Mixed",
      type: "Production In",
      pairs: input.totalPairs,
      // The pairs total is authoritative; this records how they split by size so
      // the shop can later show size 30 as gone while 35 is in stock. Additive —
      // it does not change the total or the reversal, which still key off pairs.
      sizeBreakdown: normalizeSizeBreakdown(input.sizeBreakdown),
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
        // Work Orders were taken out; a posting never names one now.
        postingId, input.qcDate, approvalReference, "", item.id,
        item.name, product.id, product.name, input.packingEmployee?.id ?? null,
        input.packingEmployee?.name ?? "", input.totalPairs, input.rejectedPairs,
        JSON.stringify(normalizeSizeBreakdown(input.sizeBreakdown)),
        movement.id, input.approvedBy, input.note,
      ],
    );

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

    return {
      approvalReference: posting.approval_reference,
      productName: posting.catalog_product_name_snapshot,
      pairs,
      reversalMovementId,
    };
  });
}
