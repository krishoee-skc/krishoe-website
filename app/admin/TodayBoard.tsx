import Link from "next/link";

/**
 * The first thing on the dashboard, in Nepali: what needs doing today, and the
 * three buttons that do it.
 *
 * Everything below this on the page is a report — numbers to read once the
 * question "what should I do now?" is already answered. That question was
 * answered nowhere, so the owner arrived at a wall of tiles and had to work it
 * out each time. Three lines and three buttons is the whole of it.
 */
export default function TodayBoard({
  todayPairs,
  newOrders,
  lowStockNames,
  workerDue,
}: {
  todayPairs: number;
  newOrders: number;
  lowStockNames: string[];
  workerDue: number;
}) {
  const money = (value: number) => `Rs. ${Math.round(value).toLocaleString("en-IN")}`;

  // Only what needs a decision. A day with nothing wrong shows nothing wrong,
  // rather than three green ticks that have to be read to be dismissed.
  const alerts = [
    newOrders > 0 && {
      tone: "urgent" as const,
      text: `${newOrders} नयाँ अर्डर पठाउन बाँकी`,
      href: "/admin/orders",
    },
    lowStockNames.length > 0 && {
      tone: "warn" as const,
      text: `${lowStockNames.slice(0, 2).join(", ")}${lowStockNames.length > 2 ? ` +${lowStockNames.length - 2}` : ""} — माल सकिन लाग्यो`,
      href: "/admin/stock",
    },
    workerDue > 0 && {
      tone: "warn" as const,
      text: `कामदारलाई ${money(workerDue)} दिन बाँकी`,
      href: "/admin/factory/salary",
    },
  ].filter(Boolean) as { tone: "urgent" | "warn"; text: string; href: string }[];

  return (
    <section className="rounded-2xl border-2 border-brand-green/25 bg-brand-paper p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-black text-brand-green-ink">आजको काम</h2>
        <p className="text-sm font-bold text-brand-muted">
          आज बनेको: <span className="text-brand-green">{todayPairs} जोडी</span>
        </p>
      </div>

      <div className="mt-4 grid gap-2">
        {alerts.length === 0 ? (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">
            ✅ अहिले केही अड्किएको छैन।
          </p>
        ) : (
          alerts.map((alert) => (
            <Link
              key={alert.href + alert.text}
              href={alert.href}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-bold transition ${
                alert.tone === "urgent"
                  ? "bg-red-50 text-red-900 hover:bg-red-100"
                  : "bg-amber-50 text-amber-900 hover:bg-amber-100"
              }`}
            >
              <span aria-hidden>{alert.tone === "urgent" ? "🔴" : "🟡"}</span>
              {alert.text}
            </Link>
          ))
        )}
      </div>

      {/* The three jobs the owner actually does, big enough for a thumb. */}
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {[
          { href: "/admin/factory/add-work", label: "काम टिप्ने", english: "Add work" },
          { href: "/admin/pos", label: "बिल काट्ने", english: "Billing" },
          { href: "/admin/stock", label: "स्टक हेर्ने", english: "Stock" },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="grid min-h-14 place-items-center rounded-xl bg-brand-green px-4 text-center font-black text-white transition hover:bg-brand-green-ink"
          >
            <span>
              {action.label}
              <span className="block text-[11px] font-semibold text-white/70">{action.english}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
