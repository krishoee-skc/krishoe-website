import { redirect } from "next/navigation";
import WorkerPortalShell from "@/components/worker/WorkerPortalShell";
import WorkerPortalUnavailable from "@/components/worker/WorkerPortalUnavailable";
import { getCurrentWorkerAccess } from "@/lib/worker-auth";

type Props = { searchParams?: Promise<{ month?: string }> };

function currentMonth() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
  }).format(new Date()).slice(0, 7);
}

export default async function AttendancePage({ searchParams }: Props) {
  const access = await getCurrentWorkerAccess();
  if (!access.authenticated) redirect("/worker/login");
  if (!access.linked) return <WorkerPortalUnavailable reason={access.reason} />;

  const requestedMonth = (await searchParams)?.month || "";
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth) ? requestedMonth : currentMonth();
  const records = access.detail.attendanceRecords.filter((record) => record.workDate.startsWith(month));
  const count = (status: string) => records.filter((record) => record.status === status).length;
  const attendanceUnits = records.reduce(
    (total, record) => total + (record.status === "Present" ? 1 : record.status === "Half Day" ? 0.5 : 0),
    0,
  );
  const attendanceRate = records.length > 0 ? Math.round((attendanceUnits / records.length) * 100) : 0;

  return (
    <WorkerPortalShell workerName={access.detail.employee.name}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-gold-deep">My attendance</p>
          <h1 className="mt-2 text-3xl font-black text-brand-green-ink">Attendance records</h1>
        </div>
        <form className="flex items-end gap-2 print:hidden">
          <label className="grid gap-1 text-sm font-bold text-brand-green-ink">
            Month
            <input name="month" type="month" defaultValue={month} className="h-11 rounded-lg border border-gray-200 bg-white px-3" />
          </label>
          <button type="submit" className="h-11 rounded-full bg-brand-green px-5 text-sm font-bold text-white">View</button>
        </form>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ["Present", count("Present")],
          ["Half day", count("Half Day")],
          ["Leave", count("Leave")],
          ["Absent", count("Absent")],
          ["Attendance rate", `${attendanceRate}%`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-black text-brand-green-ink">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        {records.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No attendance records were published for this month.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Check in</th><th className="px-4 py-3">Check out</th><th className="px-4 py-3">Overtime</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((record) => (
                <tr key={record.id}>
                  <td className="px-4 py-3 font-bold">{record.workDate}</td>
                  <td className="px-4 py-3">{record.status}</td>
                  <td className="px-4 py-3">{record.checkIn || "—"}</td>
                  <td className="px-4 py-3">{record.checkOut || "—"}</td>
                  <td className="px-4 py-3">{record.overtimeHours ? `${record.overtimeHours} hr` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </WorkerPortalShell>
  );
}
