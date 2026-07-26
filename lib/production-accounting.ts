import { getHrData, type Employee } from "@/lib/hr";
import { getProducts } from "@/lib/product-store";
import { queryPostgres, transactionPostgres } from "@/lib/postgres/client";
import {
  assertWorkQuantity,
  calculateEarnedWage,
  normalizeSizeBreakdown,
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

export type WorkEntry = {
  id: string;
  workDate: string;
  employeeId: string;
  employeeName: string;
  itemName: string;
  stage: ProductionStage;
  totalPairs: number;
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

type WorkRow = {
  id: string;
  work_date: Date | string;
  employee_id: string;
  employee_name_snapshot: string;
  item_name_snapshot: string;
  stage: ProductionStage;
  total_pairs: number | string;
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

function numeric(value: number | string) {
  return Math.round(Number(value) * 100) / 100;
}

function isoDate(value: Date | string) {
  return (value instanceof Date ? value.toISOString() : String(value)).slice(0, 10);
}

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export async function getProductionAccountingSnapshot() {
  const [items, rates, workEntries, payments, balances, hr, products] = await Promise.all([
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
    queryPostgres<WorkRow>(
      "production work entries",
      `SELECT id, work_date, employee_id, employee_name_snapshot,
         item_name_snapshot, stage, total_pairs, rejected_pairs,
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
    getHrData(),
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
    workEntries: workEntries.map((row) => ({
      id: row.id,
      workDate: isoDate(row.work_date),
      employeeId: row.employee_id,
      employeeName: row.employee_name_snapshot,
      itemName: row.item_name_snapshot,
      stage: row.stage,
      totalPairs: Number(row.total_pairs),
      rejectedPairs: Number(row.rejected_pairs),
      ratePerPair: numeric(row.rate_per_pair_snapshot),
      earnedWage: numeric(row.earned_wage),
      status: row.status,
    })),
    payments: payments.map(paymentFromRow),
    balances: balances.map((row) => ({
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      earned: numeric(row.earned),
      paid: numeric(row.paid),
      balance: numeric(row.balance),
    })),
    employees: hr.employees.filter((employee) => employee.status === "Active"),
    products,
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

function workFromRow(row: WorkRow): WorkEntry {
  return {
    id: row.id,
    workDate: isoDate(row.work_date),
    employeeId: row.employee_id,
    employeeName: row.employee_name_snapshot,
    itemName: row.item_name_snapshot,
    stage: row.stage,
    totalPairs: Number(row.total_pairs),
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
  const hr = await getHrData();
  const employee = hr.employees.find((row) => row.id === employeeId);
  if (!employee) return null;

  const [allWork, allPayments, periodWork, periodPayments] = await Promise.all([
    queryPostgres<WorkRow>(
      "worker work ledger",
      `SELECT id, work_date, employee_id, employee_name_snapshot,
         item_name_snapshot, stage, total_pairs, rejected_pairs,
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
      `SELECT id, work_date, employee_id, employee_name_snapshot,
         item_name_snapshot, stage, total_pairs, rejected_pairs,
         rate_per_pair_snapshot, earned_wage, status
       FROM production_work_entries
       WHERE employee_id = $1 AND status = 'Approved'
         AND work_date BETWEEN $2::date AND $3::date
       ORDER BY work_date, created_at`,
      [employeeId, period.start, period.end],
    ),
    queryPostgres<PaymentRow>(
      "worker Friday payment statement",
      `SELECT id, payment_date, employee_id, employee_name_snapshot,
         payment_type, direction, amount, receipt_number, approved_by, note
       FROM worker_payments
       WHERE employee_id = $1 AND reversed_at IS NULL
         AND payment_date BETWEEN $2::date AND $3::date
       ORDER BY payment_date, created_at`,
      [employeeId, period.start, period.end],
    ),
  ]);

  const work = allWork.map(workFromRow);
  const payments = allPayments.map(paymentFromRow);
  const weekWork = periodWork.map(workFromRow);
  const weekPayments = periodPayments.map(paymentFromRow);
  const totalEarned = work
    .filter((row) => row.status === "Approved")
    .reduce((total, row) => total + row.earnedWage, 0);
  const totalPaid = payments.reduce(
    (total, row) => total + (row.direction === "Added" ? -row.amount : row.amount),
    0,
  );

  return {
    employee,
    work,
    payments,
    period,
    statement: {
      pairs: weekWork.reduce((total, row) => total + row.totalPairs, 0),
      rejectedPairs: weekWork.reduce((total, row) => total + row.rejectedPairs, 0),
      earned: numeric(weekWork.reduce((total, row) => total + row.earnedWage, 0)),
      paid: numeric(
        weekPayments.reduce(
          (total, row) => total + (row.direction === "Added" ? -row.amount : row.amount),
          0,
        ),
      ),
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

export async function addApprovedWorkEntry(input: {
  employee: Employee;
  itemId: string;
  stage: ProductionStage;
  workDate: string;
  totalPairs: number;
  rejectedPairs: number;
  reworkPairs: number;
  sizeBreakdown: SizeBreakdown;
  approvedBy: string;
  note: string;
}) {
  assertWorkQuantity({ ...input, ratePerPair: 0 }, input.sizeBreakdown);

  return transactionPostgres("approve production work", async (db) => {
    const itemRows = await db.query<ItemRow>(
      `SELECT id, name, category, production_type, size_group, catalog_product_id, status
       FROM production_items WHERE id = $1 AND status = 'Active' FOR SHARE`,
      [input.itemId],
    );
    if (!itemRows[0]) throw new Error("Active production item not found.");

    const rateRows = await db.query<RateRow>(
      `SELECT id, item_id, stage, rate_per_pair, effective_from
       FROM production_stage_rates
       WHERE item_id = $1 AND stage = $2 AND status = 'Active'
         AND effective_from <= $3::date
       ORDER BY effective_from DESC, created_at DESC LIMIT 1`,
      [input.itemId, input.stage, input.workDate],
    );
    if (!rateRows[0]) throw new Error("Set this item and stage wage rate first.");

    const rate = numeric(rateRows[0].rate_per_pair);
    const earned = calculateEarnedWage({ ...input, ratePerPair: rate, status: "Approved" });
    const entryId = id("work");
    await db.query(
      `INSERT INTO production_work_entries (
         id, work_date, employee_id, employee_name_snapshot, item_id,
         item_name_snapshot, stage, total_pairs, size_breakdown,
         rejected_pairs, rework_pairs, rate_per_pair_snapshot, earned_wage,
         status, approved_by, approved_at, note
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb,
         $10, $11, $12, $13, 'Approved', $14, now(), $15
       )`,
      [
        entryId, input.workDate, input.employee.id, input.employee.name, input.itemId,
        itemRows[0].name, input.stage, input.totalPairs,
        JSON.stringify(normalizeSizeBreakdown(input.sizeBreakdown)),
        input.rejectedPairs, input.reworkPairs, rate, earned, input.approvedBy, input.note,
      ],
    );
    return { id: entryId, earned };
  });
}

export async function addWorkerPayment(input: {
  employee: Employee;
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
