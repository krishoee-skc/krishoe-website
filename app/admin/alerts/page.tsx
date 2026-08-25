import Link from "next/link";
import type { Metadata } from "next";
import AlertText from "@/components/admin/AlertText";
import LoadFailure from "@/components/admin/LoadFailure";
import { ArrowRightIcon } from "@/components/Icons";
import { requireAdminPermission } from "@/lib/admin-permissions";
import {
  getOperationalAlertCenter,
  type OperationalAlert,
  type OperationalAlertCategory,
} from "@/lib/notifications";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";

export const metadata: Metadata = { title: "चेतावनी | KRISHOE Admin" };

export const dynamic = "force-dynamic";

/**
 * What the shop needs somebody to do about, worked out from live data.
 *
 * This screen used to read a table called admin_alerts. The table is in
 * docs/schema.sql and was never created in the live database, and nothing in
 * the app has ever called createAlert() — so it was scaffolding with no
 * building attached. Every query failed, every failure was swallowed by a
 * catch that returned an empty list, and the screen reported four cheerful
 * zeros and "No alerts found".
 *
 * On an alert screen that is the most dangerous thing a page can do: "all
 * clear" and "I could not check" looked identical, and the owner reasonably
 * assumed they had broken something. They had not — it had never worked.
 *
 * The shop already had a working alert centre computing real warnings from
 * orders, ledgers, stock, payments and production. It was on two other screens
 * and not on the one called Alerts. It is here now, the dead store is gone, and
 * a failure to read says so out loud instead of dressing up as good news.
 */
const CATEGORY: Record<OperationalAlertCategory, { ne: string; en: string }> = {
  sales: { ne: "बिक्री", en: "Sales" },
  collection: { ne: "उधारो उठाउने", en: "Collection" },
  supplier: { ne: "साहुलाई तिर्ने", en: "Supplier" },
  stock: { ne: "स्टक", en: "Stock" },
  payment: { ne: "भुक्तानी", en: "Payment" },
  posting: { ne: "हिसाब मिलाउने", en: "Posting" },
  catalog: { ne: "सामान", en: "Catalog" },
  production: { ne: "उत्पादन", en: "Production" },
};

const SEVERITY = {
  critical: {
    ne: "अहिल्यै",
    ring: "border-brand-clay",
    fill: "bg-brand-clay-tint",
    text: "text-brand-clay-ink",
    dot: "bg-brand-clay",
  },
  warning: {
    ne: "चाँडै",
    ring: "border-brand-gold",
    fill: "bg-brand-cream-soft",
    text: "text-brand-gold-ink",
    dot: "bg-brand-gold-deep",
  },
  info: {
    ne: "जानकारी",
    ring: "border-brand-green-line",
    fill: "bg-brand-paper",
    text: "text-brand-muted-deep",
    dot: "bg-brand-muted-soft",
  },
} as const;

function AlertRow({ alert }: { alert: OperationalAlert }) {
  const tone = SEVERITY[alert.severity];

  return (
    <Link
      href={alert.href}
      className={`group flex flex-col gap-3 rounded-2xl border ${tone.ring} ${tone.fill} p-5 transition hover:-translate-y-0.5 sm:flex-row sm:items-start sm:gap-5`}
    >
      <span className="flex items-center gap-2.5 sm:mt-1 sm:w-36 sm:shrink-0">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} />
        <span className={`text-[11px] font-black uppercase tracking-[0.14em] ${tone.text}`}>
          {tone.ne} · {CATEGORY[alert.category].ne}
        </span>
      </span>

      <span className="min-w-0 flex-grow">
        <span className="block text-base font-black leading-snug text-brand-green-ink">
          <AlertText en={alert.title} ne={alert.titleNe} />
        </span>
        <span className="mt-1 block text-sm leading-6 text-brand-muted">
          <AlertText en={alert.detail} ne={alert.detailNe} />
        </span>
        {/* What to do, not merely what is wrong. An alert with no next step is
            a worry rather than a task. */}
        <span className="mt-2 block text-sm font-bold text-brand-green">
          <AlertText en={alert.action} ne={alert.actionNe} />
        </span>
      </span>

      <ArrowRightIcon className="hidden h-5 w-5 shrink-0 text-brand-muted-soft transition group-hover:text-brand-gold-deep sm:mt-1 sm:block" />
    </Link>
  );
}

export default async function AlertsPage() {
  await requireAdminPermission("notifications:read");

  let centre;
  try {
    centre = await getOperationalAlertCenter();
  } catch (error) {
    // Loudly. A silent failure here reads as "nothing is wrong", which is the
    // one lie this screen must never tell.
    reportError("load the alert centre", error);
    return (
      <LoadFailure
        what="चेतावनी"
        message={saveFailureMessage(error, "चेतावनी जाँच्न सकिएन — यसको मतलब सबै ठीक छ भन्ने होइन।")}
        retryHref="/admin/alerts"
      />
    );
  }

  const { alerts, summary } = centre;
  const critical = alerts.filter((alert) => alert.severity === "critical");
  const rest = alerts.filter((alert) => alert.severity !== "critical");

  return (
    <section className="p-4 sm:p-6">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-gold-deep">
        चेतावनी · Alerts
      </p>
      <h1 className="mt-2 font-display text-3xl font-black leading-tight text-brand-green-ink">
        {summary.total === 0 ? "अहिले केही अड्किएको छैन" : "यी कुरा हेर्नुपर्‍यो"}
      </h1>

      {summary.total === 0 ? (
        /* Not "No alerts found", which reads as a broken screen. This says
           what was checked, so an empty page is evidence rather than silence. */
        <div className="mt-6 rounded-2xl border border-brand-green-line bg-brand-paper p-6 sm:p-8">
          <p className="text-base leading-7 text-brand-green-ink">
            अर्डर, उधारो, साहु, स्टक, भुक्तानी, हिसाब र उत्पादन — सातै ठाउँ जाँचियो, कतै केही
            अड्किएको भेटिएन।
          </p>
          <p className="mt-3 text-sm leading-6 text-brand-muted">
            यो पाना खाली हुनु राम्रो कुरा हो। केही अड्कियो भने आफैँ यहाँ देखिन्छ — कसैले टिप्नु
            पर्दैन।
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/admin/reports"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-green px-5 text-sm font-black text-brand-green transition hover:bg-brand-green hover:text-white"
            >
              हिसाब हेर्ने
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-brand-muted">
            {summary.critical > 0 ? `${summary.critical} अहिल्यै · ` : ""}
            {summary.warning > 0 ? `${summary.warning} चाँडै · ` : ""}
            {summary.total} जम्मा। हरेकमा के गर्ने लेखिएको छ।
          </p>

          {critical.length > 0 ? (
            <div className="mt-6 grid gap-3">
              {critical.map((alert) => (
                <AlertRow key={alert.id} alert={alert} />
              ))}
            </div>
          ) : null}

          {rest.length > 0 ? (
            <div className={`grid gap-3 ${critical.length > 0 ? "mt-3" : "mt-6"}`}>
              {rest.map((alert) => (
                <AlertRow key={alert.id} alert={alert} />
              ))}
            </div>
          ) : null}
        </>
      )}

      <p className="mt-6 text-xs leading-6 text-brand-muted">
        यी चेतावनी कहीँ टिपिएका होइनन् — अर्डर, खाता, स्टक र बिलबाट हरेक पटक आफैँ गनिन्छन्।
      </p>
    </section>
  );
}
