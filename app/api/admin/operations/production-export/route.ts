import { requireAdminPermission } from "@/lib/admin-permissions";
import { csvResponse, toCsv } from "@/lib/csv";
import { queryPostgres } from "@/lib/postgres/client";
import {
  getWeeklyWorkerSettlements,
  getWorkerProductionAccount,
} from "@/lib/production-accounting";
import { saturdayToFridayPeriod } from "@/lib/production-accounting-rules";

export const dynamic = "force-dynamic";

const exportTypes = [
  "work-orders", "work-entries", "worker-payments",
  "handovers", "qc-stock", "cost-cards", "worker-statement", "weekly-settlements",
] as const;
type ExportType = (typeof exportTypes)[number];
type ExportRow = Record<string, string | number | Date | null>;

function isExportType(value: string | null): value is ExportType {
  return exportTypes.includes(value as ExportType);
}

function rowsToCsv(rows: ExportRow[]) {
  if (rows.length === 0) return toCsv(["message"], [["No records found"]]);
  const headers = Object.keys(rows[0]);
  return toCsv(headers, rows.map((row) => headers.map((header) => {
    const value = row[header];
    return value instanceof Date ? value.toISOString() : (value ?? "");
  })));
}

async function getRows(type: ExportType) {
  if (type === "work-orders") {
    return queryPostgres<ExportRow>("production Work Order export",
      `SELECT work_order_number AS "workOrderNumber", item_name_snapshot AS "itemName",
       colour, size_breakdown::text AS "sizeBreakdown", planned_pairs AS "plannedPairs",
       due_date AS "dueDate", priority, current_stage AS "currentStage", status,
       created_by AS "createdBy", cancelled_at AS "cancelledAt",
       cancellation_reason AS "cancellationReason", created_at AS "createdAt"
       FROM production_work_orders ORDER BY created_at DESC`);
  }
  if (type === "work-entries") {
    return queryPostgres<ExportRow>("production work export",
      `SELECT entry.work_date AS "workDate", orders.work_order_number AS "workOrderNumber",
       entry.employee_id AS "employeeId", entry.employee_name_snapshot AS "workerName",
       entry.item_name_snapshot AS "itemName", entry.stage,
       entry.total_pairs AS "totalPairs", entry.rejected_pairs AS "rejectedPairs",
       entry.rate_per_pair_snapshot AS "ratePerPair", entry.earned_wage AS "earnedWage",
       entry.status, entry.approved_by AS "approvedBy", entry.created_at AS "createdAt"
       FROM production_work_entries entry
       LEFT JOIN production_work_orders orders ON orders.id = entry.work_order_id
       ORDER BY entry.work_date DESC, entry.created_at DESC`);
  }
  if (type === "worker-payments") {
    return queryPostgres<ExportRow>("production worker payment export",
      `SELECT payment_date AS "paymentDate", employee_id AS "employeeId",
       employee_name_snapshot AS "workerName", payment_type AS "paymentType",
       direction, amount, receipt_number AS "receiptNumber", approved_by AS "approvedBy",
       note, created_at AS "createdAt" FROM worker_payments WHERE reversed_at IS NULL
       ORDER BY payment_date DESC, created_at DESC`);
  }
  if (type === "handovers") {
    return queryPostgres<ExportRow>("production handover export",
      `SELECT handover_date AS "handoverDate",
       work_order_number_snapshot AS "workOrderNumber", from_stage AS "fromStage",
       to_stage AS "toStage", from_employee_name_snapshot AS "fromWorker",
       to_employee_name_snapshot AS "toWorker", sent_pairs AS "sentPairs",
       received_pairs AS "receivedPairs",
       received_size_breakdown::text AS "receivedSizeBreakdown",
       received_pairs - sent_pairs AS difference,
       approved_by AS "approvedBy", note,
       CASE WHEN reversed_at IS NULL THEN 'Active' ELSE 'Reversed' END AS status,
       reversal_reason AS "reversalReason", created_at AS "createdAt"
       FROM production_stage_handovers ORDER BY handover_date DESC, created_at DESC`);
  }
  if (type === "qc-stock") {
    return queryPostgres<ExportRow>("production QC stock export",
      `SELECT qc.qc_date AS "qcDate", qc.approval_reference AS "approvalReference",
       orders.work_order_number AS "workOrderNumber", qc.item_name_snapshot AS "itemName",
       qc.catalog_product_name_snapshot AS "catalogProduct",
       qc.packing_employee_name_snapshot AS "packingQcWorker",
       qc.total_pairs AS "goodPairs", qc.rejected_pairs AS "rejectedPairs",
       qc.stock_movement_id AS "stockMovementId", qc.approved_by AS "approvedBy",
       CASE WHEN qc.reversed_at IS NULL THEN 'Active' ELSE 'Reversed' END AS status,
       qc.reversal_reason AS "reversalReason",
       qc.reversal_stock_movement_id AS "reversalStockMovementId",
       qc.created_at AS "createdAt" FROM production_qc_postings qc
       LEFT JOIN production_work_orders orders ON orders.id = qc.work_order_id
       ORDER BY qc.qc_date DESC, qc.created_at DESC`);
  }
  return queryPostgres<ExportRow>("production cost card export",
    `SELECT effective_from AS "effectiveFrom", item_name_snapshot AS "itemName",
     material_cost_per_pair AS "materialCostPerPair", labor_cost_per_pair AS "laborCostPerPair",
     other_direct_cost_per_pair AS "otherDirectCostPerPair",
     making_cost_per_pair AS "makingCostPerPair",
     wholesale_profit_percent AS "wholesaleProfitPercent",
     wholesale_price AS "wholesalePrice", retail_extra_amount AS "retailExtraAmount",
     retail_price AS "retailPrice", approved_by AS "approvedBy", created_at AS "createdAt"
     FROM production_cost_cards ORDER BY effective_from DESC, created_at DESC`);
}

