import Link from "next/link";
import { formatAdminDate } from "@/lib/format-date";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  createAttendanceAction,
  createPayrollAction,
  deleteHrRecordAction,
  updatePayrollStatusAction,
} from "@/app/admin/hr/actions";
import { getEmployeeHrDetail } from "@/lib/hr";

type EmployeeHrPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

const inputClass =
  "h-10 rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand-green";
const textareaClass =
  "min-h-20 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-green";

function money(value: number) {
  return `Rs. ${value.toLocaleString("en-IN")}`;
}

function formatDate(value: string) {
  return formatAdminDate(value, { time: false });
}

function StatBox({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-brand-green-ink">{value}</p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
        {detail}
      </p>
    </div>
  );
}

function statusClass(status: string) {
  if (status === "Ready" || status === "Paid" || status === "Locked" || status === "Done") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (status === "Draft" || status === "Approved" || status === "In Progress" || status === "Paused") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-gray-200 bg-gray-50 text-gray-700";
}

function nextPayrollStatus(status: string) {
  if (status === "Draft") return "Approved";
  if (status === "Approved") return "Paid";
  if (status === "Paid") return "Locked";
  return "";
}

export async function generateMetadata({ params }: EmployeeHrPageProps): Promise<Metadata> {
  const { id } = await params;
  const detail = await getEmployeeHrDetail(id);

  return {
    title: detail ? `${detail.employee.name} HR Profile | KRISHOE Admin` : "Employee Not Found",
  };
}

