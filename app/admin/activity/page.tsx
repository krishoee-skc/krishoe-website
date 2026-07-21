import Link from "next/link";
import { formatAdminDate } from "@/lib/format-date";
import {
  adminAuditCategories,
  adminAuditFiltersToSearchParams,
  filterAdminAuditEvents,
  getAdminAuditCategory,
  getAdminAuditEvents,
  hasAdminAuditFilters,
  normalizeAdminAuditFilters,
  type AdminAuditCategory,
  type AdminAuditEvent,
} from "@/lib/admin-audit";

export const metadata = {
  title: "Activity Log | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

type ActivitySearchParams = Promise<Record<string, string | string[] | undefined>>;

function categoryClass(category: AdminAuditCategory) {
  if (category === "Security") return "bg-brand-green-tint text-brand-green";
  if (category === "Operations") return "bg-[#EEF2FF] text-[#3730A3]";
  if (category === "Orders") return "bg-brand-cream-soft text-brand-gold-ink";
  if (category === "Products") return "bg-[#F5F0E8] text-[#5F4630]";
  if (category === "Reviews") return "bg-[#FEF3C7] text-[#92400E]";
  if (category === "Messages") return "bg-[#EFF6FF] text-[#1D4ED8]";
  if (category === "Settings") return "bg-[#F3E8FF] text-[#6B21A8]";
  if (category === "Backup") return "bg-[#ECFDF5] text-[#047857]";
  return "bg-gray-100 text-gray-700";
}

function statusClass(status: AdminAuditEvent["status"]) {
  return status === "warning"
    ? "bg-brand-clay-tint text-brand-clay"
    : "bg-brand-green-tint text-brand-green";
}

function prettyAction(action: string) {
  return action
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isToday(date: Date) {
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

function formatDate(value: string) {
  return formatAdminDate(value, { time: true });
}

function actorLabel(event: AdminAuditEvent) {
  return event.actorName || event.actorEmail || "System";
}

function actorDetail(event: AdminAuditEvent) {
  return [event.actorRole, event.actorBranchId, event.actorEmail].filter(Boolean).join(" | ");
}

function StatCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-brand-green-ink">{value}</p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted-soft">
        {detail}
      </p>
    </div>
  );
}

export default async function AdminActivityPage({ searchParams }: { searchParams?: ActivitySearchParams }) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const filters = normalizeAdminAuditFilters(resolvedSearchParams);
  const allEvents = await getAdminAuditEvents(500);
  const events = filterAdminAuditEvents(allEvents, filters);
  const filtersActive = hasAdminAuditFilters(filters);
  const exportParams = adminAuditFiltersToSearchParams(filters).toString();
  const exportHref = filtersActive && exportParams ? `/api/admin/activity/export?${exportParams}` : "/api/admin/activity/export";
  const warningEvents = events.filter((event) => event.status === "warning");
  const todayEvents = events.filter((event) => isToday(new Date(event.createdAt)));
  const latestEvent = events[0];
  const actorCount = new Set(
    events.map((event) => event.actorEmail || event.actorName || event.actorId).filter(Boolean),
  ).size;
  const categoryCounts = adminAuditCategories.map((category) => ({
    category,
    count: events.filter((event) => getAdminAuditCategory(event.action) === category).length,
  }));

  return (
    <section className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-brand-green-ink">Admin activity log</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            Login, backup, product, order, payment, and operations changes in one protected trail.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={exportHref}
            className="inline-flex h-9 items-center rounded-full border border-gray-200 bg-white px-3 text-xs font-bold text-brand-green-ink transition hover:border-brand-green hover:text-brand-green"
          >
            Export CSV
          </a>
          <Link
            href="/api/admin/backup"
            className="inline-flex h-9 items-center rounded-full bg-brand-green px-3 text-xs font-bold text-white"
          >
            Export backup
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-5">
        <StatCard
          label="Tracked events"
          value={events.length}
          detail={filtersActive ? `filtered from latest ${allEvents.length}` : "latest 500 records"}
        />
        <StatCard label="Today" value={todayEvents.length} detail="activity this day" />
        <StatCard label="Warnings" value={warningEvents.length} detail="failed/blocked signals" />
        <StatCard label="Actors" value={actorCount} detail="staff/session identities" />
        <StatCard label="Latest event" value={latestEvent ? formatDate(latestEvent.createdAt) : "-"} detail={latestEvent ? `${prettyAction(latestEvent.action)} | ${actorLabel(latestEvent)}` : "no activity"} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-brand-green-ink">Activity mix</h2>
          <p className="mt-1 text-sm text-gray-500">Where admin work is happening most.</p>
          <div className="mt-4 grid gap-3">
            {categoryCounts.map(({ category, count }) => (
              <div key={category} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-3">
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${categoryClass(category)}`}>
                  {category}
                </span>
                <span className="text-lg font-black text-brand-green-ink">{count}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-brand-green-ink">Warning signals</h2>
          <p className="mt-1 text-sm text-gray-500">Failed login, blocked login, or other warning-level audit events.</p>
          <div className="mt-4 divide-y divide-gray-100">
            {warningEvents.slice(0, 6).map((event) => (
              <div key={event.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-bold text-brand-green-ink">{prettyAction(event.action)}</p>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(event.status)}`}>
                    {event.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-600">{event.detail}</p>
                <p className="mt-1 text-xs font-semibold text-gray-500">
                  Actor: {actorLabel(event)}{actorDetail(event) ? ` | ${actorDetail(event)}` : ""}
                </p>
                <p className="mt-1 text-xs text-gray-400">{formatDate(event.createdAt)}</p>
              </div>
            ))}
            {warningEvents.length === 0 ? (
              <p className="rounded-lg border border-brand-green-line bg-brand-green-wash p-4 text-sm font-semibold text-brand-green">
                No warning-level admin activity in the latest audit records.
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-brand-green-ink">Recent trail</h2>
            <p className="mt-1 text-sm text-gray-500">
              {filtersActive ? "Filtered admin activity, newest first." : "Latest admin activity, newest first."}
            </p>
          </div>
          <Link href="/admin" className="text-sm font-bold text-brand-green underline underline-offset-4">
            Back to dashboard
          </Link>
        </div>

        <form action="/admin/activity" className="mb-5 grid gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4 lg:grid-cols-[1.3fr_1fr_0.8fr_1fr_0.8fr_0.8fr_auto]">
          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
            Search
            <input
              type="search"
              name="q"
              defaultValue={filters.q}
              placeholder="Action, detail, audit ID"
              className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-brand-green-ink outline-none focus:border-brand-green"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
            Category
            <select
              name="category"
              defaultValue={filters.category}
              className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-brand-green-ink outline-none focus:border-brand-green"
            >
              <option value="all">All categories</option>
              {adminAuditCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
            Status
            <select
              name="status"
              defaultValue={filters.status}
              className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-brand-green-ink outline-none focus:border-brand-green"
            >
              <option value="all">All status</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
            Actor
            <input
              type="search"
              name="actor"
              defaultValue={filters.actor}
              placeholder="Name, email, role"
              className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-brand-green-ink outline-none focus:border-brand-green"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
            From
            <input
              type="date"
              name="from"
              defaultValue={filters.from}
              className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-brand-green-ink outline-none focus:border-brand-green"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
            To
            <input
              type="date"
              name="to"
              defaultValue={filters.to}
              className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-brand-green-ink outline-none focus:border-brand-green"
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-full bg-brand-green px-4 text-xs font-black text-white transition hover:bg-[#0A3F31]"
            >
              Apply
            </button>
            {filtersActive ? (
              <Link
                href="/admin/activity"
                className="inline-flex h-10 items-center rounded-full border border-gray-200 bg-white px-4 text-xs font-black text-brand-green-ink transition hover:border-brand-green hover:text-brand-green"
              >
                Reset
              </Link>
            ) : null}
          </div>
        </form>

        {events.length === 0 ? (
          <p className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm font-semibold text-gray-600">
            {filtersActive ? "No admin activity matched these filters." : "No admin activity recorded yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b text-left text-gray-500">
                <tr>
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">Action</th>
                  <th className="py-2 pr-3">Actor</th>
                  <th className="py-2 pr-3">Detail</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Audit ID</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {events.map((event) => {
                  const category = getAdminAuditCategory(event.action);

                  return (
                    <tr key={event.id}>
                      <td className="whitespace-nowrap py-3 pr-3 text-xs text-gray-500">
                        {formatDate(event.createdAt)}
                      </td>
                      <td className="py-3 pr-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${categoryClass(category)}`}>
                          {category}
                        </span>
                      </td>
                      <td className="min-w-52 py-3 pr-3 font-bold text-brand-green-ink">
                        {prettyAction(event.action)}
                      </td>
                      <td className="min-w-52 py-3 pr-3">
                        <p className="font-bold text-brand-green-ink">{actorLabel(event)}</p>
                        {actorDetail(event) ? (
                          <p className="mt-1 text-xs text-gray-500">{actorDetail(event)}</p>
                        ) : null}
                      </td>
                      <td className="min-w-80 py-3 pr-3 text-gray-600">{event.detail}</td>
                      <td className="py-3 pr-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(event.status)}`}>
                          {event.status}
                        </span>
                      </td>
                      <td className="py-3 pr-3 font-mono text-xs text-gray-400">{event.id}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
