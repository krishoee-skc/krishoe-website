import { describe, expect, it } from "vitest";
import {
  assertPayrollCanDelete,
  assertPayrollCanMove,
  buildPayrollSuggestion,
  employeeDailyRate,
  normalizePayroll,
  type AttendanceRecord,
  type Employee,
  type PayrollRecord,
} from "@/lib/hr";
import type { WorkerTask } from "@/lib/operations";

function employee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: "EMP-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    name: "Ram Bahadur",
    phone: "9800000000",
    role: "Stitcher",
    department: "Stitching",
    employmentType: "Full Time",
    salaryType: "Monthly",
    baseSalary: 26000,
    dailyWage: 0,
    pieceRate: 0,
    status: "Active",
    joinedAt: "2026-01-01",
    fingerprintId: "",
    note: "",
    ...overrides,
  };
}

function attendance(
  status: AttendanceRecord["status"],
  overtimeHours = 0,
  workDate = "2026-07-01",
): AttendanceRecord {
  return {
    id: `ATT-${workDate}-${status}`,
    createdAt: "2026-07-01T00:00:00.000Z",
    employeeId: "EMP-1",
    employeeName: "Ram Bahadur",
    workDate,
    status,
    checkIn: "09:00",
    checkOut: "18:00",
    overtimeHours,
    note: "",
  };
}

function task(completedPairs: number): WorkerTask {
  return {
    id: `TASK-${completedPairs}`,
    workerName: "Ram Bahadur",
    station: "Stitching",
    batchId: "BATCH-1",
    design: "Cloud Step Slippers",
    targetPairs: completedPairs,
    completedPairs,
    status: "Done",
    cameraZone: "",
  };
}

function suggest({
  emp = employee(),
  attendanceRecords = [] as AttendanceRecord[],
  workerTasks = [] as WorkerTask[],
  payrollRecords = [] as PayrollRecord[],
} = {}) {
  return buildPayrollSuggestion({
    employee: emp,
    attendanceRecords,
    payrollRecords,
    workerTasks,
    periodLabel: "2026-07",
  });
}

describe("employeeDailyRate", () => {
  it("uses the explicit daily wage when set", () => {
    expect(employeeDailyRate(employee({ dailyWage: 900, baseSalary: 26000 }))).toBe(900);
  });

  it("derives a daily rate from monthly salary over a 26 day month", () => {
    expect(employeeDailyRate(employee({ baseSalary: 26000 }))).toBe(1000);
  });

  it("rounds the derived rate to whole rupees", () => {
    // 25000 / 26 = 961.53...
    expect(employeeDailyRate(employee({ baseSalary: 25000 }))).toBe(962);
  });

  it("is zero when the employee has neither wage nor salary", () => {
    expect(employeeDailyRate(employee({ baseSalary: 0, dailyWage: 0 }))).toBe(0);
  });
});

describe("buildPayrollSuggestion attendance counting", () => {
  it("counts a half day as half a day", () => {
    const row = suggest({
      attendanceRecords: [attendance("Present", 0, "2026-07-01"), attendance("Half Day", 0, "2026-07-02")],
    });
    expect(row.presentDays).toBe(1.5);
  });

  it("counts leave and absent separately and neither as present", () => {
    const row = suggest({
      attendanceRecords: [
        attendance("Present", 0, "2026-07-01"),
        attendance("Leave", 0, "2026-07-02"),
        attendance("Absent", 0, "2026-07-03"),
      ],
    });
    expect(row.presentDays).toBe(1);
    expect(row.leaveDays).toBe(1);
    expect(row.absentDays).toBe(1);
  });
});

describe("buildPayrollSuggestion monthly staff", () => {
  it("pays the full base salary and deducts the daily rate per absent day", () => {
    const row = suggest({
      emp: employee({ salaryType: "Monthly", baseSalary: 26000 }),
      attendanceRecords: [attendance("Absent", 0, "2026-07-01"), attendance("Absent", 0, "2026-07-02")],
    });

    expect(row.baseAmount).toBe(26000);
    expect(row.deduction).toBe(2000); // 2 absent days x 1000/day
    expect(row.netPay).toBe(24000);
  });

  it("does not deduct for leave days", () => {
    const row = suggest({
      emp: employee({ salaryType: "Monthly", baseSalary: 26000 }),
      attendanceRecords: [attendance("Leave", 0, "2026-07-01")],
    });

    expect(row.deduction).toBe(0);
    expect(row.netPay).toBe(26000);
  });
});

describe("buildPayrollSuggestion daily staff", () => {
  it("pays only for days actually present", () => {
    const row = suggest({
      emp: employee({ salaryType: "Daily", baseSalary: 0, dailyWage: 900 }),
      attendanceRecords: [
        attendance("Present", 0, "2026-07-01"),
        attendance("Present", 0, "2026-07-02"),
        attendance("Absent", 0, "2026-07-03"),
      ],
    });

    expect(row.baseAmount).toBe(1800);
    // Absent days are already excluded from base pay, so deducting again would
    // charge a daily worker twice for the same absence.
    expect(row.deduction).toBe(0);
    expect(row.netPay).toBe(1800);
  });
});

