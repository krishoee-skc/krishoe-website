import Link from "next/link";
import { redirect } from "next/navigation";
import WorkerPortalShell from "@/components/worker/WorkerPortalShell";
import WorkerPortalUnavailable from "@/components/worker/WorkerPortalUnavailable";
import { getCurrentWorkerAccess } from "@/lib/worker-auth";

function money(value: number) {
  return `Rs. ${Math.round(value).toLocaleString("en-IN")}`;
}

function monthKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

export default async function WorkerDashboardPage() {
  const access = await getCurrentWorkerAccess();
  if (!access.authenticated) redirect("/worker/login");
  if (!access.linked) return <WorkerPortalUnavailable reason={access.reason} />;

  const { detail } = access;
  const currentMonth = monthKey();
  const attendance = detail.attendanceRecords.filter((record) =>
    record.workDate.startsWith(currentMonth),
  );
  const attendanceDays = attendance.reduce(
    (total, record) => total + (record.status === "Present" ? 1 : record.status === "Half Day" ? 0.5 : 0),
    0,
  );
  const publishedPayroll = detail.payrollRecords.find(
    (record) => record.periodLabel.startsWith(currentMonth) && record.status !== "Draft",
  );
  const completedPairs = detail.workerTasks.reduce((total, task) => total + task.completedPairs, 0);
  const targetPairs = detail.workerTasks.reduce((total, task) => total + task.targetPairs, 0);
  const progress = targetPairs > 0 ? Math.min(100, Math.round((completedPairs / targetPairs) * 100)) : 0;

  return (
    <WorkerPortalShell workerName={detail.employee.name}>
      <section className="rounded-lg bg-brand-green-ink p-6 text-white md:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-gold-bright">My work</p>
        <h1 className="mt-3 text-3xl font-black md:text-4xl">Welcome, {detail.employee.name}</h1>
        <p className="mt-2 text-sm text-white/70">
          {detail.employee.department} · {detail.employee.employmentType} · {detail.employee.salaryType}
        </p>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Published pay this month", publishedPayroll ? money(publishedPayroll.netPay) : "Not published"],
          ["Attendance days", attendanceDays.toLocaleString("en-IN")],
          ["Assigned pairs complete", completedPairs.toLocaleString("en-IN")],
          ["Production progress", `${progress}%`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-black text-brand-green-ink">{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-xl font-black text-brand-green-ink">Profile</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-gray-500">Employee ID</dt><dd className="font-bold">{detail.employee.id}</dd></div>
            <div><dt className="text-gray-500">Phone</dt><dd className="font-bold">{detail.employee.phone || "Not recorded"}</dd></div>
            <div><dt className="text-gray-500">Role</dt><dd className="font-bold">{detail.employee.role || "Worker"}</dd></div>
            <div><dt className="text-gray-500">Joined</dt><dd className="font-bold">{detail.employee.joinedAt}</dd></div>
          </dl>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-xl font-black text-brand-green-ink">Quick access</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ["Attendance", "/worker/attendance"],
              ["Production", "/worker/production"],
              ["Payslips", "/worker/payslip"],
            ].map(([label, href]) => (
              <Link key={href} href={href} className="rounded-lg bg-brand-mist p-4 text-center text-sm font-black text-brand-green-ink">
                {label}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </WorkerPortalShell>
  );
}
