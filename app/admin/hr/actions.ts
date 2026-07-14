"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import {
  addAttendanceRecord,
  addEmployee,
  addPayrollRecord,
  deleteHrRecord,
  hrDepartments,
  importFingerprintAttendanceCsv,
  updateEmployee,
  updateEmployeeStatus,
  updatePayrollStatus,
  type AttendanceStatus,
  type EmployeeStatus,
  type EmploymentType,
  type HrRecordKind,
  type PayrollStatus,
  type SalaryType,
} from "@/lib/hr";

const employmentTypes: EmploymentType[] = ["Full Time", "Part Time", "Contract"];
const salaryTypes: SalaryType[] = ["Monthly", "Daily", "Piece Rate"];
const employeeStatuses: EmployeeStatus[] = ["Active", "Inactive"];
const attendanceStatuses: AttendanceStatus[] = ["Present", "Half Day", "Leave", "Absent"];
const payrollCreateStatuses: PayrollStatus[] = ["Draft", "Approved", "Paid"];
const payrollUpdateStatuses: PayrollStatus[] = ["Draft", "Approved", "Paid", "Locked"];
const hrRecordKinds: HrRecordKind[] = ["employee", "attendance", "payroll"];

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(formData: FormData, key: string) {
  const numeric = Number(textValue(formData, key));
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric * 100) / 100) : 0;
}

function optionValue<T extends string>(value: string, options: readonly T[], fallback: T) {
  return options.includes(value as T) ? (value as T) : fallback;
}

function hrNextPath(formData: FormData) {
  const nextPath = textValue(formData, "nextPath");

  if (nextPath.startsWith("/admin/hr") && !nextPath.startsWith("//")) {
    return nextPath;
  }

  return "/admin/hr";
}

function refreshHrPage(nextPath = "/admin/hr") {
  revalidatePath("/admin");
  revalidatePath("/admin/hr");
  revalidatePath(nextPath.split("?")[0] || "/admin/hr");
  redirect(nextPath);
}

function employeeInputFromForm(formData: FormData) {
  return {
    name: textValue(formData, "name"),
    phone: textValue(formData, "phone"),
    role: textValue(formData, "role"),
    department: optionValue(textValue(formData, "department"), hrDepartments, "Cutting"),
    employmentType: optionValue(textValue(formData, "employmentType"), employmentTypes, "Full Time"),
    salaryType: optionValue(textValue(formData, "salaryType"), salaryTypes, "Monthly"),
    baseSalary: numberValue(formData, "baseSalary"),
    dailyWage: numberValue(formData, "dailyWage"),
    pieceRate: numberValue(formData, "pieceRate"),
    status: optionValue(textValue(formData, "status"), employeeStatuses, "Active"),
    joinedAt: textValue(formData, "joinedAt") || new Date().toISOString().slice(0, 10),
    fingerprintId: textValue(formData, "fingerprintId"),
    note: textValue(formData, "note"),
  };
}

export async function createEmployeeAction(formData: FormData) {
  await requireAdminPermission("hr:write");

  const input = employeeInputFromForm(formData);

  if (!input.name) {
    throw new Error("Employee name is required.");
  }

  const employee = await addEmployee(input);

  await appendAdminAuditEvent("hr_employee_create", `Employee ${employee.name} created.`).catch(
    () => undefined,
  );

  refreshHrPage(hrNextPath(formData));
}

export async function updateEmployeeAction(formData: FormData) {
  await requireAdminPermission("hr:write");

  const id = textValue(formData, "id");
  const input = employeeInputFromForm(formData);

  if (!id || !input.name) {
    throw new Error("Employee id and name are required.");
  }

  const employee = await updateEmployee(id, input);
  await appendAdminAuditEvent("hr_employee_update", `Employee ${employee.name} updated.`).catch(
    () => undefined,
  );

  refreshHrPage(hrNextPath(formData));
}

export async function updateEmployeeStatusAction(formData: FormData) {
  await requireAdminPermission("hr:write");

  const id = textValue(formData, "id");
  const status = optionValue(textValue(formData, "status"), employeeStatuses, "Active");

  if (!id) {
    throw new Error("Employee id is required.");
  }

  const employee = await updateEmployeeStatus(id, status);
  await appendAdminAuditEvent(
    "hr_employee_status_update",
    `Employee ${employee.name} marked ${employee.status}.`,
  ).catch(() => undefined);

  refreshHrPage(hrNextPath(formData));
}

