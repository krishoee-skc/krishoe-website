import { readFile } from "node:fs/promises";
import { writeFileAtomic } from "@/lib/atomic-json";
import path from "node:path";
import { csvRecords } from "@/lib/csv";
import { runWithDataBackend } from "@/lib/data-backend";
import { getOperationsData, type WorkerTask } from "@/lib/operations";
import { queryPostgres, transactionPostgres } from "@/lib/postgres/client";

export const hrDepartments = [
  "Cutting",
  "Stitching",
  "Sole Press",
  "Finishing",
  "Packing",
  "QC",
  "Administration",
  "Sales",
  "Marketing",
  "Dispatch",
] as const;

export type HrDepartment = (typeof hrDepartments)[number];
export type EmployeeStatus = "Active" | "Inactive";
export type EmploymentType = "Full Time" | "Part Time" | "Contract";
export type SalaryType = "Monthly" | "Daily" | "Piece Rate";
export type AttendanceStatus = "Present" | "Half Day" | "Leave" | "Absent";
export type PayrollStatus = "Draft" | "Approved" | "Paid" | "Locked";

export type Employee = {
  id: string;
  createdAt: string;
  name: string;
  phone: string;
  role: string;
  department: HrDepartment;
  employmentType: EmploymentType;
  salaryType: SalaryType;
  baseSalary: number;
  dailyWage: number;
  pieceRate: number;
  status: EmployeeStatus;
  joinedAt: string;
  fingerprintId: string;
  note: string;
};

export type AttendanceRecord = {
  id: string;
  createdAt: string;
  employeeId: string;
  employeeName: string;
  workDate: string;
  status: AttendanceStatus;
  checkIn: string;
  checkOut: string;
  overtimeHours: number;
  note: string;
};

export type PayrollRecord = {
  id: string;
  createdAt: string;
  periodLabel: string;
  employeeId: string;
  employeeName: string;
  baseAmount: number;
  attendanceBonus: number;
  pieceAmount: number;
  overtimeAmount: number;
  deduction: number;
  netPay: number;
  status: PayrollStatus;
  paidAt: string;
  note: string;
};

export type HrData = {
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  payrollRecords: PayrollRecord[];
};

export type CreateEmployeeInput = Omit<Employee, "id" | "createdAt">;
export type UpdateEmployeeInput = Omit<Employee, "id" | "createdAt">;
export type CreateAttendanceInput = Omit<AttendanceRecord, "id" | "createdAt" | "employeeName">;
export type CreatePayrollInput = Omit<PayrollRecord, "id" | "createdAt" | "employeeName" | "netPay">;
export type HrRecordKind = "employee" | "attendance" | "payroll";

export type EmployeePerformanceRow = {
  employeeId: string;
  employeeName: string;
  department: HrDepartment | "Unregistered";
  status: EmployeeStatus | "Unregistered";
  taskCount: number;
  doneTaskCount: number;
  targetPairs: number;
  completedPairs: number;
  progressRate: number;
  attendanceDaysThisMonth: number;
  payrollThisMonth: number;
  piecePayEstimate: number;
};

export type PayrollSuggestionRow = {
  employeeId: string;
  employeeName: string;
  department: HrDepartment;
  salaryType: SalaryType;
  periodLabel: string;
  presentDays: number;
  leaveDays: number;
  absentDays: number;
  overtimeHours: number;
  completedPairs: number;
  baseAmount: number;
  attendanceBonus: number;
  pieceAmount: number;
  overtimeAmount: number;
  deduction: number;
  netPay: number;
  hasPayroll: boolean;
  statusSignal: "Ready" | "Recorded" | "Needs attendance";
  note: string;
};

export type MonthlySalaryClosingRow = {
  employeeId: string;
  employeeName: string;
  department: HrDepartment;
  salaryType: SalaryType;
  periodLabel: string;
  attendanceDays: number;
  completedPairs: number;
  suggestedNetPay: number;
  recordedNetPay: number;
  paidNetPay: number;
  draftNetPay: number;
  variance: number;
  statusSignal: "Closed" | "Payment pending" | "Missing payroll" | "Review variance";
};

export type EmployeeHrDetail = {
  employee: Employee;
  attendanceRecords: AttendanceRecord[];
  payrollRecords: PayrollRecord[];
  workerTasks: WorkerTask[];
  payrollSuggestion: PayrollSuggestionRow;
  summary: {
    attendanceDays: number;
    presentRecords: number;
    leaveDays: number;
    absentDays: number;
    overtimeHours: number;
    targetPairs: number;
    completedPairs: number;
    progressRate: number;
    grossPay: number;
    netPay: number;
    draftPay: number;
  };
};

export type FingerprintAttendanceImportResult = {
  imported: number;
  skipped: number;
  matchedByFingerprint: number;
  matchedByName: number;
  errors: string[];
};

type EmployeeRow = {
  id: string;
  created_at: Date | string;
  name: string;
  phone: string;
  role: string;
  department: HrDepartment;
  employment_type: EmploymentType;
  salary_type: SalaryType;
  base_salary: number | string;
  daily_wage: number | string;
  piece_rate: number | string;
  status: EmployeeStatus;
  joined_at: Date | string;
  fingerprint_id: string;
  note: string;
};

type AttendanceRow = {
  id: string;
  created_at: Date | string;
  employee_id: string;
  employee_name: string;
  work_date: Date | string;
  status: AttendanceStatus;
  check_in: string;
  check_out: string;
  overtime_hours: number | string;
  note: string;
};

type PayrollRow = {
  id: string;
  created_at: Date | string;
  period_label: string;
  employee_id: string;
  employee_name: string;
  base_amount: number | string;
  attendance_bonus: number | string;
  piece_amount: number | string;
  overtime_amount: number | string;
  deduction: number | string;
  net_pay: number | string;
  status: PayrollStatus;
  paid_at: Date | string | null;
  note: string;
};

const dataDirectory = path.join(process.cwd(), "data");
const hrPath = path.join(dataDirectory, "hr.json");

