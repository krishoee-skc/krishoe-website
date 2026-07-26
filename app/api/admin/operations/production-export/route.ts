import { requireAdminPermission } from "@/lib/admin-permissions";
import { csvResponse, toCsv } from "@/lib/csv";
import { queryPostgres } from "@/lib/postgres/client";

export const dynamic = "force-dynamic";

const exportTypes = [
  "work-orders", "work-entries", "worker-payments",
  "handovers", "qc-stock", "cost-cards",
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
       created_by AS "createdBy", created_at AS "createdAt"
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
       received_pairs AS "receivedPairs", received_pairs - sent_pairs AS difference,
       approved_by AS "approvedBy", note, created_at AS "createdAt"
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
  const type = new URL(request.url).searchParams.get("type");
  if (!isExportType(type)) {
    return Response.json(
      { error: "Invalid production export type.", validTypes: exportTypes },
      { status: 400 },
    );
  }
  const name = `krishoe-production-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
  return csvResponse(name, rowsToCsv(await getRows(type)));
}
