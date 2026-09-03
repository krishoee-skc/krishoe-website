import Link from "next/link";
import T from "@/components/T";
import StatCard from "@/components/admin/StatTile";
import { DateDisplayAdmin } from "@/components/DateDisplay";
import { getAdminAuditEvents, type AdminAuditEvent } from "@/lib/admin-audit";

export const metadata = {
  title: "Security Center | KRISHOE Admin",
};

// The seven safety pages, gathered here as one switch-board. Each tile is a
// plain link — the page it points to is untouched and still does its own work.
// This center only makes them findable from one place; it removes nothing.
const SECURITY_LINKS: { href: string; icon: string; en: string; ne: string; hintEn: string; hintNe: string }[] = [
  { href: "/admin/activity", icon: "👣", en: "Who signed in", ne: "को पस्यो", hintEn: "Sign-ins & attempts", hintNe: "प्रवेश र प्रयास" },
  { href: "/admin/devices", icon: "📱", en: "Login devices", ne: "यन्त्रहरू", hintEn: "Device & location", hintNe: "यन्त्र र स्थान" },
  { href: "/admin/alerts", icon: "🚨", en: "Alerts", ne: "खतरा-संकेत", hintEn: "What needs a look", hintNe: "हेर्नुपर्ने कुरा" },
  { href: "/admin/monitoring", icon: "🛡️", en: "Monitoring", ne: "निगरानी", hintEn: "Blocked scripts", hintNe: "रोकिएका script" },
  { href: "/admin/security", icon: "📹", en: "Security / CCTV", ne: "क्यामेरा", hintEn: "Shop cameras", hintNe: "पसल क्यामेरा" },
  { href: "/admin/robots", icon: "🤖", en: "Robots", ne: "स्वचालित काम", hintEn: "Scheduled jobs", hintNe: "तालिकाबद्ध काम" },
];

export const dynamic = "force-dynamic";

// The sign-in actions the audit log records, mapped to a plain description and
// the bucket it counts toward. Everything else on the page is derived from these.
const SECURITY_ACTIONS: Record<string, { label: string; bucket: "success" | "failed" | "blocked" }> = {
  login_success: { label: "Signed in", bucket: "success" },
  login_failed: { label: "Wrong password / unknown account", bucket: "failed" },
  login_mfa_challenge: { label: "Two-step code sent", bucket: "success" },
  login_mfa_delivery_failed: { label: "Two-step code could not be sent", bucket: "failed" },
  login_rate_limited: { label: "Blocked — too many attempts", bucket: "blocked" },
  bootstrap_login_blocked: { label: "Bootstrap sign-in blocked", bucket: "blocked" },
  logout: { label: "Signed out", bucket: "success" },
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export default async function SecurityOverviewPage() {
  const events = await getAdminAuditEvents(500);
  const since = new Date().getTime() - SEVEN_DAYS_MS;

  const security = events.filter(
    (event) => event.action in SECURITY_ACTIONS && new Date(event.createdAt).getTime() >= since,
  );

  const count = (bucket: "success" | "failed" | "blocked") =>
    security.filter((event) => SECURITY_ACTIONS[event.action].bucket === bucket).length;

  const successCount = count("success");
  const failedCount = count("failed");
  const blockedCount = count("blocked");

  const describe = (event: AdminAuditEvent) => SECURITY_ACTIONS[event.action]?.label ?? event.action;
  const who = (event: AdminAuditEvent) =>
    event.actorEmail || event.actorName || event.detail || "Unknown";

  return (
    <section className="p-4 pb-24 sm:p-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green">
          <T en="Security Center" ne="सुरक्षा केन्द्र" />
        </p>
        <h1 className="mt-2 font-display text-3xl font-black leading-tight text-brand-green-ink">
          <T en="Safety, all in one place" ne="सुरक्षा — सबै एउटै ठाउँमा" />
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-muted">
          <T
            en="Every safety page, reachable from here. Open one below, or read the last 7 days of sign-in activity underneath."
            ne="हरेक सुरक्षा पेज यहीँबाट। तल कुनै एउटा खोल्नुहोस्, वा तलैको ७ दिनको प्रवेश-हिसाब हेर्नुहोस्।"
          />
        </p>
      </div>

      {/* Switch-board: one tile per safety page. Links only — nothing removed. */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SECURITY_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group flex items-center gap-3 rounded-2xl border border-brand-green-line bg-brand-paper p-4 shadow-sm transition hover:border-brand-green hover:shadow-md"
          >
            <span
              aria-hidden="true"
              className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-brand-green-mist text-xl transition group-hover:scale-105"
            >
              {link.icon}
            </span>
            <span className="min-w-0">
              <span className="block font-black text-brand-green-ink">
                <T en={link.en} ne={link.ne} />
              </span>
              <span className="block truncate text-xs text-brand-muted">
                <T en={link.hintEn} ne={link.hintNe} />
              </span>
            </span>
            <span aria-hidden="true" className="ml-auto text-brand-green transition group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        ))}
      </div>

      <h2 className="mt-9 text-lg font-black text-brand-green-ink">
        <T en="Last 7 days — who signed in" ne="पछिल्लो ७ दिन — को पस्यो" />
      </h2>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="Successful sign-ins" value={successCount} detail="Last 7 days" />
        <StatCard label="Failed attempts" value={failedCount} detail="Wrong password / no such account" />
        <StatCard label="Blocked attempts" value={blockedCount} detail="Stopped by rate limit" />
      </div>

      <div className="mt-8 rounded-2xl border border-brand-green-line bg-brand-paper p-5 shadow-sm">
        <h2 className="text-lg font-black text-brand-green-ink">Recent sign-in activity</h2>
        <p className="mt-1 text-sm text-brand-muted">
          Newest first. For the device and location (IP) of each sign-in, open{" "}
          <Link href="/admin/devices" className="font-black text-brand-green underline">
            Login devices
          </Link>
          ; for scripts a page blocked, open{" "}
          <Link href="/admin/monitoring" className="font-black text-brand-green underline">
            Monitoring
          </Link>
          .
        </p>

        {security.length === 0 ? (
          <p className="mt-6 text-sm text-brand-muted">
            No sign-in activity recorded in the last 7 days.
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-brand-green-line">
            {security.slice(0, 60).map((event) => {
              const bucket = SECURITY_ACTIONS[event.action].bucket;
              return (
                <li key={event.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-bold text-brand-green-ink">{describe(event)}</p>
                    <p className="truncate text-sm text-brand-muted">{who(event)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${
                        bucket === "blocked"
                          ? "bg-brand-clay-tint text-brand-clay"
                          : bucket === "failed"
                            ? "bg-brand-cream text-brand-gold-dark"
                            : "bg-brand-green-mist text-brand-green"
                      }`}
                    >
                      {bucket === "blocked" ? "Blocked" : bucket === "failed" ? "Failed" : "OK"}
                    </span>
                    <span className="text-xs font-semibold text-brand-muted">
                      <DateDisplayAdmin date={event.createdAt} time={true} />
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