export async function createAttendanceAction(formData: FormData) {
  await requireAdminPermission("hr:write");

  const employeeId = textValue(formData, "employeeId");

  if (!employeeId) {
    throw new Error("Employee is required.");
  }

  const attendance = await addAttendanceRecord({
    employeeId,
    workDate: textValue(formData, "workDate") || new Date().toISOString().slice(0, 10),
    status: optionValue(textValue(formData, "status"), attendanceStatuses, "Present"),
    checkIn: textValue(formData, "checkIn"),
    checkOut: textValue(formData, "checkOut"),
    overtimeHours: numberValue(formData, "overtimeHours"),
    note: textValue(formData, "note"),
  });

  await appendAdminAuditEvent(
    "hr_attendance_record",
    `${attendance.employeeName} attendance marked ${attendance.status} for ${attendance.workDate}.`,
  ).catch(() => undefined);

  refreshHrPage(hrNextPath(formData));
}

export async function importFingerprintAttendanceAction(formData: FormData) {
  await requireAdminPermission("hr:write");

  const csv = textValue(formData, "csv");

  if (!csv) {
    throw new Error("Fingerprint attendance CSV is required.");
  }

  const result = await importFingerprintAttendanceCsv(csv);
  const errorPreview = result.errors.slice(0, 5).join(" | ");

  await appendAdminAuditEvent(
    "hr_fingerprint_attendance_import",
    `Fingerprint attendance import: ${result.imported} days imported, ${result.skipped} rows skipped, ${result.matchedByFingerprint} fingerprint matches, ${result.matchedByName} name matches.${errorPreview ? ` Errors: ${errorPreview}` : ""}`,
    result.skipped > 0 || result.errors.length > 0 ? "warning" : "success",
  ).catch(() => undefined);

  const feedback = new URLSearchParams({
    hrImport: "1",
    imported: String(result.imported),
    skipped: String(result.skipped),
    fingerprint: String(result.matchedByFingerprint),
    name: String(result.matchedByName),
    status: result.skipped > 0 || result.errors.length > 0 ? "warning" : "success",
    errorCount: String(result.errors.length),
    errors: errorPreview.slice(0, 700),
  });

  refreshHrPage(`/admin/hr?${feedback.toString()}`);
}

export async function updatePayrollStatusAction(formData: FormData) {
  await requireAdminPermission("hr:write");

  const id = textValue(formData, "id");
  const status = optionValue(textValue(formData, "status"), payrollUpdateStatuses, "Draft");

  if (!id) {
    throw new Error("Payroll id is required.");
  }

  const payroll = await updatePayrollStatus(id, status);
  await appendAdminAuditEvent(
    "hr_payroll_status_update",
    `${payroll.periodLabel} payroll for ${payroll.employeeName} marked ${payroll.status}.`,
  ).catch(() => undefined);

  refreshHrPage(hrNextPath(formData));
}

export async function deleteHrRecordAction(formData: FormData) {
  await requireAdminPermission("hr:write");

  const id = textValue(formData, "id");
  const kind = optionValue(textValue(formData, "kind"), hrRecordKinds, "attendance");

  if (!id) {
    throw new Error("HR record id is required.");
  }

  await deleteHrRecord(kind, id);
  await appendAdminAuditEvent("hr_record_delete", `${kind} ${id} deleted.`).catch(
    () => undefined,
  );

  refreshHrPage(hrNextPath(formData));
}
export async function createPayrollAction(formData: FormData) {
  await requireAdminPermission("hr:write");

  const employeeId = textValue(formData, "employeeId");
  const periodLabel = textValue(formData, "periodLabel") || new Date().toISOString().slice(0, 7);

  if (!employeeId) {
    throw new Error("Employee is required.");
  }

  const payroll = await addPayrollRecord({
    periodLabel,
    employeeId,
    baseAmount: numberValue(formData, "baseAmount"),
    attendanceBonus: numberValue(formData, "attendanceBonus"),
    pieceAmount: numberValue(formData, "pieceAmount"),
    overtimeAmount: numberValue(formData, "overtimeAmount"),
    deduction: numberValue(formData, "deduction"),
    status: optionValue(textValue(formData, "status"), payrollCreateStatuses, "Draft"),
    paidAt: textValue(formData, "paidAt"),
    note: textValue(formData, "note"),
  });

  await appendAdminAuditEvent(
    "hr_payroll_record",
    `${payroll.periodLabel} payroll recorded for ${payroll.employeeName}: Rs. ${payroll.netPay}.`,
  ).catch(() => undefined);

  refreshHrPage(hrNextPath(formData));
}
