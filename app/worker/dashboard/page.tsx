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
  const thisMonth = detail.months.find((month) => month.month === currentMonth);
  const monthWork = detail.work.filter((entry) => entry.date.startsWith(currentMonth));
  // Days worked, counted from the entries themselves — the factory records pairs
  // handed over, not clock-in times, so a day a worker produced is the honest
  // stand-in for attendance.
  const daysWorked = new Set(monthWork.map((entry) => entry.date)).size;

  return (
    <WorkerPortalShell workerName={detail.worker.name}>
      <section className="rounded-lg bg-brand-green-ink p-6 text-white md:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-gold-bright">
          मेरो काम · My work
        </p>
        {/* Explicit text-white: globals.css colours every heading with --ink,
            and that direct match beats the white inherited from this panel. */}
        <h1 className="mt-3 text-3xl font-black text-white md:text-4xl">{detail.worker.name}</h1>
        <p className="mt-2 text-sm text-white/70">{detail.worker.category}</p>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["यो महिना बनाएको जोडी", (thisMonth?.totalPairs ?? 0).toLocaleString("en-IN")],
          ["यो महिनाको कमाइ", money(thisMonth?.totalEarned ?? 0)],
          ["यो महिना पाएको", money(thisMonth?.totalPaid ?? 0)],
          ["जम्मा बाँकी", money(detail.balance)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
            <p className="text-sm font-semibold text-brand-muted">{label}</p>
            <p className="mt-2 text-2xl font-black text-brand-green-ink">{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-brand-green-line bg-brand-paper p-6">
          <h2 className="text-xl font-black text-brand-green-ink">यो महिना · This month</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-brand-muted">काम गरेको दिन</dt>
              <dd className="font-bold">{daysWorked}</dd>
            </div>
            <div>
              <dt className="text-brand-muted">काम टिपिएको पटक</dt>
              <dd className="font-bold">{monthWork.length}</dd>
            </div>
            <div>
              <dt className="text-brand-muted">श्रेणी</dt>
              <dd className="font-bold">{detail.worker.category}</dd>
            </div>
            <div>
              <dt className="text-brand-muted">अवस्था</dt>
              <dd className="font-bold">{detail.worker.status}</dd>
            </div>
          </dl>
          <p className="mt-4 rounded-lg bg-brand-mist px-4 py-3 text-xs leading-5 text-brand-muted">
            हिसाब नमिलेको लागे मालिक वा HR लाई भन्नुहोस्। यहाँ देखिने रकम कारखानाको
            आधिकारिक हिसाब हो।
          </p>
        </div>

        <div className="rounded-lg border border-brand-green-line bg-brand-paper p-6">
          <h2 className="text-xl font-black text-brand-green-ink">छिटो जानुहोस्</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["मेरो काम · Production", "/worker/production"],
              ["मेरो तलब · Payslip", "/worker/payslip"],
            ].map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="rounded-lg bg-brand-mist p-4 text-center text-sm font-black text-brand-green-ink"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </WorkerPortalShell>
  );
}
