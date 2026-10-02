import Link from "next/link";
import { redirect } from "next/navigation";
import WorkerPortalShell from "@/components/worker/WorkerPortalShell";
import WorkerPortalUnavailable from "@/components/worker/WorkerPortalUnavailable";
import { money } from "@/lib/format-money";
import { getCurrentWorkerAccess } from "@/lib/worker-auth";
import { countOpenRequests, isWorkerOnLeave, recentWorkerPayment } from "@/lib/worker-portal";

function nepalParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { month: `${get("year")}-${get("month")}`, today: `${get("year")}-${get("month")}-${get("day")}` };
}

/**
 * The worker's home (owner, 2026-10-02: bigger, easier). Today first — the
 * pairs and the money of today — then the month and what is still owed, a
 * note when pay was sent, and the four things a worker does here as big
 * buttons. Every figure is the factory's own books.
 */
export default async function WorkerDashboardPage() {
  const access = await getCurrentWorkerAccess();
  if (!access.authenticated) redirect("/worker/login");
  if (!access.linked) return <WorkerPortalUnavailable reason={access.reason} closed={"closed" in access && access.closed} />;

  const { detail } = access;
  const { month: currentMonth, today } = nepalParts();
  const thisMonth = detail.months.find((month) => month.month === currentMonth);
  const monthWork = detail.work.filter((entry) => entry.date.startsWith(currentMonth));
  const todayWork = detail.work.filter((entry) => entry.date.startsWith(today) && entry.status !== "reversed");
  const todayPairs = todayWork.reduce((sum, entry) => sum + entry.pairs, 0);
  const todayEarned = todayWork.reduce((sum, entry) => sum + entry.amountEarned, 0);
  const todayItems = [...new Set(todayWork.map((entry) => entry.itemName).filter(Boolean))].join(", ");
  // Days worked, counted from the entries themselves — the factory records pairs
  // handed over, not clock-in times.
  const daysWorked = new Set(monthWork.map((entry) => entry.date)).size;

  const [payment, openRequests, onLeave] = await Promise.all([
    recentWorkerPayment(detail.worker.id).catch(() => null),
    countOpenRequests(detail.worker.id).catch(() => 0),
    isWorkerOnLeave(detail.worker.id).catch(() => false),
  ]);
  const firstName = detail.worker.name.split(/\s+/)[0] || detail.worker.name;

  return (
    <WorkerPortalShell workerName={detail.worker.name}>
      <p className="text-xl font-black text-brand-green-ink">नमस्ते, {firstName} 🙏</p>
      <p className="mt-0.5 text-sm text-brand-muted">
        {detail.worker.category} · {onLeave ? "🟡 बिदामा" : "🟢 काममा"}
      </p>

      {payment ? (
        <p className="mt-4 rounded-2xl border border-brand-gold bg-brand-cream-soft px-4 py-3 text-base font-black text-brand-green-ink">
          🔔 तलब पठाइयो: {money(payment.amount)} · {payment.date}
        </p>
      ) : null}

      <section className="mt-4 rounded-3xl bg-gradient-to-br from-brand-green-ink to-brand-green p-5 text-white">
        <p className="text-sm font-black text-brand-gold-bright">आज · Today</p>
        <p className="mt-1 text-4xl font-black leading-tight text-white">{todayPairs.toLocaleString("en-IN")} जोडी</p>
        <p className="mt-1 text-base text-white/85">
          {todayPairs > 0 ? `${money(todayEarned)} कमाइ${todayItems ? ` · ${todayItems}` : ""}` : "आज अझै काम टिपिएको छैन"}
        </p>
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-brand-green-line bg-brand-paper p-4">
          <p className="text-sm font-bold text-brand-muted">यो महिना</p>
          <p className="mt-1 text-2xl font-black text-brand-green-ink">{(thisMonth?.totalPairs ?? 0).toLocaleString("en-IN")} जोडी</p>
          <p className="text-sm text-brand-muted">{money(thisMonth?.totalEarned ?? 0)} कमाइ</p>
        </div>
        <div className="rounded-2xl border border-brand-green-line bg-brand-paper p-4">
          <p className="text-sm font-bold text-brand-muted">बाँकी तलब</p>
          <p className="mt-1 text-2xl font-black text-brand-green-ink">{money(detail.balance)}</p>
          <p className="text-sm text-brand-muted">यो महिना पाएको {money(thisMonth?.totalPaid ?? 0)}</p>
        </div>
      </section>

      <section className="mt-4 grid gap-3">
        {[
          { href: "/worker/photos", icon: "📷", label: "कामको फोटो पठाउने", main: true },
          { href: "/worker/production", icon: "🧾", label: "मेरो काम हेर्ने" },
          { href: "/worker/ask?about=hisab", icon: "⚖️", label: "हिसाब मिलेन? भन्ने" },
          { href: "/worker/ask?about=advance", icon: "💵", label: "पेस्की माग्ने" },
          { href: "/worker/payslip", icon: "💰", label: "मेरो तलब (payslip)" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex min-h-16 items-center gap-3 rounded-2xl border px-4 text-lg font-black ${
              item.main ? "border-brand-green bg-brand-green text-white" : "border-brand-green-line bg-brand-paper text-brand-green-ink"
            }`}
          >
            <span aria-hidden="true" className={`grid h-11 w-11 place-items-center rounded-xl text-xl ${item.main ? "bg-white/15" : "bg-brand-green-wash"}`}>
              {item.icon}
            </span>
            {item.label}
          </Link>
        ))}
      </section>

      {openRequests > 0 ? (
        <p className="mt-3 text-base font-bold text-brand-muted">
          <Link href="/worker/ask" className="text-brand-green underline underline-offset-4">{openRequests} कुरा मालिकले हेर्न बाँकी</Link>
        </p>
      ) : null}

      <section className="mt-5 rounded-2xl border border-brand-green-line bg-brand-paper p-4">
        <dl className="grid grid-cols-2 gap-3 text-base">
          <div>
            <dt className="text-sm text-brand-muted">यो महिना काम गरेको दिन</dt>
            <dd className="text-xl font-black">{daysWorked}</dd>
          </div>
          <div>
            <dt className="text-sm text-brand-muted">काम टिपिएको पटक</dt>
            <dd className="text-xl font-black">{monthWork.length}</dd>
          </div>
        </dl>
        <p className="mt-3 rounded-xl bg-brand-mist px-3 py-2 text-sm leading-6 text-brand-muted">
          यहाँ देखिने रकम कारखानाको आधिकारिक हिसाब हो। नमिलेको लागे "हिसाब मिलेन?" थिच्नुहोस्।
        </p>
      </section>
    </WorkerPortalShell>
  );
}
