import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AttendanceRecord, Employee, PayrollRecord } from "@/lib/hr";
import type { WorkerTask } from "@/lib/operations";

// getHrSnapshot calls getHrData() inside its own module, so an ESM spy on the
// hr module's export would never be seen. Mock the store underneath it instead.
const runWithDataBackend = vi.fn();
const getOperationsData = vi.fn();

vi.mock("@/lib/data-backend", () => ({
  runWithDataBackend: (...args: unknown[]) => runWithDataBackend(...args),
}));
vi.mock("@/lib/postgres/client", () => ({
  queryPostgres: vi.fn(),
  transactionPostgres: vi.fn(),
}));
vi.mock("@/lib/operations", () => ({
  getOperationsData: () => getOperationsData(),
}));

import { getHrSnapshot } from "@/lib/hr";

const MONTH = new Date().toISOString().slice(0, 7);
const WORK_DATE = `${MONTH}-05`;

function employee(id: string, name: string): Employee {
  return {
    id,
    createdAt: "2026-01-01T00:00:00.000Z",
    name,
    phone: "9800000000",
    role: "Stitcher",
    department: "Upper",
    employmentType: "Full Time",
    salaryType: "Monthly",
    baseSalary: 26000,
    dailyWage: 0,
    pieceRate: 10,
    status: "Active",
    joinedAt: "2026-01-01",
    fingerprintId: "",
    note: "",
  };
}

function attendance(employeeId: string, employeeName: string, day: string): AttendanceRecord {
  return {
    id: `ATT-${employeeId}-${day}`,
    createdAt: `${WORK_DATE}T00:00:00.000Z`,
    employeeId,
    employeeName,
    workDate: `${MONTH}-${day}`,
    status: "Present",
    checkIn: "09:00",
    checkOut: "18:00",
    overtimeHours: 0,
    note: "",
  };
}

function payroll(employeeId: string, employeeName: string, netPay: number): PayrollRecord {
  return {
    id: `PAY-${employeeId}`,
    createdAt: `${WORK_DATE}T00:00:00.000Z`,
    periodLabel: MONTH,
    employeeId,
    employeeName,
    baseAmount: netPay,
    attendanceBonus: 0,
    pieceAmount: 0,
    overtimeAmount: 0,
    deduction: 0,
    netPay,
    status: "Paid",
    paidAt: `${WORK_DATE}T00:00:00.000Z`,
    note: "",
  };
}

function task(workerName: string, completedPairs: number): WorkerTask {
  return {
    id: `TASK-${workerName}-${completedPairs}`,
    workerName,
    station: "Upper",
    batchId: "BATCH-1",
    design: "Flatpatta",
    targetPairs: completedPairs,
    completedPairs,
    status: "Done",
    cameraZone: "",
  };
}

// Two workers whose names differ only by case and spacing, so a snapshot that
// grouped by a sloppy key — or that crossed the name-keyed and id-keyed
// indexes — would hand one worker the other's days or pay.
const RAM = employee("EMP-RAM", "Ram Bahadur");
const SITA = employee("EMP-SITA", "Sita Devi");

function setData({
  employees = [RAM, SITA],
  attendanceRecords = [] as AttendanceRecord[],
  payrollRecords = [] as PayrollRecord[],
  workerTasks = [] as WorkerTask[],
} = {}) {
  runWithDataBackend.mockImplementation(async ({ storeName }: { storeName: string }) => {
    if (storeName !== "HR") throw new Error(`unexpected store ${storeName}`);
    return { employees, attendanceRecords, payrollRecords };
  });
  getOperationsData.mockResolvedValue({ workerTasks });
}

beforeEach(() => {
  runWithDataBackend.mockReset();
  getOperationsData.mockReset();
});