describe("buildPayrollSuggestion piece and overtime", () => {
  it("pays piece rate per completed pair", () => {
    const row = suggest({
      emp: employee({ salaryType: "Piece Rate", baseSalary: 0, dailyWage: 0, pieceRate: 25 }),
      workerTasks: [task(40), task(60)],
    });

    expect(row.completedPairs).toBe(100);
    expect(row.pieceAmount).toBe(2500);
    expect(row.baseAmount).toBe(0);
    expect(row.netPay).toBe(2500);
  });

  it("pays overtime at an eight hour day rate", () => {
    const row = suggest({
      emp: employee({ salaryType: "Monthly", baseSalary: 26000 }),
      attendanceRecords: [attendance("Present", 2, "2026-07-01")],
    });

    // dailyRate 1000 / 8 = 125 per hour, 2 hours = 250
    expect(row.overtimeAmount).toBe(250);
    expect(row.netPay).toBe(26250);
  });

  it("pays no overtime when the employee has no rate to derive it from", () => {
    const row = suggest({
      emp: employee({ salaryType: "Piece Rate", baseSalary: 0, dailyWage: 0, pieceRate: 25 }),
      attendanceRecords: [attendance("Present", 5, "2026-07-01")],
    });

    expect(row.overtimeAmount).toBe(0);
  });
});

describe("buildPayrollSuggestion netPay floor", () => {
  it("never suggests a negative payout, however many days were missed", () => {
    const row = suggest({
      emp: employee({ salaryType: "Monthly", baseSalary: 26000 }),
      attendanceRecords: Array.from({ length: 40 }, (_, index) =>
        attendance("Absent", 0, `2026-07-${String(index + 1).padStart(2, "0")}`),
      ),
    });

    expect(row.deduction).toBe(40000);
    expect(row.netPay).toBe(0);
  });
});

describe("buildPayrollSuggestion status signal", () => {
  it("flags an employee with no attendance and no output", () => {
    expect(suggest().statusSignal).toBe("Needs attendance");
  });

  it("is ready once there is attendance", () => {
    expect(suggest({ attendanceRecords: [attendance("Present")] }).statusSignal).toBe("Ready");
  });

  it("is ready on piece output alone, with no attendance", () => {
    expect(suggest({ workerTasks: [task(10)] }).statusSignal).toBe("Ready");
  });

  it("reports recorded when payroll for the period already exists", () => {
    const row = suggest({
      attendanceRecords: [attendance("Present")],
      payrollRecords: [normalizePayroll({ employeeId: "EMP-1", periodLabel: "2026-07" })],
    });

    expect(row.hasPayroll).toBe(true);
    expect(row.statusSignal).toBe("Recorded");
  });
});

describe("normalizePayroll", () => {
  it("recomputes netPay from the parts rather than trusting a supplied value", () => {
    const record = normalizePayroll({
      baseAmount: 20000,
      attendanceBonus: 1000,
      pieceAmount: 500,
      overtimeAmount: 250,
      deduction: 750,
      netPay: 999999,
    });

    expect(record.netPay).toBe(21000);
  });

  it("includes the attendance bonus that the draft suggestion leaves at zero", () => {
    expect(normalizePayroll({ baseAmount: 0, attendanceBonus: 1500 }).netPay).toBe(1500);
  });

  it("floors netPay at zero when deductions exceed earnings", () => {
    expect(normalizePayroll({ baseAmount: 1000, deduction: 5000 }).netPay).toBe(0);
  });

  it("defaults an unknown status to Draft", () => {
    expect(normalizePayroll({ status: "Whatever" as PayrollRecord["status"] }).status).toBe("Draft");
  });
});

describe("payroll status guards", () => {
  function record(status: PayrollRecord["status"]) {
    return normalizePayroll({ employeeId: "EMP-1", status });
  }

  it("refuses to change a locked payroll", () => {
    expect(() => assertPayrollCanMove(record("Locked"), "Draft")).toThrow(/Locked payroll cannot be changed/);
  });

  it("refuses to delete a locked payroll", () => {
    expect(() => assertPayrollCanDelete(record("Locked"))).toThrow(/Locked payroll cannot be deleted/);
  });

  it("refuses to lock a payroll that was never paid", () => {
    expect(() => assertPayrollCanMove(record("Approved"), "Locked")).toThrow(/must be paid before locking/);
  });

  it("allows locking a paid payroll", () => {
    expect(() => assertPayrollCanMove(record("Paid"), "Locked")).not.toThrow();
  });

  it("allows a locked payroll to stay locked", () => {
    expect(() => assertPayrollCanMove(record("Locked"), "Locked")).not.toThrow();
  });

  it("allows ordinary moves before payment", () => {
    expect(() => assertPayrollCanMove(record("Draft"), "Approved")).not.toThrow();
    expect(() => assertPayrollCanDelete(record("Draft"))).not.toThrow();
  });
});
