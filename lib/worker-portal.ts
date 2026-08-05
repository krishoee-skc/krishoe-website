import { queryPostgres } from "@/lib/postgres/client";

const STORE = "krishoe";

export interface WorkerProfile {
  id: string;
  name: string;
  phone: string;
  role: string;
  department: string;
  employmentType: string;
  salaryType: string;
  joinedAt: string;
  status: string;
}

export interface MonthlyEarnings {
  month: string;
  baseSalary: number;
  piecesRate: number;
  bonusAmount: number;
  attendanceBonus: number;
  deductions: number;
  netPay: number;
  status: string;
}

export interface AttendanceRecord {
  date: string;
  status: string; // Present, Half Day, Leave, Absent
  checkIn?: string;
  checkOut?: string;
  overtimeHours?: number;
}

export interface MonthlyAttendance {
  month: string;
  presentDays: number;
  halfDays: number;
  leaveDays: number;
  absentDays: number;
  attendanceRate: number;
  records: AttendanceRecord[];
}

export interface ProductionMetrics {
  date: string;
  pairsCompleted: number;
  pairsRework: number;
  amountEarned: number;
  item: string;
  status: string;
}

export interface MonthlyProduction {
  month: string;
  totalPairs: number;
  reworkPairs: number;
  totalEarnings: number;
  averageDailyPairs: number;
  qualityRate: number;
  metrics: ProductionMetrics[];
}

export interface BonusInfo {
  month: string;
  bonusEligible: boolean;
  qualityRate: number;
  attendanceRate: number;
  bonusAmount: number;
  criteria: {
    qualityMet: boolean;
    attendanceMet: boolean;
  };
}

// Get worker profile by ID
export async function getWorkerProfile(employeeId: string): Promise<WorkerProfile | null> {
  try {
    const result = await queryPostgres<WorkerProfile>(
      STORE,
      `SELECT
        id, name, phone, role, department,
        employment_type as "employmentType",
        salary_type as "salaryType",
        joined_at as "joinedAt",
        status
      FROM hr_employees
      WHERE id = $1`,
      [employeeId]
    );

    return result[0] || null;
  } catch (error) {
    console.error("Failed to get worker profile:", error);
    return null;
  }
}

// Get monthly earnings
export async function getMonthlyEarnings(
  employeeId: string,
  limit: number = 12
): Promise<MonthlyEarnings[]> {
  try {
    const result = await queryPostgres<MonthlyEarnings>(
      STORE,
      `SELECT
        period_label as month,
        base_amount as "baseSalary",
        piece_amount as "piecesRate",
        attendance_bonus as "attendanceBonus",
        deduction as deductions,
        net_pay as "netPay",
        status
      FROM hr_payroll
      WHERE employee_id = $1
      ORDER BY period_label DESC
      LIMIT $2`,
      [employeeId, limit]
    );

    return result.map((r) => ({
      ...r,
      bonusAmount: 0, // Will be calculated from bonus_amount if available
    }));
  } catch (error) {
    console.error("Failed to get monthly earnings:", error);
    return [];
  }
}

// Get attendance for a month
export async function getMonthlyAttendance(
  employeeId: string,
  year: number,
  month: number
): Promise<MonthlyAttendance | null> {
  try {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    const monthLabel = monthStart.toLocaleString("default", { month: "long", year: "numeric" });

    const records = await queryPostgres<AttendanceRecord>(
      STORE,
      `SELECT
        work_date as date,
        status,
        check_in as "checkIn",
        check_out as "checkOut",
        overtime_hours as "overtimeHours"
      FROM hr_attendance
      WHERE employee_id = $1
      AND work_date >= $2 AND work_date <= $3
      ORDER BY work_date DESC`,
      [employeeId, monthStart.toISOString().split("T")[0], monthEnd.toISOString().split("T")[0]]
    );

    const summary = {
      presentDays: records.filter((r) => r.status === "Present").length,
      halfDays: records.filter((r) => r.status === "Half Day").length,
      leaveDays: records.filter((r) => r.status === "Leave").length,
      absentDays: records.filter((r) => r.status === "Absent").length,
    };

    const totalDays = Object.values(summary).reduce((a, b) => a + b, 0) || 1;
    const attendanceRate =
      ((summary.presentDays + summary.halfDays * 0.5) / totalDays) * 100;

    return {
      month: monthLabel,
      ...summary,
      attendanceRate: Math.round(attendanceRate * 100) / 100,
      records,
    };
  } catch (error) {
    console.error("Failed to get monthly attendance:", error);
    return null;
  }
}

