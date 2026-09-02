import Link from "next/link";
import { ArrowRightIcon, PackageIcon, ShoppingCartIcon, UserIcon } from "@/components/Icons";
import type { ComponentType } from "react";
import T from "@/components/T";

type IconComponent = ComponentType<{ className?: string }>;

/**
 * The first thing on the dashboard, in Nepali: what needs doing today, and the
 * three buttons that do it.
 *
 * Everything below this on the page is a report — numbers to read once the
 * question "what should I do now?" is already answered. That question was
 * answered nowhere, so the owner arrived at a wall of tiles and had to work it
 * out each time. Three lines and three buttons is the whole of it.
 *
 * The look is the shop's own: a coloured medallion drawn from a brand icon
 * rather than an emoji, because an emoji is whatever font the phone carries and
 * looked different on every device. Urgent is clay-red, a waiting job is gold.
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
      Icon: ShoppingCartIcon,
      count: newOrders,
      textEn: `${newOrders} new order(s) to send`,
      textNe: `${newOrders} नयाँ अर्डर पठाउन बाँकी`,
      href: "/admin/orders",
    },
    lowStockNames.length > 0 && {
      tone: "warn" as const,
      Icon: PackageIcon,
      count: lowStockNames.length,
      names: `${lowStockNames.slice(0, 2).join(", ")}${lowStockNames.length > 2 ? ` +${lowStockNames.length - 2}` : ""}`,
      textEn: "running low",
      textNe: "माल सकिन लाग्यो",
      href: "/admin/stock",
    },
    workerDue > 0 && {
      tone: "warn" as const,
      Icon: UserIcon,
      count: null,
      textEn: `${money(workerDue)} still to pay workers`,
      textNe: `कामदारलाई ${money(workerDue)} दिन बाँकी`,
      href: "/admin/factory/salary",
    },
  ].filter(Boolean) as {
    tone: "urgent" | "warn";
    Icon: IconComponent;
    count: number | null;
    names?: string;
    textEn: string;
    textNe: string;
    href: string;
  }[];

  return (
    <section className="rounded-3xl border border-brand-green-line bg-brand-paper p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl font-black text-brand-green-ink sm:text-3xl"><T en="Today's work" ne="आजको काम" /></h2>
        <p className="text-sm font-bold text-brand-muted">
          <T en="Made today:" ne="आज बनेको:" /> <span className="text-brand-green"><T en={`${todayPairs} pairs`} ne={`${todayPairs} जोडी`} /></span>
        </p>
      </div>

      <div className="mt-4 grid gap-3">
        {alerts.length === 0 ? (
          <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-brand-paper p-5 ring-1 ring-emerald-100">
            <span
              className="grid h-12 w-12 flex-none place-items-center rounded-2xl text-white shadow-sm"
              style={{ background: "linear-gradient(150deg,#12876a,#0B4D3B)" }}
            >
              <CheckMark />
            </span>
            <p className="text-base font-black text-emerald-900">✅ <T en="Nothing stuck right now." ne="अहिले केही अड्किएको छैन।" /></p>
          </div>
        ) : (
          alerts.map((alert) => (
            <Link
              key={alert.href + alert.textEn}
              href={alert.href}
              className="group flex items-center gap-4 rounded-2xl p-4 shadow-sm ring-1 transition hover:-translate-y-0.5 hover:shadow-md"
              style={{
                background:
                  alert.tone === "urgent"
                    ? "linear-gradient(120deg,#fce9e6,#ffffff)"
                    : "linear-gradient(120deg,#fdf3e0,#ffffff)",
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.03)",
              }}
            >
              <span
                className="grid h-14 w-14 flex-none place-items-center rounded-2xl text-white shadow-sm"
                style={{
                  background:
                    alert.tone === "urgent"
                      ? "linear-gradient(150deg,#c85a4d,#b1443a)"
                      : "linear-gradient(150deg,#e0a23f,#c07d1e)",
                }}
              >
                <alert.Icon className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1 text-base font-bold text-brand-green-ink">
                {alert.names ? `${alert.names} — ` : ""}
                <T en={alert.textEn} ne={alert.textNe} />
              </span>
              {alert.count !== null ? (
                <span
                  className="font-display text-3xl font-black leading-none"
                  style={{ color: alert.tone === "urgent" ? "#b1443a" : "#c07d1e" }}
                >
                  {alert.count}
                </span>
              ) : null}
              <ArrowRightIcon className="h-5 w-5 flex-none text-brand-muted-soft transition group-hover:translate-x-0.5" />
            </Link>
          ))
        )}
      </div>

      {/* The three jobs the owner actually does, big enough for a thumb. */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          { href: "/admin/factory/add-work", labelNe: "काम टिप्ने", labelEn: "Add work" },
          { href: "/admin/pos", labelNe: "बिल काट्ने", labelEn: "Billing" },
          { href: "/admin/stock", labelNe: "स्टक हेर्ने", labelEn: "Stock" },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="grid min-h-14 place-items-center rounded-2xl px-4 text-center font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            style={{ background: "linear-gradient(150deg,#0e6349,#0B4D3B)" }}
          >
            <span>
              <T en={action.labelEn} ne={action.labelNe} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** A plain tick, drawn rather than typed, so the calm state matches the brand. */
function CheckMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
    </svg>
  );
}
