import Link from "next/link";
import { formatAdminDate } from "@/lib/format-date";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import ExportButton from "@/components/admin/ExportButton";
import type { Metadata } from "next";
import {
  createAttendanceAction,
  createEmployeeAction,
  createPayrollAction,
  deleteHrRecordAction,
  importFingerprintAttendanceAction,
  updateEmployeeAction,
  updateEmployeeStatusAction,
  updatePayrollStatusAction,
} from "@/app/admin/hr/actions";
import { getHrSnapshot, hrDepartments, type EmployeePerformanceRow } from "@/lib/hr";

export const metadata: Metadata = {
  title: "HR | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

type AdminHrPageProps = {
  searchParams?: Promise<{
    hrImport?: string;
    imported?: string;
    skipped?: string;
    fingerprint?: string;
    name?: string;
    status?: string;
    errorCount?: string;
    errors?: string;
  }>;
};

const inputClass =
  "h-10 rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand-green";
const textareaClass =
  "min-h-20 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-green";

function money(value: number) {
  return `Rs. ${value.toLocaleString("en-IN")}`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey() {
  return new Date().toISOString().slice(0, 7);
}

function formatDate(value: string) {
  return formatAdminDate(value, { time: false });
}

function numberParam(value?: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function StatCard({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: "default" | "good" | "warn" | "danger";
}) {
  const toneClass = {
    default: "border-gray-200 bg-white text-brand-green-ink",
    good: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
    danger: "border-red-200 bg-red-50 text-red-800",
  }[tone];

  return (
    <div className={`rounded-lg border p-5 shadow-sm ${toneClass}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] opacity-65">
        {detail}
      </p>
    </div>
  );
}

function PerformancePill({ row }: { row: EmployeePerformanceRow }) {
  if (row.status === "Unregistered") {
    return (
      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-800">
        Register
      </span>
    );
  }

  if (row.progressRate >= 80) {
    return (
      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-800">
        Strong
      </span>
    );
  }

  if (row.progressRate > 0) {
    return (
      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-800">
        Watch
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-black text-gray-700">
      No tasks
    </span>
  );
}

function nextPayrollStatus(status: string) {
  if (status === "Draft") return "Approved";
  if (status === "Approved") return "Paid";
  if (status === "Paid") return "Locked";
  return "";
}

export default async function AdminHrPage({ searchParams }: AdminHrPageProps) {
  const hr = await getHrSnapshot();
  const resolvedSearchParams = await searchParams;
  const activeEmployees = hr.employees.filter((employee) => employee.status === "Active");
  const deviceMappedEmployees = hr.employees.filter((employee) => employee.fingerprintId).length;
  const importFeedback = resolvedSearchParams?.hrImport
    ? {
        imported: numberParam(resolvedSearchParams.imported),
        skipped: numberParam(resolvedSearchParams.skipped),
        fingerprint: numberParam(resolvedSearchParams.fingerprint),
        name: numberParam(resolvedSearchParams.name),
        errorCount: numberParam(resolvedSearchParams.errorCount),
        errors: resolvedSearchParams.errors ?? "",
        status: resolvedSearchParams.status === "warning" ? "warning" : "success",
      }
    : null;
  const today = todayKey();
  const currentMonth = monthKey();

  return (
    <section className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-brand-green-ink">HR and worker performance</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            Employee master, attendance, salary records, and production-task performance for factory control.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButton
            href="/api/admin/hr/export?type=employees"
            className="rounded-full bg-brand-green px-4 py-2 text-sm font-bold text-white"
          >
            Export employees
          </ExportButton>
          <ExportButton
            href="/api/admin/hr/export?type=performance"
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-brand-green-ink"
          >
            Export performance
          </ExportButton>
          <ExportButton
            href="/api/admin/hr/export?type=payroll"
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-brand-green-ink"
          >
            Export payroll
          </ExportButton>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Active staff" value={hr.summary.activeEmployees} detail={`${hr.summary.employeeCount} total`} tone="good" />
        <StatCard label="Present today" value={hr.summary.todayPresent} detail={formatDate(today)} tone={hr.summary.todayPresent > 0 ? "good" : "warn"} />
        <StatCard label="Month payroll" value={money(hr.summary.monthPayroll)} detail={`${money(hr.summary.draftPayroll)} draft due`} tone={hr.summary.draftPayroll > 0 ? "warn" : "good"} />
        <StatCard label="Worker output" value={hr.summary.completedPairs} detail={`${hr.summary.averageProgressRate}% task progress`} />
        <StatCard label="Attendance days" value={hr.summary.monthAttendanceDays} detail={currentMonth} />
        <StatCard label="Device mapped" value={deviceMappedEmployees} detail="fingerprint ids" tone={deviceMappedEmployees === hr.summary.employeeCount && hr.summary.employeeCount > 0 ? "good" : "warn"} />
        <StatCard label="Unregistered workers" value={hr.summary.unregisteredWorkers} detail="from operations tasks" tone={hr.summary.unregisteredWorkers > 0 ? "warn" : "good"} />
      </div>

      {importFeedback ? (
        <div className={`mt-6 rounded-lg border p-4 text-sm shadow-sm ${
          importFeedback.status === "warning"
            ? "border-amber-200 bg-amber-50 text-amber-900"
            : "border-emerald-200 bg-emerald-50 text-emerald-900"
        }`}>
          <p className="font-black">Fingerprint import result</p>
          <p className="mt-1">
            {importFeedback.imported} attendance day(s) imported, {importFeedback.skipped} row(s) skipped, {importFeedback.fingerprint} matched by device id, {importFeedback.name} matched by name.
          </p>
          {importFeedback.errors ? (
            <p className="mt-2 rounded-md bg-white/70 p-3 font-mono text-xs leading-5">
              {importFeedback.errorCount} error(s): {importFeedback.errors}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <form action={createEmployeeAction} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-brand-green-ink">New employee</h2>
          <div className="mt-4 grid gap-3">
            <input name="name" required className={inputClass} placeholder="Employee name" />
            <input name="phone" className={inputClass} placeholder="Phone" />
            <input name="role" className={inputClass} placeholder="Role or skill" />
            <select name="department" className={inputClass} defaultValue="Cutting" aria-label="Department">
              {hrDepartments.map((department) => (
                <option key={department}>{department}</option>
              ))}
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <select name="employmentType" className={inputClass} defaultValue="Full Time" aria-label="Employment type">
                <option>Full Time</option>
                <option>Part Time</option>
                <option>Contract</option>
              </select>
              <select name="salaryType" className={inputClass} defaultValue="Monthly" aria-label="Salary type">
                <option>Monthly</option>
                <option>Daily</option>
                <option>Piece Rate</option>
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <input name="baseSalary" type="number" min="0" className={inputClass} placeholder="Monthly salary" />
              <input name="dailyWage" type="number" min="0" className={inputClass} placeholder="Daily wage" />
              <input name="pieceRate" type="number" min="0" step="0.01" className={inputClass} placeholder="Piece rate" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="joinedAt" type="date" className={inputClass} defaultValue={today} />
              <select name="status" className={inputClass} defaultValue="Active" aria-label="Employee status">
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </div>
            <input name="fingerprintId" className={inputClass} placeholder="Fingerprint/device id" />
            <textarea name="note" className={textareaClass} placeholder="Skill, address, fingerprint device id, or note" />
            <FormSubmitButton
              className="h-10 rounded-full bg-brand-green-ink px-4 text-sm font-bold text-white"
              pendingLabel="Adding…"
            >
              Add employee
            </FormSubmitButton>
          </div>
        </form>

        <form action={createAttendanceAction} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-brand-green-ink">Attendance</h2>
          <div className="mt-4 grid gap-3">
            <select name="employeeId" required className={inputClass} defaultValue="" aria-label="Employee">
              <option value="">Select employee</option>
              {activeEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} - {employee.department}
                </option>
              ))}
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="workDate" type="date" className={inputClass} defaultValue={today} />
              <select name="status" className={inputClass} defaultValue="Present" aria-label="Attendance status">
                <option>Present</option>
                <option>Half Day</option>
                <option>Leave</option>
                <option>Absent</option>
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <input name="checkIn" className={inputClass} placeholder="Check in" />
              <input name="checkOut" className={inputClass} placeholder="Check out" />
              <input name="overtimeHours" type="number" min="0" step="0.5" className={inputClass} placeholder="OT hours" />
            </div>
            <textarea name="note" className={textareaClass} placeholder="Shift, reason, or device note" />
            <FormSubmitButton
              className="h-10 rounded-full bg-brand-green px-4 text-sm font-bold text-white"
              pendingLabel="Saving…"
            >
              Save attendance
            </FormSubmitButton>
          </div>
        </form>

        <form action={createPayrollAction} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-brand-green-ink">Payroll record</h2>
          <div className="mt-4 grid gap-3">
            <select name="employeeId" required className={inputClass} defaultValue="" aria-label="Payroll employee">
              <option value="">Select employee</option>
              {activeEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} - {employee.salaryType}
                </option>
              ))}
            </select>
            <input name="periodLabel" className={inputClass} defaultValue={currentMonth} placeholder="YYYY-MM" />
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="baseAmount" type="number" min="0" className={inputClass} placeholder="Base amount" />
              <input name="pieceAmount" type="number" min="0" className={inputClass} placeholder="Piece amount" />
              <input name="attendanceBonus" type="number" min="0" className={inputClass} placeholder="Attendance bonus" />
              <input name="overtimeAmount" type="number" min="0" className={inputClass} placeholder="Overtime amount" />
              <input name="deduction" type="number" min="0" className={inputClass} placeholder="Deduction" />
              <select name="status" className={inputClass} defaultValue="Draft" aria-label="Payroll status">
                <option>Draft</option>
                <option>Approved</option>
                <option>Paid</option>
              </select>
            </div>
            <input name="paidAt" type="date" className={inputClass} />
            <textarea name="note" className={textareaClass} placeholder="Salary slip, cash/cheque ref, advance, or note" />
            <FormSubmitButton
              className="h-10 rounded-full bg-brand-green-ink px-4 text-sm font-bold text-white"
              pendingLabel="Saving…"
            >
              Save payroll
            </FormSubmitButton>
          </div>
        </form>
      </div>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-brand-green-ink">Payroll suggestions</h2>
            <p className="mt-1 text-sm text-gray-500">
              Auto draft from attendance, piece output, overtime, and absent-day deduction.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-gray-200 px-3 py-1 text-xs font-black text-gray-600">
              {currentMonth}
            </span>
            <ExportButton href="/api/admin/hr/export?type=payroll-suggestions" className="text-sm font-bold text-brand-green underline underline-offset-4">
              Export
            </ExportButton>
          </div>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b text-left text-gray-500">
              <tr>
                <th className="py-2 pr-3">Employee</th>
                <th className="py-2 pr-3">Basis</th>
                <th className="py-2 pr-3">Work signal</th>
                <th className="py-2 pr-3">Auto pay</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {hr.reports.payrollSuggestions.slice(0, 12).map((row) => (
                <tr key={row.employeeId}>
                  <td className="py-3 pr-3">
                    <Link href={`/admin/hr/employee/${row.employeeId}`} className="font-bold text-brand-green-ink underline-offset-4 hover:underline">
                      {row.employeeName}
                    </Link>
                    <p className="mt-1 text-xs text-gray-500">{row.department}</p>
                  </td>
                  <td className="py-3 pr-3">
                    <p className="font-semibold text-brand-green-ink">{row.salaryType}</p>
                    <p className="mt-1 text-xs text-gray-500">Absent deduction {money(row.deduction)}</p>
                  </td>
                  <td className="py-3 pr-3">
                    <p className="font-semibold text-brand-green-ink">{row.presentDays} days | {row.completedPairs} pairs</p>
                    <p className="mt-1 text-xs text-gray-500">Leave {row.leaveDays} | Absent {row.absentDays} | OT {row.overtimeHours}</p>
                  </td>
                  <td className="py-3 pr-3">
                    <p className="font-black text-brand-green">{money(row.netPay)}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Base {money(row.baseAmount)} | Piece {money(row.pieceAmount)} | OT {money(row.overtimeAmount)}
                    </p>
                  </td>
                  <td className="py-3 pr-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${
                      row.statusSignal === "Ready"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : row.statusSignal === "Recorded"
                          ? "border-gray-200 bg-gray-50 text-gray-700"
                          : "border-amber-200 bg-amber-50 text-amber-800"
                    }`}>
                      {row.statusSignal}
                    </span>
                  </td>
                  <td className="py-3 pr-3">
                    <form action={createPayrollAction}>
                      <input type="hidden" name="nextPath" value="/admin/hr" />
                      <input type="hidden" name="employeeId" value={row.employeeId} />
                      <input type="hidden" name="periodLabel" value={row.periodLabel} />
                      <input type="hidden" name="baseAmount" value={row.baseAmount} />
                      <input type="hidden" name="pieceAmount" value={row.pieceAmount} />
                      <input type="hidden" name="attendanceBonus" value={row.attendanceBonus} />
                      <input type="hidden" name="overtimeAmount" value={row.overtimeAmount} />
                      <input type="hidden" name="deduction" value={row.deduction} />
                      <input type="hidden" name="status" value="Draft" />
                      <input type="hidden" name="note" value={row.note} />
                      <button
                        type="submit"
                        disabled={row.hasPayroll || row.netPay <= 0}
                        className={`h-9 rounded-full px-4 text-xs font-black ${
                          row.hasPayroll || row.netPay <= 0
                            ? "bg-gray-100 text-gray-400"
                            : "bg-brand-green-ink text-white"
                        }`}
                      >
                        {row.hasPayroll ? "Recorded" : "Create draft"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {hr.reports.payrollSuggestions.length === 0 ? (
                <tr>
                  <td className="py-6 text-center text-gray-500" colSpan={6}>
                    No active employee for payroll suggestion.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-brand-green-ink">Monthly salary closing</h2>
            <p className="mt-1 text-sm text-gray-500">
              Compare auto salary, recorded payroll, paid amount, draft due, and variance.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/hr/salary-closing" className="text-sm font-bold text-brand-green-ink underline underline-offset-4">
              Print
            </Link>
            <ExportButton href="/api/admin/hr/export?type=salary-closing" className="text-sm font-bold text-brand-green underline underline-offset-4">
              Export
            </ExportButton>
          </div>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b text-left text-gray-500">
              <tr>
                <th className="py-2 pr-3">Employee</th>
                <th className="py-2 pr-3">Work</th>
                <th className="py-2 pr-3">Suggested</th>
                <th className="py-2 pr-3">Recorded</th>
                <th className="py-2 pr-3">Paid/Draft</th>
                <th className="py-2 pr-3">Variance</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {hr.reports.monthlySalaryClosing.slice(0, 14).map((row) => (
                <tr key={row.employeeId}>
                  <td className="py-3 pr-3">
                    <Link href={`/admin/hr/employee/${row.employeeId}`} className="font-bold text-brand-green-ink underline-offset-4 hover:underline">
                      {row.employeeName}
                    </Link>
                    <p className="mt-1 text-xs text-gray-500">{row.department} | {row.salaryType}</p>
                  </td>
                  <td className="py-3 pr-3">
                    <p>{row.attendanceDays} days</p>
                    <p className="text-xs text-gray-500">{row.completedPairs} pairs</p>
                  </td>
                  <td className="py-3 pr-3">{money(row.suggestedNetPay)}</td>
                  <td className="py-3 pr-3">{money(row.recordedNetPay)}</td>
                  <td className="py-3 pr-3">
                    <p className="font-semibold text-brand-green">{money(row.paidNetPay)}</p>
                    <p className="text-xs text-gray-500">Pending {money(row.draftNetPay)}</p>
                  </td>
                  <td className={`py-3 pr-3 font-black ${row.variance === 0 ? "text-gray-500" : row.variance > 0 ? "text-brand-green" : "text-brand-clay"}`}>
                    {money(row.variance)}
                  </td>
                  <td className="py-3 pr-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${
                      row.statusSignal === "Closed"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : row.statusSignal === "Payment pending"
                          ? "border-amber-200 bg-amber-50 text-amber-800"
                          : row.statusSignal === "Review variance"
                            ? "border-red-200 bg-red-50 text-red-800"
                            : "border-gray-200 bg-gray-50 text-gray-700"
                    }`}>
                      {row.statusSignal}
                    </span>
                  </td>
                </tr>
              ))}
              {hr.reports.monthlySalaryClosing.length === 0 ? (
                <tr>
                  <td className="py-6 text-center text-gray-500" colSpan={7}>
                    No salary closing rows yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-brand-green-ink">Fingerprint attendance import</h2>
            <p className="mt-1 text-sm text-gray-500">
              Match by fingerprint/device id first, then employee name.
            </p>
          </div>
          <ExportButton href="/api/admin/hr/export?type=fingerprint-template" className="text-sm font-bold text-brand-green underline underline-offset-4">
            Template CSV
          </ExportButton>
        </div>
        <form action={importFingerprintAttendanceAction} className="mt-5 grid gap-4 xl:grid-cols-[1fr_220px]">
          <textarea
            name="csv"
            required
            className={`${textareaClass} min-h-40 font-mono`}
            placeholder={"fingerprintId,employeeName,workDate,checkIn,checkOut,status,overtimeHours,note\nFP-001,Ramesh BK,2026-07-12,08:55,17:30,Present,1,Device export"}
          />
          <div className="grid content-start gap-3 rounded-md bg-gray-50 p-4">
            <p className="text-sm font-black text-brand-green-ink">Supported columns</p>
            <p className="text-xs leading-5 text-gray-500">
              fingerprintId, deviceId, userId, employeeName, timestamp, punchTime, checkIn, checkOut, status, overtimeHours, note.
            </p>
            <button type="submit" className="h-10 rounded-full bg-brand-green px-4 text-sm font-bold text-white">
              Import CSV
            </button>
          </div>
        </form>
      </section>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-brand-green-ink">Employee management</h2>
            <p className="mt-1 text-sm text-gray-500">
              Staff profile, salary basis, fingerprint id, and employment status.
            </p>
          </div>
          <ExportButton href="/api/admin/hr/export?type=employees" className="text-sm font-bold text-brand-green underline underline-offset-4">
            Export
          </ExportButton>
        </div>

        <div className="mt-5 divide-y divide-gray-100">
          {hr.employees.map((employee) => (
            <details key={employee.id} className="group py-4">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-brand-green-ink">{employee.name}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {employee.department} | {employee.role || "No role"} | {employee.salaryType}
                    {employee.fingerprintId ? ` | Device ${employee.fingerprintId}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${
                    employee.status === "Active"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-gray-200 bg-gray-50 text-gray-700"
                  }`}>
                    {employee.status}
                  </span>
                  <Link href={`/admin/hr/employee/${employee.id}`} className="text-xs font-bold text-brand-green underline underline-offset-4">
                    Profile
                  </Link>
                  <span className="text-xs font-bold text-brand-green group-open:hidden">Edit</span>
                </div>
              </summary>

              <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_220px]">
                <form action={updateEmployeeAction} className="grid gap-3">
                  <input type="hidden" name="id" value={employee.id} />
                  <div className="grid gap-3 md:grid-cols-4">
                    <input name="name" required className={inputClass} defaultValue={employee.name} placeholder="Employee name" />
                    <input name="phone" className={inputClass} defaultValue={employee.phone} placeholder="Phone" />
                    <input name="role" className={inputClass} defaultValue={employee.role} placeholder="Role" />
                    <input name="fingerprintId" className={inputClass} defaultValue={employee.fingerprintId} placeholder="Fingerprint id" />
                  </div>
                  <div className="grid gap-3 md:grid-cols-5">
                    <select name="department" className={inputClass} defaultValue={employee.department} aria-label="Department">
                      {hrDepartments.map((department) => (
                        <option key={department}>{department}</option>
                      ))}
                    </select>
                    <select name="employmentType" className={inputClass} defaultValue={employee.employmentType} aria-label="Employment type">
                      <option>Full Time</option>
                      <option>Part Time</option>
                      <option>Contract</option>
                    </select>
                    <select name="salaryType" className={inputClass} defaultValue={employee.salaryType} aria-label="Salary type">
                      <option>Monthly</option>
                      <option>Daily</option>
                      <option>Piece Rate</option>
                    </select>
                    <input name="joinedAt" type="date" className={inputClass} defaultValue={employee.joinedAt} />
                    <select name="status" className={inputClass} defaultValue={employee.status} aria-label="Status">
                      <option>Active</option>
                      <option>Inactive</option>
                    </select>
                  </div>
                  <div className="grid gap-3 md:grid-cols-4">
                    <input name="baseSalary" type="number" min="0" className={inputClass} defaultValue={employee.baseSalary} placeholder="Monthly salary" />
                    <input name="dailyWage" type="number" min="0" className={inputClass} defaultValue={employee.dailyWage} placeholder="Daily wage" />
                    <input name="pieceRate" type="number" min="0" step="0.01" className={inputClass} defaultValue={employee.pieceRate} placeholder="Piece rate" />
                    <button type="submit" className="h-10 rounded-full bg-brand-green-ink px-4 text-sm font-bold text-white">
                      Save employee
                    </button>
                  </div>
                  <textarea name="note" className={textareaClass} defaultValue={employee.note} placeholder="Employee note" />
                </form>

                <div className="grid content-start gap-2">
                  <form action={updateEmployeeStatusAction}>
                    <input type="hidden" name="id" value={employee.id} />
                    <input type="hidden" name="status" value={employee.status === "Active" ? "Inactive" : "Active"} />
                    <button type="submit" className="h-10 w-full rounded-full border border-gray-200 px-4 text-sm font-bold text-brand-green-ink">
                      {employee.status === "Active" ? "Mark inactive" : "Mark active"}
                    </button>
                  </form>
                  <form action={deleteHrRecordAction}>
                    <input type="hidden" name="kind" value="employee" />
                    <input type="hidden" name="id" value={employee.id} />
                    <button type="submit" className="h-10 w-full rounded-full border border-red-200 px-4 text-sm font-bold text-red-700">
                      Delete employee
                    </button>
                  </form>
                </div>
              </div>
            </details>
          ))}
          {hr.employees.length === 0 ? (
            <p className="py-4 text-sm text-gray-500">No employee record yet.</p>
          ) : null}
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-brand-green-ink">Worker performance</h2>
            <p className="mt-1 text-sm text-gray-500">
              Matched from operations worker tasks by employee name.
            </p>
          </div>
          <Link href="/admin/operations" className="text-sm font-bold text-brand-green underline underline-offset-4">
            Open operations
          </Link>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b text-left text-gray-500">
              <tr>
                <th className="py-2 pr-3">Worker</th>
                <th className="py-2 pr-3">Department</th>
                <th className="py-2 pr-3">Tasks</th>
                <th className="py-2 pr-3">Output</th>
                <th className="py-2 pr-3">Attendance</th>
                <th className="py-2 pr-3">Payroll</th>
                <th className="py-2 pr-3">Signal</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {hr.reports.employeePerformance.slice(0, 20).map((row) => (
                <tr key={`${row.employeeName}-${row.department}`}>
                  <td className="py-3 pr-3">
                    <p className="font-bold text-brand-green-ink">{row.employeeName}</p>
                    <p className="text-xs text-gray-500">{row.status}</p>
                  </td>
                  <td className="py-3 pr-3">{row.department}</td>
                  <td className="py-3 pr-3">{row.doneTaskCount}/{row.taskCount}</td>
                  <td className="py-3 pr-3">
                    <span className="font-semibold text-brand-green-ink">{row.completedPairs}/{row.targetPairs}</span>
                    <span className="block text-xs text-gray-500">{row.progressRate}% progress</span>
                  </td>
                  <td className="py-3 pr-3">{row.attendanceDaysThisMonth} days</td>
                  <td className="py-3 pr-3">
                    {money(row.payrollThisMonth)}
                    {row.piecePayEstimate > 0 ? (
                      <span className="block text-xs text-gray-500">Piece est. {money(row.piecePayEstimate)}</span>
                    ) : null}
                  </td>
                  <td className="py-3 pr-3">
                    <PerformancePill row={row} />
                  </td>
                </tr>
              ))}
              {hr.reports.employeePerformance.length === 0 ? (
                <tr>
                  <td className="py-6 text-center text-gray-500" colSpan={7}>
                    No employee or worker task data yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-brand-green-ink">Monthly attendance report</h2>
              <p className="mt-1 text-sm text-gray-500">{currentMonth} attendance, overtime, and output signal.</p>
            </div>
            <ExportButton href="/api/admin/hr/export?type=attendance-summary" className="text-sm font-bold text-brand-green underline underline-offset-4">
              Export
            </ExportButton>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b text-left text-gray-500">
                <tr>
                  <th className="py-2 pr-3">Employee</th>
                  <th className="py-2 pr-3">Present</th>
                  <th className="py-2 pr-3">Leave</th>
                  <th className="py-2 pr-3">Absent</th>
                  <th className="py-2 pr-3">OT</th>
                  <th className="py-2 pr-3">Output</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {hr.reports.monthlyAttendanceSummary.slice(0, 12).map((row) => (
                  <tr key={row.employeeId}>
                    <td className="py-3 pr-3">
                      <p className="font-bold text-brand-green-ink">{row.employeeName}</p>
                      <p className="text-xs text-gray-500">{row.department}</p>
                    </td>
                    <td className="py-3 pr-3">{row.presentDays}</td>
                    <td className="py-3 pr-3">{row.leaveDays}</td>
                    <td className="py-3 pr-3">{row.absentDays}</td>
                    <td className="py-3 pr-3">{row.overtimeHours}</td>
                    <td className="py-3 pr-3">{row.completedPairs}</td>
                  </tr>
                ))}
                {hr.reports.monthlyAttendanceSummary.length === 0 ? (
                  <tr>
                    <td className="py-6 text-center text-gray-500" colSpan={6}>
                      No monthly attendance data yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-brand-green-ink">Monthly payroll report</h2>
              <p className="mt-1 text-sm text-gray-500">{currentMonth} gross, deduction, net, and payment status.</p>
            </div>
            <ExportButton href="/api/admin/hr/export?type=payroll-summary" className="text-sm font-bold text-brand-green underline underline-offset-4">
              Export
            </ExportButton>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b text-left text-gray-500">
                <tr>
                  <th className="py-2 pr-3">Employee</th>
                  <th className="py-2 pr-3">Gross</th>
                  <th className="py-2 pr-3">Deduction</th>
                  <th className="py-2 pr-3">Net</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Slip</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {hr.reports.monthlyPayrollSummary.slice(0, 12).map((row) => (
                  <tr key={row.id}>
                    <td className="py-3 pr-3 font-bold text-brand-green-ink">{row.employeeName}</td>
                    <td className="py-3 pr-3">{money(row.grossPay)}</td>
                    <td className="py-3 pr-3">{money(row.deduction)}</td>
                    <td className="py-3 pr-3 font-black text-brand-green-ink">{money(row.netPay)}</td>
                    <td className="py-3 pr-3">{row.status}</td>
                    <td className="py-3 pr-3">
                      <Link href={`/admin/hr/payroll/${row.id}`} className="font-bold text-brand-green underline underline-offset-4">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
                {hr.reports.monthlyPayrollSummary.length === 0 ? (
                  <tr>
                    <td className="py-6 text-center text-gray-500" colSpan={6}>
                      No monthly payroll data yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-brand-green-ink">Station headcount</h2>
          <div className="mt-4 grid gap-3">
            {hr.reports.stationHeadcount.map((row) => (
              <div key={row.department} className="rounded-md bg-gray-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-brand-green-ink">{row.department}</p>
                  <p className="text-sm font-black text-brand-green">{row.activeEmployees}</p>
                </div>
                <p className="mt-1 text-xs text-gray-500">Monthly base {money(row.monthlySalaryBase)}</p>
              </div>
            ))}
            {hr.reports.stationHeadcount.length === 0 ? (
              <p className="text-sm text-gray-500">No active employee station data.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-brand-green-ink">Recent attendance</h2>
          <div className="mt-4 divide-y divide-gray-100">
            {hr.reports.recentAttendance.slice(0, 8).map((record) => (
              <div key={record.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-brand-green-ink">{record.employeeName}</p>
                  <span className="text-xs font-bold text-gray-500">{record.status}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-gray-500">
                    {record.workDate} | {record.checkIn || "no in"} - {record.checkOut || "no out"} | OT {record.overtimeHours}
                  </p>
                  <form action={deleteHrRecordAction}>
                    <input type="hidden" name="kind" value="attendance" />
                    <input type="hidden" name="id" value={record.id} />
                    <button type="submit" className="text-xs font-bold text-red-700 underline underline-offset-4">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            ))}
            {hr.reports.recentAttendance.length === 0 ? (
              <p className="py-3 text-sm text-gray-500">No attendance record yet.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-brand-green-ink">Recent payroll</h2>
          <div className="mt-4 divide-y divide-gray-100">
            {hr.reports.recentPayroll.slice(0, 8).map((record) => (
              <div key={record.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-brand-green-ink">{record.employeeName}</p>
                  <span className="text-xs font-bold text-gray-500">{record.status}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {record.periodLabel} | Net {money(record.netPay)} | Deduction {money(record.deduction)}
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold">
                  <Link href={`/admin/hr/payroll/${record.id}`} className="text-brand-green underline underline-offset-4">
                    Slip
                  </Link>
                  {nextPayrollStatus(record.status) ? (
                    <form action={updatePayrollStatusAction}>
                      <input type="hidden" name="id" value={record.id} />
                      <input type="hidden" name="status" value={nextPayrollStatus(record.status)} />
                      <button type="submit" className="text-brand-green-ink underline underline-offset-4">
                        {nextPayrollStatus(record.status)}
                      </button>
                    </form>
                  ) : null}
                  {record.status !== "Locked" ? (
                    <form action={deleteHrRecordAction}>
                      <input type="hidden" name="kind" value="payroll" />
                      <input type="hidden" name="id" value={record.id} />
                      <button type="submit" className="text-red-700 underline underline-offset-4">
                        Delete
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            ))}
            {hr.reports.recentPayroll.length === 0 ? (
              <p className="py-3 text-sm text-gray-500">No payroll record yet.</p>
            ) : null}
          </div>
        </section>
      </div>
    </section>
  );
}