// Get production metrics for a month
export async function getMonthlyProduction(
  employeeId: string,
  year: number,
  month: number
): Promise<MonthlyProduction | null> {
  try {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    const monthLabel = monthStart.toLocaleString("default", { month: "long", year: "numeric" });

    const metrics = await queryPostgres<ProductionMetrics>(
      STORE,
      `SELECT
        work_date as date,
        total_pairs as "pairsCompleted",
        rework_pairs as "pairsRework",
        earned_wage as "amountEarned",
        item_name_snapshot as item,
        status
      FROM production_work_entries
      WHERE employee_id = $1
      AND work_date >= $2 AND work_date <= $3
      ORDER BY work_date DESC`,
      [employeeId, monthStart.toISOString().split("T")[0], monthEnd.toISOString().split("T")[0]]
    );

    const totalPairs = metrics.reduce((sum, m) => sum + m.pairsCompleted, 0);
    const reworkPairs = metrics.reduce((sum, m) => sum + m.pairsRework, 0);
    const totalEarnings = metrics.reduce((sum, m) => sum + (m.amountEarned || 0), 0);
    const workDays = new Set(metrics.map((m) => m.date)).size;
    const qualityRate =
      totalPairs > 0 ? ((totalPairs - reworkPairs) / totalPairs) * 100 : 100;

    return {
      month: monthLabel,
      totalPairs,
      reworkPairs,
      totalEarnings: Math.round(totalEarnings),
      averageDailyPairs: workDays > 0 ? Math.round(totalPairs / workDays) : 0,
      qualityRate: Math.round(qualityRate * 100) / 100,
      metrics,
    };
  } catch (error) {
    console.error("Failed to get monthly production:", error);
    return null;
  }
}

// Get bonus eligibility for a month
export async function getBonusInfo(
  employeeId: string,
  year: number,
  month: number
): Promise<BonusInfo | null> {
  try {
    const production = await getMonthlyProduction(employeeId, year, month);
    const attendance = await getMonthlyAttendance(employeeId, year, month);

    if (!production || !attendance) {
      return null;
    }

    const monthLabel = production.month;
    const qualityMet = production.qualityRate >= 95;
    const attendanceMet = attendance.attendanceRate >= 90;
    const bonusEligible = qualityMet && attendanceMet;

    // Bonus calculation: 5% of monthly earnings if eligible
    const monthlyEarnings = await queryPostgres<{ net_pay: number }>(
      STORE,
      `SELECT net_pay
      FROM hr_payroll
      WHERE employee_id = $1
      AND period_label LIKE $2
      LIMIT 1`,
      [employeeId, `${year}-%`.replace("202X", year.toString())]
    );

    const baseEarnings = monthlyEarnings[0]?.net_pay || 0;
    const bonusAmount = bonusEligible ? Math.round(baseEarnings * 0.05) : 0;

    return {
      month: monthLabel,
      bonusEligible,
      qualityRate: production.qualityRate,
      attendanceRate: attendance.attendanceRate,
      bonusAmount,
      criteria: {
        qualityMet,
        attendanceMet,
      },
    };
  } catch (error) {
    console.error("Failed to get bonus info:", error);
    return null;
  }
}

// Get dashboard summary for worker
export async function getWorkerDashboardSummary(employeeId: string): Promise<{
  profile: WorkerProfile | null;
  thisMonth: {
    earnings: number;
    pairs: number;
    attendance: number;
  };
  lastMonth: {
    earnings: number;
    pairs: number;
  };
}> {
  try {
    const profile = await getWorkerProfile(employeeId);
    const today = new Date();
    const thisMonth = await getMonthlyProduction(
      employeeId,
      today.getFullYear(),
      today.getMonth() + 1
    );
    const lastMonth = await getMonthlyProduction(
      employeeId,
      today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear(),
      today.getMonth() === 0 ? 12 : today.getMonth()
    );
    const attendance = await getMonthlyAttendance(
      employeeId,
      today.getFullYear(),
      today.getMonth() + 1
    );

    return {
      profile,
      thisMonth: {
        earnings: thisMonth?.totalEarnings || 0,
        pairs: thisMonth?.totalPairs || 0,
        attendance: attendance?.attendanceRate || 0,
      },
      lastMonth: {
        earnings: lastMonth?.totalEarnings || 0,
        pairs: lastMonth?.totalPairs || 0,
      },
    };
  } catch (error) {
    console.error("Failed to get worker dashboard summary:", error);
    return {
      profile: null,
      thisMonth: { earnings: 0, pairs: 0, attendance: 0 },
      lastMonth: { earnings: 0, pairs: 0 },
    };
  }
}

// Generate payslip PDF data
export async function generatePayslipData(
  employeeId: string,
  month: string
): Promise<{
  employee: WorkerProfile | null;
  earnings: MonthlyEarnings | null;
  production: MonthlyProduction | null;
  attendance: MonthlyAttendance | null;
}> {
  try {
    const earnings = await queryPostgres<MonthlyEarnings>(
      STORE,
      `SELECT
        period_label as month,
        base_amount as "baseSalary",
        piece_amount as "piecesRate",
        attendance_bonus as "attendanceBonus",
        deduction as deductions,
        net_pay as "netPay",
        status
      FROM hr_payroll
      WHERE employee_id = $1 AND period_label = $2`,
      [employeeId, month]
    );

    const profile = await getWorkerProfile(employeeId);

    // Parse month string to get year and month number
    const [yearStr, monthStr] = month.split("-");
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);

    const production = await getMonthlyProduction(employeeId, year, monthNum);
    const attendance = await getMonthlyAttendance(employeeId, year, monthNum);

    return {
      employee: profile,
      earnings: earnings[0] || null,
      production,
      attendance,
    };
  } catch (error) {
    console.error("Failed to generate payslip data:", error);
    return {
      employee: null,
      earnings: null,
      production: null,
      attendance: null,
    };
  }
}