describe("getHrSnapshot attributes records to the right worker", () => {
  it("keeps each worker's attendance days separate", async () => {
    setData({
      attendanceRecords: [
        attendance("EMP-RAM", "Ram Bahadur", "05"),
        attendance("EMP-RAM", "Ram Bahadur", "06"),
        attendance("EMP-SITA", "Sita Devi", "05"),
      ],
    });

    const snapshot = await getHrSnapshot();
    const byName = new Map(
      snapshot.reports.monthlyAttendanceSummary.map((row) => [row.employeeName, row]),
    );

    expect(byName.get("Ram Bahadur")?.presentDays).toBe(2);
    expect(byName.get("Sita Devi")?.presentDays).toBe(1);
  });

  it("does not pay one worker's payroll to another", async () => {
    setData({ payrollRecords: [payroll("EMP-RAM", "Ram Bahadur", 24000)] });

    const snapshot = await getHrSnapshot();
    const byName = new Map(
      snapshot.reports.monthlyAttendanceSummary.map((row) => [row.employeeName, row]),
    );

    expect(byName.get("Ram Bahadur")?.payrollNet).toBe(24000);
    expect(byName.get("Sita Devi")?.payrollNet).toBe(0);
  });

  it("credits produced pairs to the worker who made them", async () => {
    setData({ workerTasks: [task("Ram Bahadur", 40), task("Sita Devi", 15)] });

    const snapshot = await getHrSnapshot();
    const byName = new Map(
      snapshot.reports.employeePerformance.map((row) => [row.employeeName, row]),
    );

    expect(byName.get("Ram Bahadur")?.completedPairs).toBe(40);
    expect(byName.get("Sita Devi")?.completedPairs).toBe(15);
  });

  it("matches worker names ignoring case and surrounding blanks", async () => {
    setData({ workerTasks: [task("  ram bahadur ", 40)] });

    const snapshot = await getHrSnapshot();
    const ram = snapshot.reports.employeePerformance.find(
      (row) => row.employeeId === "EMP-RAM",
    );

    // The messy name resolves to the registered employee rather than showing up
    // as a second, unregistered worker.
    expect(ram?.completedPairs).toBe(40);
    expect(snapshot.summary.unregisteredWorkers).toBe(0);
  });

  // Documents a real limit rather than asserting it is correct: employeeKey
  // only trims and lowercases, so a doubled space *inside* a typed name still
  // reads as a different person. Harmless when one person enters a dozen
  // workers; a live payroll risk once entry is spread across many hands.
  it("does NOT yet match a name whose inner spacing differs", async () => {
    setData({ workerTasks: [task("Ram  Bahadur", 40)] });

    const snapshot = await getHrSnapshot();
    const ram = snapshot.reports.employeePerformance.find(
      (row) => row.employeeId === "EMP-RAM",
    );

    expect(ram?.completedPairs).toBe(0);
    expect(snapshot.summary.unregisteredWorkers).toBe(1);
  });

  it("gives a payroll suggestion only the days that worker actually worked", async () => {
    setData({
      attendanceRecords: [
        attendance("EMP-RAM", "Ram Bahadur", "05"),
        attendance("EMP-RAM", "Ram Bahadur", "06"),
        attendance("EMP-RAM", "Ram Bahadur", "07"),
        attendance("EMP-SITA", "Sita Devi", "05"),
      ],
    });

    const snapshot = await getHrSnapshot();
    const byId = new Map(
      snapshot.reports.payrollSuggestions.map((row) => [row.employeeId, row]),
    );

    expect(byId.get("EMP-RAM")?.presentDays).toBe(3);
    expect(byId.get("EMP-SITA")?.presentDays).toBe(1);
  });

  it("ignores attendance from other months", async () => {
    setData({
      attendanceRecords: [
        attendance("EMP-RAM", "Ram Bahadur", "05"),
        { ...attendance("EMP-RAM", "Ram Bahadur", "05"), id: "ATT-OLD", workDate: "2020-01-05" },
      ],
    });

    const snapshot = await getHrSnapshot();
    const ram = snapshot.reports.monthlyAttendanceSummary.find(
      (row) => row.employeeId === "EMP-RAM",
    );

    expect(ram?.presentDays).toBe(1);
  });
});
