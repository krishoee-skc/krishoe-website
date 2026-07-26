import { getHrData, type Employee } from "@/lib/hr";
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

type ItemRow = {
  id: string;
  name: string;
  category: string;
  production_type: ProductionItem["productionType"];
  size_group: ProductionItem["sizeGroup"];
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
  const [items, rates, workEntries, balances, hr] = await Promise.all([
    queryPostgres<ItemRow>(
      "production items",
      `SELECT id, name, category, production_type, size_group, status
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
  ]);

  return {
    items: items.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      productionType: row.production_type,
      sizeGroup: row.size_group,
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
    balances: balances.map((row) => ({
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      earned: numeric(row.earned),
      paid: numeric(row.paid),
      balance: numeric(row.balance),
    })),
    employees: hr.employees.filter((employee) => employee.status === "Active"),
  };
}

export async function addProductionItem(input: Omit<ProductionItem, "id" | "status">) {
  const rows = await queryPostgres<ItemRow>(
    "create production item",
    `INSERT INTO production_items
       (id, name, category, production_type, size_group, status)
     VALUES ($1, $2, $3, $4, $5, 'Active')
     RETURNING id, name, category, production_type, size_group, status`,
    [id("pitem"), input.name, input.category, input.productionType, input.sizeGroup],
  );
  return rows[0];
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
      `SELECT id, name, category, production_type, size_group, status
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