const seedHr: HrData = {
  employees: [],
  attendanceRecords: [],
  payrollRecords: [],
};

function createId(prefix: string) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `${prefix}-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric * 100) / 100) : 0;
}

function cleanMoney(value: unknown) {
  return Math.round(cleanNumber(value));
}

function isoDate(value: unknown) {
  if (!value) {
    return new Date().toISOString();
  }

  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function dateOnly(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}

function optionValue<T extends string>(value: unknown, options: readonly T[], fallback: T) {
  return options.includes(value as T) ? (value as T) : fallback;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey() {
  return new Date().toISOString().slice(0, 7);
}

function employeeKey(value: string) {
  return value.trim().toLowerCase();
}

function recordValue(record: Record<string, string>, aliases: string[]) {
  const normalized = new Map(
    Object.entries(record).map(([key, value]) => [
      key.trim().toLowerCase().replace(/[\s_-]+/g, ""),
      value.trim(),
    ]),
  );

  for (const alias of aliases) {
    const value = normalized.get(alias.toLowerCase().replace(/[\s_-]+/g, ""));

    if (value) {
      return value;
    }
  }

  return "";
}

function timeOnly(value: string) {
  const text = value.trim();

  if (!text) {
    return "";
  }

  const match = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?\s*([AP]M)?\b/i);

  if (match) {
    let hour = Number(match[1]);
    const suffix = match[3]?.toUpperCase();

    if (suffix === "AM" && hour === 12) {
      hour = 0;
    }

    if (suffix === "PM" && hour < 12) {
      hour += 12;
    }

    return `${String(hour).padStart(2, "0")}:${match[2]}`;
  }

  const compact = text.match(/\b([01]\d|2[0-3])([0-5]\d)\b/);

  if (compact) {
    return `${compact[1]}:${compact[2]}`;
  }

  const date = new Date(text);
  return !Number.isNaN(date.getTime()) && /\d{4}|\//.test(text)
    ? date.toISOString().slice(11, 16)
    : text.slice(0, 5);
}

function dateOnlyFromImport(value: string) {
  const text = value.trim();

  if (!text) {
    return "";
  }

  const iso = text.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);

  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }

  const dayFirst = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/);

  if (dayFirst) {
    return `${dayFirst[3]}-${dayFirst[2].padStart(2, "0")}-${dayFirst[1].padStart(2, "0")}`;
  }

  return "";
}

function statusFromImport(value: string): AttendanceStatus {
  const normalized = value.trim().toLowerCase();

  if (normalized.includes("half")) return "Half Day";
  if (normalized.includes("leave")) return "Leave";
  if (normalized.includes("absent")) return "Absent";
  return "Present";
}

function sum<T>(items: T[], selector: (item: T) => number) {
  return items.reduce((total, item) => total + selector(item), 0);
}

function percentage(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.min(999, Math.round((value / total) * 100));
}

function attendanceDayValue(record: AttendanceRecord) {
  if (record.status === "Present") return 1;
  if (record.status === "Half Day") return 0.5;
  return 0;
}

function grossPay(record: PayrollRecord) {
  return record.baseAmount + record.attendanceBonus + record.pieceAmount + record.overtimeAmount;
}

function payrollPaidAtForStatus(status: PayrollStatus, currentPaidAt = "") {
  if (status === "Paid" || status === "Locked") {
    return currentPaidAt || new Date().toISOString();
  }

  return "";
}

export function assertPayrollCanMove(current: PayrollRecord, nextStatus: PayrollStatus) {
  if (current.status === "Locked" && nextStatus !== "Locked") {
    throw new Error("Locked payroll cannot be changed.");
  }

  if (nextStatus === "Locked" && current.status !== "Paid" && current.status !== "Locked") {
    throw new Error("Payroll must be paid before locking.");
  }
}

export function assertPayrollCanDelete(record: PayrollRecord) {
  if (record.status === "Locked") {
    throw new Error("Locked payroll cannot be deleted.");
  }
}

// Exported for tests: this is the money math, and it is worth pinning down.
export function employeeDailyRate(employee: Employee) {
  if (employee.dailyWage > 0) {
    return employee.dailyWage;
  }

  return employee.baseSalary > 0 ? Math.round(employee.baseSalary / 26) : 0;
}

export function buildPayrollSuggestion({
  employee,
  attendanceRecords,
  payrollRecords,
  workerTasks,
  periodLabel,
}: {
  employee: Employee;
  attendanceRecords: AttendanceRecord[];
  payrollRecords: PayrollRecord[];
  workerTasks: WorkerTask[];
  periodLabel: string;
}): PayrollSuggestionRow {
  const presentDays = sum(attendanceRecords, attendanceDayValue);
  const leaveDays = attendanceRecords.filter((record) => record.status === "Leave").length;
  const absentDays = attendanceRecords.filter((record) => record.status === "Absent").length;
  const overtimeHours = sum(attendanceRecords, (record) => record.overtimeHours);
  const completedPairs = sum(workerTasks, (task) => task.completedPairs);
  const dailyRate = employeeDailyRate(employee);
  const hourlyRate = dailyRate > 0 ? dailyRate / 8 : 0;
  const baseAmount =
    employee.salaryType === "Monthly"
      ? employee.baseSalary
      : employee.salaryType === "Daily"
        ? Math.round(presentDays * dailyRate)
        : 0;
  const pieceAmount = Math.round(completedPairs * employee.pieceRate);
  const overtimeAmount = Math.round(overtimeHours * hourlyRate);
  const deduction = employee.salaryType === "Monthly" ? Math.round(absentDays * dailyRate) : 0;
  const netPay = Math.max(0, baseAmount + pieceAmount + overtimeAmount - deduction);
  const hasPayroll = payrollRecords.some((record) => record.periodLabel.startsWith(periodLabel));

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    department: employee.department,
    salaryType: employee.salaryType,
    periodLabel,
    presentDays,
    leaveDays,
    absentDays,
    overtimeHours,
    completedPairs,
    baseAmount,
    attendanceBonus: 0,
    pieceAmount,
    overtimeAmount,
    deduction,
    netPay,
    hasPayroll,
    statusSignal: hasPayroll ? "Recorded" : presentDays > 0 || completedPairs > 0 ? "Ready" : "Needs attendance",
    note: `Auto draft from ${periodLabel}: ${presentDays} attendance day(s), ${completedPairs} pair(s), ${overtimeHours} OT hour(s).`,
  };
}

function buildMonthlySalaryClosingRow({
  suggestion,
  payrollRecords,
}: {
  suggestion: PayrollSuggestionRow;
  payrollRecords: PayrollRecord[];
}): MonthlySalaryClosingRow {
  const recordedNetPay = sum(payrollRecords, (record) => record.netPay);
  const paidNetPay = sum(
    payrollRecords.filter((record) => record.status === "Paid" || record.status === "Locked"),
    (record) => record.netPay,
  );
  const draftNetPay = sum(
    payrollRecords.filter((record) => record.status === "Draft" || record.status === "Approved"),
    (record) => record.netPay,
  );
  const variance = recordedNetPay - suggestion.netPay;
  const statusSignal =
    payrollRecords.length === 0
      ? "Missing payroll"
      : draftNetPay > 0
        ? "Payment pending"
        : Math.abs(variance) > 1
          ? "Review variance"
          : "Closed";

  return {
    employeeId: suggestion.employeeId,
    employeeName: suggestion.employeeName,
    department: suggestion.department,
    salaryType: suggestion.salaryType,
    periodLabel: suggestion.periodLabel,
    attendanceDays: suggestion.presentDays,
    completedPairs: suggestion.completedPairs,
    suggestedNetPay: suggestion.netPay,
    recordedNetPay,
    paidNetPay,
    draftNetPay,
    variance,
    statusSignal,
  };
}

function normalizeEmployee(employee: Partial<Employee>): Employee {
  return {
    id: cleanText(employee.id) || createId("EMP"),
    createdAt: isoDate(employee.createdAt),
    name: cleanText(employee.name),
    phone: cleanText(employee.phone),
    role: cleanText(employee.role),
    department: optionValue(employee.department, hrDepartments, "Cutting"),
    employmentType: optionValue(employee.employmentType, ["Full Time", "Part Time", "Contract"], "Full Time"),
    salaryType: optionValue(employee.salaryType, ["Monthly", "Daily", "Piece Rate"], "Monthly"),
    baseSalary: cleanMoney(employee.baseSalary),
    dailyWage: cleanMoney(employee.dailyWage),
    pieceRate: cleanNumber(employee.pieceRate),
    status: optionValue(employee.status, ["Active", "Inactive"], "Active"),
    joinedAt: dateOnly(employee.joinedAt),
    fingerprintId: cleanText(employee.fingerprintId),
    note: cleanText(employee.note),
  };
}

function normalizeAttendance(record: Partial<AttendanceRecord>): AttendanceRecord {
  return {
    id: cleanText(record.id) || createId("ATT"),
    createdAt: isoDate(record.createdAt),
    employeeId: cleanText(record.employeeId),
    employeeName: cleanText(record.employeeName),
    workDate: dateOnly(record.workDate),
    status: optionValue(record.status, ["Present", "Half Day", "Leave", "Absent"], "Present"),
    checkIn: cleanText(record.checkIn),
    checkOut: cleanText(record.checkOut),
    overtimeHours: cleanNumber(record.overtimeHours),
    note: cleanText(record.note),
  };
}

export function normalizePayroll(record: Partial<PayrollRecord>): PayrollRecord {
  const baseAmount = cleanMoney(record.baseAmount);
  const attendanceBonus = cleanMoney(record.attendanceBonus);
  const pieceAmount = cleanMoney(record.pieceAmount);
  const overtimeAmount = cleanMoney(record.overtimeAmount);
  const deduction = cleanMoney(record.deduction);

  return {
    id: cleanText(record.id) || createId("PAY"),
    createdAt: isoDate(record.createdAt),
    periodLabel: cleanText(record.periodLabel) || monthKey(),
    employeeId: cleanText(record.employeeId),
    employeeName: cleanText(record.employeeName),
    baseAmount,
    attendanceBonus,
    pieceAmount,
    overtimeAmount,
    deduction,
    netPay: Math.max(0, baseAmount + attendanceBonus + pieceAmount + overtimeAmount - deduction),
    status: optionValue(record.status, ["Draft", "Approved", "Paid", "Locked"], "Draft"),
    paidAt: cleanText(record.paidAt),
    note: cleanText(record.note),
  };
}

function normalizeHrData(data: Partial<HrData>): HrData {
  return {
    employees: (data.employees ?? seedHr.employees).map(normalizeEmployee),
    attendanceRecords: (data.attendanceRecords ?? seedHr.attendanceRecords).map(normalizeAttendance),
    payrollRecords: (data.payrollRecords ?? seedHr.payrollRecords).map(normalizePayroll),
  };
}

async function getHrDataFromLocalJson() {
  try {
    const raw = await readFile(hrPath, "utf8");
    return normalizeHrData(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return seedHr;
    }

    throw error;
  }
}

async function writeHrData(data: HrData) {
  await writeFileAtomic(hrPath, `${JSON.stringify(data, null, 2)}\n`);
}

function employeeFromRow(row: EmployeeRow): Employee {
  return normalizeEmployee({
    id: row.id,
    createdAt: isoDate(row.created_at),
    name: row.name,
    phone: row.phone,
    role: row.role,
    department: row.department,
    employmentType: row.employment_type,
    salaryType: row.salary_type,
    baseSalary: cleanMoney(row.base_salary),
    dailyWage: cleanMoney(row.daily_wage),
    pieceRate: cleanNumber(row.piece_rate),
    status: row.status,
    joinedAt: dateOnly(row.joined_at),
    fingerprintId: row.fingerprint_id,
    note: row.note,
  });
}

function attendanceFromRow(row: AttendanceRow): AttendanceRecord {
  return normalizeAttendance({
    id: row.id,
    createdAt: isoDate(row.created_at),
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    workDate: dateOnly(row.work_date),
    status: row.status,
    checkIn: row.check_in,
    checkOut: row.check_out,
    overtimeHours: cleanNumber(row.overtime_hours),
    note: row.note,
  });
}

function payrollFromRow(row: PayrollRow): PayrollRecord {
  return normalizePayroll({
    id: row.id,
    createdAt: isoDate(row.created_at),
    periodLabel: row.period_label,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    baseAmount: cleanMoney(row.base_amount),
    attendanceBonus: cleanMoney(row.attendance_bonus),
    pieceAmount: cleanMoney(row.piece_amount),
    overtimeAmount: cleanMoney(row.overtime_amount),
    deduction: cleanMoney(row.deduction),
    status: row.status,
    paidAt: row.paid_at ? isoDate(row.paid_at) : "",
    note: row.note,
  });
}

async function getHrDataFromPostgres(): Promise<HrData> {
  const [employees, attendanceRecords, payrollRecords] = await Promise.all([
    queryPostgres<EmployeeRow>(
      "HR",
      `
        SELECT id, created_at, name, phone, role, department, employment_type,
          salary_type, base_salary, daily_wage, piece_rate, status, joined_at,
          fingerprint_id, note
        FROM hr_employees
        ORDER BY status ASC, name ASC
      `,
    ),
    queryPostgres<AttendanceRow>(
      "HR",
      `
        SELECT id, created_at, employee_id, employee_name, work_date, status,
          check_in, check_out, overtime_hours, note
        FROM hr_attendance
        ORDER BY work_date DESC, created_at DESC
      `,
    ),
    queryPostgres<PayrollRow>(
      "HR",
      `
        SELECT id, created_at, period_label, employee_id, employee_name,
          base_amount, attendance_bonus, piece_amount, overtime_amount, deduction,
          net_pay, status, paid_at, note
        FROM hr_payroll
        ORDER BY created_at DESC
      `,
    ),
  ]);

  return {
    employees: employees.map(employeeFromRow),
    attendanceRecords: attendanceRecords.map(attendanceFromRow),
    payrollRecords: payrollRecords.map(payrollFromRow),
  };
}

async function addEmployeeToPostgres(employee: Employee) {
  const rows = await queryPostgres<EmployeeRow>(
    "HR",
    `
      INSERT INTO hr_employees (
        id, created_at, name, phone, role, department, employment_type,
        salary_type, base_salary, daily_wage, piece_rate, status, joined_at,
        fingerprint_id, note
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id, created_at, name, phone, role, department, employment_type,
        salary_type, base_salary, daily_wage, piece_rate, status, joined_at,
        fingerprint_id, note
    `,
    [
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
    ],
  );

  return employeeFromRow(rows[0]);
}

async function updateEmployeeToPostgres(id: string, employee: Employee) {
  return transactionPostgres("HR", async (db) => {
    const rows = await db.query<EmployeeRow>(
      `
        UPDATE hr_employees
        SET name = $2,
          phone = $3,
          role = $4,
          department = $5,
          employment_type = $6,
          salary_type = $7,
          base_salary = $8,
          daily_wage = $9,
          piece_rate = $10,
          status = $11,
          joined_at = $12,
          fingerprint_id = $13,
          note = $14
        WHERE id = $1
        RETURNING id, created_at, name, phone, role, department, employment_type,
          salary_type, base_salary, daily_wage, piece_rate, status, joined_at,
          fingerprint_id, note
      `,
      [
        id,
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
      ],
    );

    if (!rows[0]) {
      throw new Error("Employee was not found.");
    }

    await db.query("UPDATE hr_attendance SET employee_name = $2 WHERE employee_id = $1", [
      id,
      rows[0].name,
    ]);
    await db.query("UPDATE hr_payroll SET employee_name = $2 WHERE employee_id = $1", [
      id,
      rows[0].name,
    ]);

    return employeeFromRow(rows[0]);
  });
}

async function updateEmployeeStatusToPostgres(id: string, status: EmployeeStatus) {
  const rows = await queryPostgres<EmployeeRow>(
    "HR",
    `
      UPDATE hr_employees
      SET status = $2
      WHERE id = $1
      RETURNING id, created_at, name, phone, role, department, employment_type,
        salary_type, base_salary, daily_wage, piece_rate, status, joined_at,
        fingerprint_id, note
    `,
    [id, status],
  );

  if (!rows[0]) {
    throw new Error("Employee was not found.");
  }

  return employeeFromRow(rows[0]);
}

async function updatePayrollStatusToPostgres(id: string, status: PayrollStatus) {
  return transactionPostgres("HR", async (db) => {
    const currentRows = await db.query<PayrollRow>(
      `
        SELECT id, created_at, period_label, employee_id, employee_name,
          base_amount, attendance_bonus, piece_amount, overtime_amount, deduction,
          net_pay, status, paid_at, note
        FROM hr_payroll
        WHERE id = $1
        FOR UPDATE
      `,
      [id],
    );

    if (!currentRows[0]) {
      throw new Error("Payroll record was not found.");
    }

    const current = payrollFromRow(currentRows[0]);
    assertPayrollCanMove(current, status);
    const paidAt = payrollPaidAtForStatus(status, current.paidAt);
    const rows = await db.query<PayrollRow>(
      `
        UPDATE hr_payroll
        SET status = $2,
          paid_at = $3
        WHERE id = $1
        RETURNING id, created_at, period_label, employee_id, employee_name,
          base_amount, attendance_bonus, piece_amount, overtime_amount, deduction,
          net_pay, status, paid_at, note
      `,
      [id, status, paidAt || null],
    );

    return payrollFromRow(rows[0]);
  });
}

async function deleteHrRecordFromPostgres(kind: HrRecordKind, id: string) {
  const tableByKind: Record<HrRecordKind, string> = {
    employee: "hr_employees",
    attendance: "hr_attendance",
    payroll: "hr_payroll",
  };

  return transactionPostgres("HR", async (db) => {
    if (kind === "employee") {
      const lockedPayrollRows = await db.query<{ id: string }>(
        "SELECT id FROM hr_payroll WHERE employee_id = $1 AND status = 'Locked' LIMIT 1",
        [id],
      );

      if (lockedPayrollRows[0]) {
        throw new Error("Employee with locked payroll cannot be deleted.");
      }
    }

    if (kind === "payroll") {
      const payrollRows = await db.query<PayrollRow>(
        `
          SELECT id, created_at, period_label, employee_id, employee_name,
            base_amount, attendance_bonus, piece_amount, overtime_amount, deduction,
            net_pay, status, paid_at, note
          FROM hr_payroll
          WHERE id = $1
          FOR UPDATE
        `,
        [id],
      );

      if (!payrollRows[0]) {
        throw new Error("Payroll record was not found.");
      }

      assertPayrollCanDelete(payrollFromRow(payrollRows[0]));
    }

    const rows = await db.query<{ id: string }>(
      `DELETE FROM ${tableByKind[kind]} WHERE id = $1 RETURNING id`,
      [id],
    );

    if (!rows[0]) {
      throw new Error("HR record was not found.");
    }

    return rows[0].id;
  });
}

async function addAttendanceToPostgres(record: AttendanceRecord) {
  const rows = await queryPostgres<AttendanceRow>(
    "HR",
    `
      INSERT INTO hr_attendance (
        id, created_at, employee_id, employee_name, work_date, status,
        check_in, check_out, overtime_hours, note
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (employee_id, work_date) DO UPDATE SET
        employee_name = EXCLUDED.employee_name,
        status = EXCLUDED.status,
        check_in = EXCLUDED.check_in,
        check_out = EXCLUDED.check_out,
        overtime_hours = EXCLUDED.overtime_hours,
        note = EXCLUDED.note
      RETURNING id, created_at, employee_id, employee_name, work_date, status,
        check_in, check_out, overtime_hours, note
    `,
    [
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
    ],
  );

  return attendanceFromRow(rows[0]);
}

async function addPayrollToPostgres(record: PayrollRecord) {
  const rows = await queryPostgres<PayrollRow>(
    "HR",
    `
      INSERT INTO hr_payroll (
        id, created_at, period_label, employee_id, employee_name, base_amount,
        attendance_bonus, piece_amount, overtime_amount, deduction, net_pay,
        status, paid_at, note
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (employee_id, substr(period_label, 1, 7)) DO NOTHING
      RETURNING id, created_at, period_label, employee_id, employee_name,
        base_amount, attendance_bonus, piece_amount, overtime_amount, deduction,
        net_pay, status, paid_at, note
    `,
    [
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
      record.paidAt || null,
      record.note,
    ],
  );

  // ON CONFLICT DO NOTHING returned no row: a payroll for this employee and
  // month already exists (the DB unique index is the real guard against a
  // concurrent double submission that the JS pre-check can race past).
  if (!rows[0]) {
    throw new Error(
      `Payroll already exists for ${record.employeeName} in ${record.periodLabel.slice(0, 7)}.`,
    );
  }

  return payrollFromRow(rows[0]);
}

export async function getHrData() {
  return runWithDataBackend({
    storeName: "HR",
    localJson: getHrDataFromLocalJson,
    postgres: getHrDataFromPostgres,
  });
}

export async function addEmployee(input: CreateEmployeeInput) {
  const employee = normalizeEmployee({
    ...input,
    id: createId("EMP"),
    createdAt: new Date().toISOString(),
  });

  if (!employee.name) {
    throw new Error("Employee name is required.");
  }

  return runWithDataBackend({
    storeName: "HR",
    localJson: async () => {
      const data = await getHrDataFromLocalJson();
      data.employees.unshift(employee);
      await writeHrData(data);
      return employee;
    },
    postgres: () => addEmployeeToPostgres(employee),
  });
}

export async function updateEmployee(id: string, input: UpdateEmployeeInput) {
  const employee = normalizeEmployee({
    ...input,
    id,
    createdAt: new Date().toISOString(),
  });

  if (!employee.name) {
    throw new Error("Employee name is required.");
  }

  return runWithDataBackend({
    storeName: "HR",
    localJson: async () => {
      const data = await getHrDataFromLocalJson();
      const index = data.employees.findIndex((item) => item.id === id);

      if (index < 0) {
        throw new Error("Employee was not found.");
      }

      const current = data.employees[index];
      const nextEmployee = { ...employee, id, createdAt: current.createdAt };
      data.employees[index] = nextEmployee;
      data.attendanceRecords = data.attendanceRecords.map((record) =>
        record.employeeId === id ? { ...record, employeeName: nextEmployee.name } : record,
      );
      data.payrollRecords = data.payrollRecords.map((record) =>
        record.employeeId === id ? { ...record, employeeName: nextEmployee.name } : record,
      );
      await writeHrData(data);
      return nextEmployee;
    },
    postgres: () => updateEmployeeToPostgres(id, employee),
  });
}

export async function updateEmployeeStatus(id: string, status: EmployeeStatus) {
  return runWithDataBackend({
    storeName: "HR",
    localJson: async () => {
      const data = await getHrDataFromLocalJson();
      const employee = data.employees.find((item) => item.id === id);

      if (!employee) {
        throw new Error("Employee was not found.");
      }

      employee.status = status;
      await writeHrData(data);
      return employee;
    },
    postgres: () => updateEmployeeStatusToPostgres(id, status),
  });
}

export async function addAttendanceRecord(input: CreateAttendanceInput) {
  const data = await getHrData();
  const employee = data.employees.find((item) => item.id === input.employeeId);

  if (!employee) {
    throw new Error("Employee was not found.");
  }

  const record = normalizeAttendance({
    ...input,
    id: createId("ATT"),
    createdAt: new Date().toISOString(),
    employeeName: employee.name,
  });

  return runWithDataBackend({
    storeName: "HR",
    localJson: async () => {
      const current = await getHrDataFromLocalJson();
      current.attendanceRecords = current.attendanceRecords.filter(
        (item) => !(item.employeeId === record.employeeId && item.workDate === record.workDate),
      );
      current.attendanceRecords.unshift(record);
      await writeHrData(current);
      return record;
    },
    postgres: () => addAttendanceToPostgres(record),
  });
}

export async function importFingerprintAttendanceCsv(csv: string): Promise<FingerprintAttendanceImportResult> {
  const rows = csvRecords(csv);
  const hr = await getHrData();
  const employeesByFingerprint = new Map(
    hr.employees
      .filter((employee) => employee.fingerprintId)
      .map((employee) => [employeeKey(employee.fingerprintId), employee]),
  );
  const employeesByName = new Map(
    hr.employees.map((employee) => [employeeKey(employee.name), employee]),
  );
  const grouped = new Map<
    string,
    {
      employeeId: string;
      employeeName: string;
      workDate: string;
      status: AttendanceStatus;
      checkIn: string;
      checkOut: string;
      overtimeHours: number;
      note: string;
      punchTimes: string[];
    }
  >();
  const result: FingerprintAttendanceImportResult = {
    imported: 0,
    skipped: 0,
    matchedByFingerprint: 0,
    matchedByName: 0,
    errors: [],
  };

  if (rows.length === 0) {
    return {
      ...result,
      errors: ["No CSV records were found."],
    };
  }

  for (const [index, row] of rows.entries()) {
    const fingerprintId = recordValue(row, [
      "fingerprintId",
      "fingerprint_id",
      "deviceId",
      "device_id",
      "userId",
      "user_id",
      "employeeCode",
      "employee_code",
      "empCode",
      "code",
    ]);
    const employeeName = recordValue(row, ["employeeName", "employee_name", "name", "workerName", "staffName"]);
    const employee =
      (fingerprintId ? employeesByFingerprint.get(employeeKey(fingerprintId)) : undefined) ??
      (employeeName ? employeesByName.get(employeeKey(employeeName)) : undefined);

    if (!employee) {
      result.skipped += 1;
      result.errors.push(`Row ${index + 2}: employee not matched.`);
      continue;
    }

    if (fingerprintId && employee.fingerprintId && employeeKey(fingerprintId) === employeeKey(employee.fingerprintId)) {
      result.matchedByFingerprint += 1;
    } else {
      result.matchedByName += 1;
    }

    const timestamp = recordValue(row, ["timestamp", "punchTime", "punch_time", "dateTime", "datetime", "time"]);
    const workDate = dateOnlyFromImport(
      recordValue(row, ["workDate", "work_date", "date", "attendanceDate"]) || timestamp,
    );

    if (!workDate) {
      result.skipped += 1;
      result.errors.push(`Row ${index + 2}: attendance date not found.`);
      continue;
    }

    const key = `${employee.id}:${workDate}`;
    const draft = grouped.get(key) ?? {
      employeeId: employee.id,
      employeeName: employee.name,
      workDate,
      status: statusFromImport(recordValue(row, ["status", "attendanceStatus", "attendance_status"])),
      checkIn: "",
      checkOut: "",
      overtimeHours: 0,
      note: "",
      punchTimes: [],
    };
    const punchType = recordValue(row, ["punchType", "punch_type", "type", "direction"]).toLowerCase();
    const checkIn = recordValue(row, ["checkIn", "check_in", "in", "inTime", "in_time"]);
    const checkOut = recordValue(row, ["checkOut", "check_out", "out", "outTime", "out_time"]);
    const punchTime = timeOnly(timestamp);
    const note = recordValue(row, ["note", "remarks", "remark"]);

    draft.status = statusFromImport(recordValue(row, ["status", "attendanceStatus", "attendance_status"]) || draft.status);
    draft.overtimeHours = Math.max(
      draft.overtimeHours,
      cleanNumber(recordValue(row, ["overtimeHours", "overtime_hours", "ot", "otHours", "ot_hours"])),
    );

    if (checkIn) {
      draft.checkIn = timeOnly(checkIn);
    }

    if (checkOut) {
      draft.checkOut = timeOnly(checkOut);
    }

    if (punchTime) {
      draft.punchTimes.push(punchTime);

      if (punchType.includes("out")) {
        draft.checkOut = punchTime;
      } else if (punchType.includes("in")) {
        draft.checkIn = punchTime;
      }
    }

    if (note && !draft.note.includes(note)) {
      draft.note = [draft.note, note].filter(Boolean).join(" | ");
    }

    grouped.set(key, draft);
  }

  for (const draft of grouped.values()) {
    const sortedTimes = [...new Set(draft.punchTimes)].sort();
    const checkIn = draft.checkIn || sortedTimes[0] || "";
    const checkOut = draft.checkOut || sortedTimes.at(-1) || "";

    await addAttendanceRecord({
      employeeId: draft.employeeId,
      workDate: draft.workDate,
      status: draft.status,
      checkIn,
      checkOut: checkOut !== checkIn ? checkOut : "",
      overtimeHours: draft.overtimeHours,
      note: ["Fingerprint import", draft.note].filter(Boolean).join(" | "),
    });
    result.imported += 1;
  }

  return result;
}

export async function addPayrollRecord(input: CreatePayrollInput) {
  const data = await getHrData();
  const employee = data.employees.find((item) => item.id === input.employeeId);
  const periodLabel = cleanText(input.periodLabel) || monthKey();
  const periodMonth = periodLabel.slice(0, 7);

  if (!employee) {
    throw new Error("Employee was not found.");
  }

  const duplicate = data.payrollRecords.find(
    (item) => item.employeeId === employee.id && item.periodLabel.slice(0, 7) === periodMonth,
  );

  if (duplicate) {
    throw new Error(`Payroll already exists for ${employee.name} in ${periodMonth}.`);
  }

  const record = normalizePayroll({
    ...input,
    periodLabel,
    id: createId("PAY"),
    createdAt: new Date().toISOString(),
    employeeName: employee.name,
  });

  return runWithDataBackend({
    storeName: "HR",
    localJson: async () => {
      const current = await getHrDataFromLocalJson();
      current.payrollRecords.unshift(record);
      await writeHrData(current);
      return record;
    },
    postgres: () => addPayrollToPostgres(record),
  });
}

export async function updatePayrollStatus(id: string, status: PayrollStatus) {
  return runWithDataBackend({
    storeName: "HR",
    localJson: async () => {
      const data = await getHrDataFromLocalJson();
      const payroll = data.payrollRecords.find((item) => item.id === id);

      if (!payroll) {
        throw new Error("Payroll record was not found.");
      }

      assertPayrollCanMove(payroll, status);
      payroll.status = status;
      payroll.paidAt = payrollPaidAtForStatus(status, payroll.paidAt);
      await writeHrData(data);
      return payroll;
    },
    postgres: () => updatePayrollStatusToPostgres(id, status),
  });
}

export async function deleteHrRecord(kind: HrRecordKind, id: string) {
  return runWithDataBackend({
    storeName: "HR",
    localJson: async () => {
      const data = await getHrDataFromLocalJson();

      if (kind === "employee") {
        const exists = data.employees.some((employee) => employee.id === id);

        if (!exists) {
          throw new Error("Employee was not found.");
        }

        if (data.payrollRecords.some((record) => record.employeeId === id && record.status === "Locked")) {
          throw new Error("Employee with locked payroll cannot be deleted.");
        }

        data.employees = data.employees.filter((employee) => employee.id !== id);
        data.attendanceRecords = data.attendanceRecords.filter((record) => record.employeeId !== id);
        data.payrollRecords = data.payrollRecords.filter((record) => record.employeeId !== id);
      }

      if (kind === "attendance") {
        const previousLength = data.attendanceRecords.length;
        data.attendanceRecords = data.attendanceRecords.filter((record) => record.id !== id);

        if (data.attendanceRecords.length === previousLength) {
          throw new Error("Attendance record was not found.");
        }
      }

      if (kind === "payroll") {
        const payroll = data.payrollRecords.find((record) => record.id === id);

        if (!payroll) {
          throw new Error("Payroll record was not found.");
        }

        assertPayrollCanDelete(payroll);
        const previousLength = data.payrollRecords.length;
        data.payrollRecords = data.payrollRecords.filter((record) => record.id !== id);

        if (data.payrollRecords.length === previousLength) {
          throw new Error("Payroll record was not found.");
        }
      }

      await writeHrData(data);
      return id;
    },
    postgres: () => deleteHrRecordFromPostgres(kind, id),
  });
}

export async function getPayrollRecordById(id: string) {
  const data = await getHrData();
  return data.payrollRecords.find((record) => record.id === id) ?? null;
}

export async function getEmployeeHrDetail(id: string): Promise<EmployeeHrDetail | null> {
  const [hr, operations] = await Promise.all([getHrData(), getOperationsData()]);
  const employee = hr.employees.find((item) => item.id === id);

  if (!employee) {
    return null;
  }

  const key = employeeKey(employee.name);
  const currentMonth = monthKey();
  const attendanceRecords = hr.attendanceRecords
    .filter((record) => record.employeeId === employee.id)
    .sort((a, b) => b.workDate.localeCompare(a.workDate) || b.createdAt.localeCompare(a.createdAt));
  const payrollRecords = hr.payrollRecords
    .filter((record) => record.employeeId === employee.id)
    .sort((a, b) => b.periodLabel.localeCompare(a.periodLabel) || b.createdAt.localeCompare(a.createdAt));
  const workerTasks = operations.workerTasks
    .filter((task) => employeeKey(task.workerName) === key)
    .sort((a, b) => b.completedPairs - a.completedPairs || b.targetPairs - a.targetPairs);
  const attendanceThisMonth = attendanceRecords.filter((record) => record.workDate.startsWith(currentMonth));
  const payrollThisMonth = payrollRecords.filter((record) => record.periodLabel.startsWith(currentMonth));
  const targetPairs = sum(workerTasks, (task) => task.targetPairs);
  const completedPairs = sum(workerTasks, (task) => task.completedPairs);

  return {
    employee,
    attendanceRecords,
    payrollRecords,
    workerTasks,
    payrollSuggestion: buildPayrollSuggestion({
      employee,
      attendanceRecords: attendanceThisMonth,
      payrollRecords: payrollThisMonth,
      workerTasks,
      periodLabel: currentMonth,
    }),
    summary: {
      attendanceDays: sum(attendanceRecords, attendanceDayValue),
      presentRecords: attendanceRecords.filter(
        (record) => record.status === "Present" || record.status === "Half Day",
      ).length,
      leaveDays: attendanceRecords.filter((record) => record.status === "Leave").length,
      absentDays: attendanceRecords.filter((record) => record.status === "Absent").length,
      overtimeHours: sum(attendanceRecords, (record) => record.overtimeHours),
      targetPairs,
      completedPairs,
      progressRate: percentage(completedPairs, targetPairs),
      grossPay: sum(payrollRecords, grossPay),
      netPay: sum(payrollRecords, (record) => record.netPay),
      draftPay: sum(payrollRecords.filter((record) => record.status === "Draft"), (record) => record.netPay),
    },
  };
}

function groupTasksByWorker(tasks: WorkerTask[]) {
  const groups = new Map<string, WorkerTask[]>();

  for (const task of tasks) {
    const key = employeeKey(task.workerName);
    const rows = groups.get(key) ?? [];
    rows.push(task);
    groups.set(key, rows);
  }

  return groups;
}

export async function getHrSnapshot() {
  const [hr, operations] = await Promise.all([getHrData(), getOperationsData()]);
  const tasksByWorker = groupTasksByWorker(operations.workerTasks);
  const employeesByName = new Map(hr.employees.map((employee) => [employeeKey(employee.name), employee]));
  const workerNames = new Set([
    ...hr.employees.map((employee) => employeeKey(employee.name)),
    ...operations.workerTasks.map((task) => employeeKey(task.workerName)),
  ]);
  const currentMonth = monthKey();
  const today = todayKey();
  const attendanceThisMonth = hr.attendanceRecords.filter((record) => record.workDate.startsWith(currentMonth));
  const payrollThisMonth = hr.payrollRecords.filter((record) => record.periodLabel.startsWith(currentMonth));

  const employeePerformance = [...workerNames]
    .filter(Boolean)
    .map((key) => {
      const employee = employeesByName.get(key);
      const tasks = tasksByWorker.get(key) ?? [];
      const targetPairs = sum(tasks, (task) => task.targetPairs);
      const completedPairs = sum(tasks, (task) => task.completedPairs);
      const attendanceDaysThisMonth = sum(
        attendanceThisMonth.filter((record) => employeeKey(record.employeeName) === key),
        attendanceDayValue,
      );
      const payrollPaid = sum(
        payrollThisMonth.filter((record) => employeeKey(record.employeeName) === key),
        (record) => record.netPay,
      );

      return {
        employeeId: employee?.id ?? "",
        employeeName: employee?.name ?? tasks[0]?.workerName ?? "Unknown worker",
        department: employee?.department ?? "Unregistered",
        status: employee?.status ?? "Unregistered",
        taskCount: tasks.length,
        doneTaskCount: tasks.filter((task) => task.status === "Done").length,
        targetPairs,
        completedPairs,
        progressRate: percentage(completedPairs, targetPairs),
        attendanceDaysThisMonth,
        payrollThisMonth: payrollPaid,
        piecePayEstimate: Math.round(completedPairs * (employee?.pieceRate ?? 0)),
      } satisfies EmployeePerformanceRow;
    })
    .sort((a, b) => b.completedPairs - a.completedPairs || b.progressRate - a.progressRate);

  const stationHeadcount = hrDepartments
    .map((department) => {
      const employees = hr.employees.filter(
        (employee) => employee.department === department && employee.status === "Active",
      );

      return {
        department,
        activeEmployees: employees.length,
        monthlySalaryBase: sum(employees, (employee) => employee.baseSalary),
      };
    })
    .filter((row) => row.activeEmployees > 0)
    .sort((a, b) => b.activeEmployees - a.activeEmployees);
  const monthlyAttendanceSummary = hr.employees
    .map((employee) => {
      const records = attendanceThisMonth.filter((record) => record.employeeId === employee.id);
      const payrollRows = payrollThisMonth.filter((record) => record.employeeId === employee.id);
      const performance = employeePerformance.find((row) => row.employeeId === employee.id);

      return {
        employeeId: employee.id,
        employeeName: employee.name,
        department: employee.department,
        presentDays: sum(records, attendanceDayValue),
        leaveDays: records.filter((record) => record.status === "Leave").length,
        absentDays: records.filter((record) => record.status === "Absent").length,
        overtimeHours: sum(records, (record) => record.overtimeHours),
        payrollNet: sum(payrollRows, (record) => record.netPay),
        completedPairs: performance?.completedPairs ?? 0,
      };
    })
    .sort((a, b) => b.presentDays - a.presentDays || b.completedPairs - a.completedPairs);
  const monthlyPayrollSummary = payrollThisMonth
    .map((record) => ({
      id: record.id,
      employeeId: record.employeeId,
      employeeName: record.employeeName,
      periodLabel: record.periodLabel,
      grossPay: grossPay(record),
      deduction: record.deduction,
      netPay: record.netPay,
      status: record.status,
    }))
    .sort((a, b) => b.netPay - a.netPay);
  const payrollSuggestions = hr.employees
    .filter((employee) => employee.status === "Active")
    .map((employee) =>
      buildPayrollSuggestion({
        employee,
        attendanceRecords: attendanceThisMonth.filter((record) => record.employeeId === employee.id),
        payrollRecords: payrollThisMonth.filter((record) => record.employeeId === employee.id),
        workerTasks: tasksByWorker.get(employeeKey(employee.name)) ?? [],
        periodLabel: currentMonth,
      }),
    )
    .sort((a, b) => {
      const statusRank = { Ready: 0, "Needs attendance": 1, Recorded: 2 };
      return statusRank[a.statusSignal] - statusRank[b.statusSignal] || b.netPay - a.netPay;
    });
  const monthlySalaryClosing = payrollSuggestions
    .map((suggestion) =>
      buildMonthlySalaryClosingRow({
        suggestion,
        payrollRecords: payrollThisMonth.filter((record) => record.employeeId === suggestion.employeeId),
      }),
    )
    .sort((a, b) => {
      const statusRank = {
        "Review variance": 0,
        "Payment pending": 1,
        "Missing payroll": 2,
        Closed: 3,
      };
      return statusRank[a.statusSignal] - statusRank[b.statusSignal] || Math.abs(b.variance) - Math.abs(a.variance);
    });

  return {
    ...hr,
    summary: {
      employeeCount: hr.employees.length,
      activeEmployees: hr.employees.filter((employee) => employee.status === "Active").length,
      todayPresent: hr.attendanceRecords.filter(
        (record) => record.workDate === today && (record.status === "Present" || record.status === "Half Day"),
      ).length,
      monthAttendanceDays: sum(attendanceThisMonth, attendanceDayValue),
      monthPayroll: sum(payrollThisMonth, (record) => record.netPay),
      draftPayroll: sum(hr.payrollRecords.filter((record) => record.status === "Draft"), (record) => record.netPay),
      completedPairs: sum(employeePerformance, (row) => row.completedPairs),
      averageProgressRate: percentage(
        sum(employeePerformance, (row) => row.completedPairs),
        sum(employeePerformance, (row) => row.targetPairs),
      ),
      unregisteredWorkers: employeePerformance.filter((row) => row.status === "Unregistered").length,
    },
    reports: {
      employeePerformance,
      stationHeadcount,
      monthlyAttendanceSummary,
      monthlyPayrollSummary,
      payrollSuggestions,
      monthlySalaryClosing,
      todayAttendance: hr.attendanceRecords.filter((record) => record.workDate === today),
      recentAttendance: hr.attendanceRecords.slice(0, 20),
      recentPayroll: hr.payrollRecords.slice(0, 20),
    },
  };
}