export default async function EmployeeHrPage({ params }: EmployeeHrPageProps) {
  const { id } = await params;
  const detail = await getEmployeeHrDetail(id);

  if (!detail) {
    notFound();
  }

  const employee = detail.employee;
  const suggestion = detail.payrollSuggestion;
  const nextPath = `/admin/hr/employee/${employee.id}`;

  return (
    <section className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/hr"
            className="text-sm font-bold text-brand-green underline underline-offset-4"
          >
            Back to HR
          </Link>
          <h1 className="mt-3 text-2xl font-black text-brand-green-ink">{employee.name}</h1>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            {employee.department} | {employee.role || "No role"} | {employee.salaryType}
            {employee.fingerprintId ? ` | Device ${employee.fingerprintId}` : ""}
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(employee.status)}`}>
          {employee.status}
        </span>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <StatBox label="Attendance" value={detail.summary.attendanceDays} detail={`${detail.summary.presentRecords} records`} />
        <StatBox label="Output" value={detail.summary.completedPairs} detail={`${detail.summary.progressRate}% progress`} />
        <StatBox label="Net payroll" value={money(detail.summary.netPay)} detail={`${money(detail.summary.draftPay)} draft`} />
        <StatBox label="Overtime" value={detail.summary.overtimeHours} detail={`${detail.summary.absentDays} absent`} />
      </div>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-brand-green-ink">Auto salary draft</h2>
            <p className="mt-1 text-sm text-gray-500">
              {suggestion.periodLabel} calculation from attendance, worker output, and overtime.
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(suggestion.statusSignal)}`}>
            {suggestion.statusSignal}
          </span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-5">
          <div className="rounded-md bg-gray-50 p-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">Base</p>
            <p className="mt-2 font-black text-brand-green-ink">{money(suggestion.baseAmount)}</p>
          </div>
          <div className="rounded-md bg-gray-50 p-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">Piece</p>
            <p className="mt-2 font-black text-brand-green-ink">{money(suggestion.pieceAmount)}</p>
          </div>
          <div className="rounded-md bg-gray-50 p-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">Overtime</p>
            <p className="mt-2 font-black text-brand-green-ink">{money(suggestion.overtimeAmount)}</p>
          </div>
          <div className="rounded-md bg-gray-50 p-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">Deduction</p>
            <p className="mt-2 font-black text-brand-clay">{money(suggestion.deduction)}</p>
          </div>
          <div className="rounded-md bg-emerald-50 p-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Net</p>
            <p className="mt-2 font-black text-emerald-900">{money(suggestion.netPay)}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500">
            {suggestion.presentDays} days | {suggestion.completedPairs} pairs | {suggestion.overtimeHours} OT | {suggestion.absentDays} absent
          </p>
          <form action={createPayrollAction}>
            <input type="hidden" name="nextPath" value={nextPath} />
            <input type="hidden" name="employeeId" value={suggestion.employeeId} />
            <input type="hidden" name="periodLabel" value={suggestion.periodLabel} />
            <input type="hidden" name="baseAmount" value={suggestion.baseAmount} />
            <input type="hidden" name="pieceAmount" value={suggestion.pieceAmount} />
            <input type="hidden" name="attendanceBonus" value={suggestion.attendanceBonus} />
            <input type="hidden" name="overtimeAmount" value={suggestion.overtimeAmount} />
            <input type="hidden" name="deduction" value={suggestion.deduction} />
            <input type="hidden" name="status" value="Draft" />
            <input type="hidden" name="note" value={suggestion.note} />
            <button
              type="submit"
              disabled={suggestion.hasPayroll || suggestion.netPay <= 0}
              className={`h-10 rounded-full px-4 text-sm font-bold ${
                suggestion.hasPayroll || suggestion.netPay <= 0
                  ? "bg-gray-100 text-gray-400"
                  : "bg-brand-green-ink text-white"
              }`}
            >
              {suggestion.hasPayroll ? "Payroll recorded" : "Create draft payroll"}
            </button>
          </form>
        </div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-brand-green-ink">Attendance history</h2>
          <div className="mt-4 grid gap-3">
            {detail.attendanceRecords.slice(0, 5).map((record) => (
              <form key={`edit-${record.id}`} action={createAttendanceAction} className="rounded-md bg-gray-50 p-3">
                <input type="hidden" name="nextPath" value={nextPath} />
                <input type="hidden" name="employeeId" value={employee.id} />
                <div className="grid gap-3 md:grid-cols-4">
                  <input name="workDate" type="date" className={inputClass} defaultValue={record.workDate} />
                  <select name="status" className={inputClass} defaultValue={record.status} aria-label="Attendance status">
                    <option>Present</option>
                    <option>Half Day</option>
                    <option>Leave</option>
                    <option>Absent</option>
                  </select>
                  <input name="checkIn" className={inputClass} defaultValue={record.checkIn} placeholder="Check in" />
                  <input name="checkOut" className={inputClass} defaultValue={record.checkOut} placeholder="Check out" />
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[150px_1fr_110px]">
                  <input name="overtimeHours" type="number" min="0" step="0.5" className={inputClass} defaultValue={record.overtimeHours} placeholder="OT" />
                  <textarea name="note" className={textareaClass} defaultValue={record.note} placeholder="Attendance note" />
                  <button type="submit" className="h-10 rounded-full bg-brand-green px-4 text-sm font-bold text-white">
                    Save
                  </button>
                </div>
              </form>
            ))}
            {detail.attendanceRecords.length === 0 ? (
              <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-500">No attendance record yet.</p>
            ) : null}
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b text-left text-gray-500">
                <tr>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">OT</th>
                  <th className="py-2 pr-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {detail.attendanceRecords.slice(0, 16).map((record) => (
                  <tr key={record.id}>
                    <td className="py-3 pr-3 font-bold text-brand-green-ink">{formatDate(record.workDate)}</td>
                    <td className="py-3 pr-3">{record.status}</td>
                    <td className="py-3 pr-3">{record.checkIn || "no in"} - {record.checkOut || "no out"}</td>
                    <td className="py-3 pr-3">{record.overtimeHours}</td>
                    <td className="py-3 pr-3">
                      <form action={deleteHrRecordAction}>
                        <input type="hidden" name="nextPath" value={nextPath} />
                        <input type="hidden" name="kind" value="attendance" />
                        <input type="hidden" name="id" value={record.id} />
                        <button type="submit" className="text-xs font-bold text-red-700 underline underline-offset-4">
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {detail.attendanceRecords.length === 0 ? (
                  <tr>
                    <td className="py-6 text-center text-gray-500" colSpan={5}>
                      No attendance record yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-brand-green-ink">Payroll history</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b text-left text-gray-500">
                <tr>
                  <th className="py-2 pr-3">Period</th>
                  <th className="py-2 pr-3">Net</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {detail.payrollRecords.slice(0, 16).map((record) => (
                  <tr key={record.id}>
                    <td className="py-3 pr-3 font-bold text-brand-green-ink">{record.periodLabel}</td>
                    <td className="py-3 pr-3">{money(record.netPay)}</td>
                    <td className="py-3 pr-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${statusClass(record.status)}`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap gap-3 text-xs font-bold">
                        <Link href={`/admin/hr/payroll/${record.id}`} className="text-brand-green underline underline-offset-4">
                          Slip
                        </Link>
                        {nextPayrollStatus(record.status) ? (
                          <form action={updatePayrollStatusAction}>
                            <input type="hidden" name="nextPath" value={nextPath} />
                            <input type="hidden" name="id" value={record.id} />
                            <input type="hidden" name="status" value={nextPayrollStatus(record.status)} />
                            <button type="submit" className="text-brand-green-ink underline underline-offset-4">
                              {nextPayrollStatus(record.status)}
                            </button>
                          </form>
                        ) : null}
                        {record.status !== "Locked" ? (
                          <form action={deleteHrRecordAction}>
                            <input type="hidden" name="nextPath" value={nextPath} />
                            <input type="hidden" name="kind" value="payroll" />
                            <input type="hidden" name="id" value={record.id} />
                            <button type="submit" className="text-red-700 underline underline-offset-4">
                              Delete
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {detail.payrollRecords.length === 0 ? (
                  <tr>
                    <td className="py-6 text-center text-gray-500" colSpan={4}>
                      No payroll record yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-brand-green-ink">Worker tasks</h2>
            <p className="mt-1 text-sm text-gray-500">
              Production task link by employee name from operations.
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
                <th className="py-2 pr-3">Design</th>
                <th className="py-2 pr-3">Station</th>
                <th className="py-2 pr-3">Output</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Camera zone</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {detail.workerTasks.slice(0, 16).map((task) => (
                <tr key={task.id}>
                  <td className="py-3 pr-3 font-bold text-brand-green-ink">{task.design}</td>
                  <td className="py-3 pr-3">{task.station}</td>
                  <td className="py-3 pr-3">{task.completedPairs}/{task.targetPairs}</td>
                  <td className="py-3 pr-3">{task.status}</td>
                  <td className="py-3 pr-3">{task.cameraZone || "No zone"}</td>
                </tr>
              ))}
              {detail.workerTasks.length === 0 ? (
                <tr>
                  <td className="py-6 text-center text-gray-500" colSpan={5}>
                    No worker task linked to this employee yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
