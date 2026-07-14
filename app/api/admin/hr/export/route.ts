import { requireAdminPermission } from "@/lib/admin-permissions";
import { csvResponse, toCsv } from "@/lib/csv";
import { getHrSnapshot } from "@/lib/hr";

export const dynamic = "force-dynamic";

const exportTypes = [
  "employees",
  "attendance",
  "payroll",
  "performance",
  "attendance-summary",
  "payroll-summary",
  "payroll-suggestions",
  "salary-closing",
  "fingerprint-template",
] as const;
type ExportType = (typeof exportTypes)[number];

function isExportType(value: string | null): value is ExportType {
  return exportTypes.includes(value as ExportType);
}

function datedFilename(name: string) {
  return `krishoe-hr-${name}-${new Date().toISOString().slice(0, 10)}.csv`;
}

export async function GET(request: Request) {
  await requireAdminPermission("exports:read");

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "employees";

  if (!isExportType(type)) {
    return Response.json(
      { error: "Invalid HR export type.", validTypes: exportTypes },
      { status: 400 },
    );
  }

  if (type === "fingerprint-template") {
    return csvResponse(
      datedFilename("fingerprint-template"),
      toCsv(
        [
          "fingerprintId",
          "employeeName",
          "workDate",
          "checkIn",
          "checkOut",
          "status",
          "overtimeHours",
          "note",
        ],
        [["FP-001", "Ramesh BK", new Date().toISOString().slice(0, 10), "08:55", "17:30", "Present", 1, "Device export"]],
      ),
    );
  }

  const hr = await getHrSnapshot();

  if (type === "attendance") {
    return csvResponse(
      datedFilename("attendance"),
      toCsv(
        [
          "id",
          "createdAt",
          "employeeId",
          "employeeName",
          "workDate",
          "status",
          "checkIn",
          "checkOut",
          "overtimeHours",
          "note",
        ],
        hr.attendanceRecords.map((record) => [
          record.id,
          record.createdAt,
          record.employeeId,
          record.employeeName,
          record.workDate,
          record.status,
          record.checkIn,
          record.checkOut,
          record.overtimeHours,
          record.note,
        ]),
      ),
    );
  }

  if (type === "payroll") {
    return csvResponse(
      datedFilename("payroll"),
      toCsv(
        [
          "id",
          "createdAt",
          "periodLabel",
          "employeeId",
          "employeeName",
          "baseAmount",
          "attendanceBonus",
          "pieceAmount",
          "overtimeAmount",
          "deduction",
          "netPay",
          "status",
          "paidAt",
          "note",
        ],
        hr.payrollRecords.map((record) => [
          record.id,
          record.createdAt,
          record.periodLabel,
          record.employeeId,
          record.employeeName,
          record.baseAmount,
          record.attendanceBonus,
          record.pieceAmount,
          record.overtimeAmount,
          record.deduction,
          record.netPay,
          record.status,
          record.paidAt,
          record.note,
        ]),
      ),
    );
  }

  if (type === "performance") {
    return csvResponse(
      datedFilename("performance"),
      toCsv(
        [
          "employeeId",
          "employeeName",
          "department",
          "status",
          "taskCount",
          "doneTaskCount",
          "targetPairs",
          "completedPairs",
          "progressRate",
          "attendanceDaysThisMonth",
          "payrollThisMonth",
          "piecePayEstimate",
        ],
        hr.reports.employeePerformance.map((row) => [
          row.employeeId,
          row.employeeName,
          row.department,
          row.status,
          row.taskCount,
          row.doneTaskCount,
          row.targetPairs,
          row.completedPairs,
          row.progressRate,
          row.attendanceDaysThisMonth,
          row.payrollThisMonth,
          row.piecePayEstimate,
        ]),
      ),
    );
  }

  if (type === "attendance-summary") {
    return csvResponse(
      datedFilename("attendance-summary"),
      toCsv(
        [
          "employeeId",
          "employeeName",
          "department",
          "presentDays",
          "leaveDays",
          "absentDays",
          "overtimeHours",
          "payrollNet",
          "completedPairs",
        ],
        hr.reports.monthlyAttendanceSummary.map((row) => [
          row.employeeId,
          row.employeeName,
          row.department,
          row.presentDays,
          row.leaveDays,
          row.absentDays,
          row.overtimeHours,
          row.payrollNet,
          row.completedPairs,
        ]),
      ),
    );
  }

  if (type === "payroll-summary") {
    return csvResponse(
      datedFilename("payroll-summary"),
      toCsv(
        [
          "id",
          "employeeId",
          "employeeName",
          "periodLabel",
          "grossPay",
          "deduction",
          "netPay",
          "status",
        ],
        hr.reports.monthlyPayrollSummary.map((row) => [
          row.id,
          row.employeeId,
          row.employeeName,
          row.periodLabel,
          row.grossPay,
          row.deduction,
          row.netPay,
          row.status,
        ]),
      ),
    );
  }

  if (type === "payroll-suggestions") {
    return csvResponse(
      datedFilename("payroll-suggestions"),
      toCsv(
        [
          "employeeId",
          "employeeName",
          "department",
          "salaryType",
          "periodLabel",
          "presentDays",
          "leaveDays",
          "absentDays",
          "overtimeHours",
          "completedPairs",
          "baseAmount",
          "attendanceBonus",
          "pieceAmount",
          "overtimeAmount",
          "deduction",
          "netPay",
          "hasPayroll",
          "statusSignal",
          "note",
        ],
        hr.reports.payrollSuggestions.map((row) => [
          row.employeeId,
          row.employeeName,
          row.department,
          row.salaryType,
          row.periodLabel,
          row.presentDays,
          row.leaveDays,
          row.absentDays,
          row.overtimeHours,
          row.completedPairs,
          row.baseAmount,
          row.attendanceBonus,
          row.pieceAmount,
          row.overtimeAmount,
          row.deduction,
          row.netPay,
          row.hasPayroll ? "yes" : "no",
          row.statusSignal,
          row.note,
        ]),
      ),
    );
  }

  if (type === "salary-closing") {
    return csvResponse(
      datedFilename("salary-closing"),
      toCsv(
        [
          "employeeId",
          "employeeName",
          "department",
          "salaryType",
          "periodLabel",
          "attendanceDays",
          "completedPairs",
          "suggestedNetPay",
          "recordedNetPay",
          "paidNetPay",
          "draftNetPay",
          "variance",
          "statusSignal",
        ],
        hr.reports.monthlySalaryClosing.map((row) => [
          row.employeeId,
          row.employeeName,
          row.department,
          row.salaryType,
          row.periodLabel,
          row.attendanceDays,
          row.completedPairs,
          row.suggestedNetPay,
          row.recordedNetPay,
          row.paidNetPay,
          row.draftNetPay,
          row.variance,
          row.statusSignal,
        ]),
      ),
    );
  }

  return csvResponse(
    datedFilename("employees"),
    toCsv(
      [
        "id",
        "createdAt",
        "name",
        "phone",
        "role",
        "department",
        "employmentType",
        "salaryType",
        "baseSalary",
        "dailyWage",
        "pieceRate",
        "status",
        "joinedAt",
        "fingerprintId",
        "note",
      ],
      hr.employees.map((employee) => [
        employee.id,
        employee.createdAt,
        employee.name,
        employee.phone,
        employee.role,
        employee.department,
        employee.employmentType,
        employee.salaryType,
        employee.baseSalary,
        employee.dailyWage,
        employee.pieceRate,
        employee.status,
        employee.joinedAt,
        employee.fingerprintId,
        employee.note,
      ]),
    ),
  );
}