export async function GET(request: Request) {
  await requireAdminPermission("exports:read");
  const searchParams = new URL(request.url).searchParams;
  const type = searchParams.get("type");
  if (!isExportType(type)) {
    return Response.json(
      { error: "Invalid production export type.", validTypes: exportTypes },
      { status: 400 },
    );
  }

  if (type === "worker-statement") {
    const employeeId = searchParams.get("employeeId")?.trim() ?? "";
    const requestedDate = searchParams.get("date") ?? "";
    if (!employeeId || !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
      return Response.json(
        { error: "employeeId and date (YYYY-MM-DD) are required." },
        { status: 400 },
      );
    }

    const period = saturdayToFridayPeriod(requestedDate);
    const account = await getWorkerProductionAccount(employeeId, period);
    if (!account) return Response.json({ error: "Worker not found." }, { status: 404 });

    let runningBalance = account.statement.openingBalance;
    const transactions = [
      ...account.statement.work.map((row) => ({
        date: row.workDate,
        order: 0,
        kind: "Earned Wage",
        detail: `${row.itemName} / ${row.stage}`,
        pairs: row.totalPairs,
        rate: row.ratePerPair,
        earned: row.earnedWage,
        paid: 0,
        adjustment: 0,
      })),
      ...account.statement.payments.map((row) => ({
        date: row.paymentDate,
        order: 1,
        kind: row.paymentType,
        detail: `${row.direction}${row.receiptNumber ? ` / ${row.receiptNumber}` : ""}`,
        pairs: 0,
        rate: 0,
        earned: 0,
        paid: row.direction === "Paid" || row.direction === "Recovered" ? row.amount : 0,
        adjustment: row.direction === "Added" ? row.amount : 0,
      })),
    ].sort((left, right) => left.date.localeCompare(right.date) || left.order - right.order);

    const rows: Array<Array<string | number>> = [
      [period.start, "Opening Balance", account.employee.name, 0, 0, 0, 0, runningBalance],
      ...transactions.map((row) => {
        runningBalance += row.earned + row.adjustment - row.paid;
        return [
          row.date, row.kind, row.detail, row.pairs, row.rate,
          row.earned + row.adjustment, row.paid, runningBalance,
        ];
      }),
    ];
    rows.push([
      period.end, "Closing / Saturday Payable", account.employee.name,
      account.statement.pairs, 0, account.statement.earned,
      account.statement.paid, account.statement.closingBalance,
    ]);

    const csv = toCsv(
      ["date", "type", "detail", "pairs", "rate", "credit/earned", "cash paid", "balance"],
      rows,
    );
    const name = `krishoe-worker-statement-${employeeId}-${period.start}-to-${period.end}.csv`;
    return csvResponse(name, csv);
  }

  if (type === "weekly-settlements") {
    const requestedDate = searchParams.get("date") ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
      return Response.json({ error: "date (YYYY-MM-DD) is required." }, { status: 400 });
    }
    const period = saturdayToFridayPeriod(requestedDate);
    const settlements = await getWeeklyWorkerSettlements(period);
    const csv = toCsv(
      [
        "employeeId", "workerName", "periodStart", "periodEnd", "openingBalance",
        "completedPairs", "rejectedPairs", "earned", "cash/adjustment",
        "closingBalance", "saturdayPayable", "advanceRemaining",
      ],
      settlements.map((row) => [
        row.employeeId, row.employeeName, period.start, period.end, row.openingBalance,
        row.completedPairs, row.rejectedPairs, row.earned, row.paid,
        row.closingBalance, row.payable, row.advanceBalance,
      ]),
    );
    return csvResponse(
      `krishoe-saturday-payment-sheet-${period.start}-to-${period.end}.csv`,
      csv,
    );
  }

  const name = `krishoe-production-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
  return csvResponse(name, rowsToCsv(await getRows(type)));
}
