import Link from "next/link";
import ExportButton from "@/components/admin/ExportButton";
import NepaliDateFieldUncontrolled from "@/components/admin/NepaliDateFieldUncontrolled";
import T from "@/components/T";
import { DateDisplayAdmin } from "@/components/DateDisplay";
import { formatAdminDate } from "@/lib/format-date";
import {
  activityLines,
  explainWarnings,
  isRoutine,
  kathmanduDay,
  linesByDay,
} from "@/lib/activity-view";
import {
  adminAuditCategories,
  adminAuditFiltersToSearchParams,
  filterAdminAuditEvents,
  getAdminAuditEvents,
  hasAdminAuditFilters,
  normalizeAdminAuditFilters,
} from "@/lib/admin-audit";

export const metadata = {
  title: "Activity Log | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

type ActivitySearchParams = Promise<Record<string, string | string[] | undefined>>;

const input =
  "h-10 rounded-md border border-brand-green-line bg-brand-paper px-3 text-sm font-semibold normal-case tracking-normal text-brand-green-ink outline-none focus:border-brand-green";

/** "5:21 pm", Kathmandu time. */
function clock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kathmandu" }).toLowerCase();
}

/** The day heading: the shop's own date, B.S. beside it. Noon, so no zone can move the day. */
function dayLabel(day: string) {
  return formatAdminDate(`${day}T06:15:00Z`);
}

/** Today in Kathmandu, and the instant a week back — read once per request. */
function clockNow() {
  const now = Date.now();
  return { today: kathmanduDay(new Date(now).toISOString()), weekAgo: now - 7 * 24 * 60 * 60 * 1000 };
}

function actorDetail(event: { actorName: string; actorEmail: string; actorRole: string; actorBranchId: string }) {
  return [event.actorName || event.actorEmail, event.actorRole, event.actorBranchId].filter(Boolean).join(" · ");
}

/**
 * Who did what, said plainly (owner, 2026-09-30). It was a seven-column
 * English table of up to five hundred rows — audit IDs, "Nightly
 * Daily-production", every evening's six jobs twice — with the bills lost
 * among them. Now: a few numbers for today, the warnings with what they were,
 * and the trail by day, one line per thing done, each opening to its detail.
 * Every row is kept; only the saying changed.
 */
export default async function AdminActivityPage({ searchParams }: { searchParams?: ActivitySearchParams }) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const filters = normalizeAdminAuditFilters(resolvedSearchParams);
  const showAll = resolvedSearchParams.view === "all";
  const allEvents = await getAdminAuditEvents(500);
  const events = filterAdminAuditEvents(allEvents, filters);
  const filtersActive = hasAdminAuditFilters(filters);
  const filterParams = adminAuditFiltersToSearchParams(filters);
  const exportParams = filterParams.toString();
  const exportHref = filtersActive && exportParams ? `/api/admin/activity/export?${exportParams}` : "/api/admin/activity/export";
  const viewHref = (all: boolean) => {
    const params = new URLSearchParams(filterParams);
    if (all) params.set("view", "all");
    const query = params.toString();
    return query ? `/admin/activity?${query}` : "/admin/activity";
  };

  const shown = showAll ? events : events.filter((event) => !isRoutine(event));
  const days = linesByDay(activityLines(shown));

  const { today, weekAgo } = clockNow();
  const ofToday = allEvents.filter((event) => kathmanduDay(event.createdAt) === today);
  const count = (action: string) => ofToday.filter((event) => event.action === action).length;
  const warnings = explainWarnings(
    allEvents.filter((event) => event.status === "warning" && Date.parse(event.createdAt) >= weekAgo),
    allEvents,
  );
  const worries = warnings.filter((warning) => warning.worry);
  const tonight = activityLines(ofToday.filter((event) => event.action.startsWith("nightly_"))).find((line) => line.nightly);

  const tiles = [
    { key: "bills", value: count("pos_create_invoice"), en: "Bills today", ne: "आज बिल" },
    { key: "goods", value: count("counter_item_added"), en: "New goods today", ne: "आज नयाँ माल" },
    { key: "logins", value: count("login_success"), en: "Sign-ins today", ne: "आज login" },
    { key: "worry", value: worries.length, en: "To look at (7 days)", ne: "ध्यान दिनुपर्ने (७ दिन)" },
  ];

  return (
    <section className="p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-brand-gold-deep">
            <T en="Activity" ne="को ले के गर्‍यो" />
          </p>
          <h1 className="mt-2 font-display text-3xl font-black leading-tight text-brand-green-ink">
            <T en="Who did what" ne="कसले के गर्‍यो" />
          </h1>
          <p className="mt-1 max-w-3xl text-base leading-7 text-brand-muted">
            <T
              en="Bills, goods, sign-ins, settings and the evening jobs, by day. Press a line for its detail."
              ne="बिल, माल, login, सेटिङ र रातिका काम, दिन अनुसार। विवरण हेर्न लाइन थिच्नुहोस्।"
            />
          </p>
          <Link href="/admin/security-overview" className="mt-2 inline-flex items-center gap-1 text-sm font-black text-brand-green underline">
            🔒 <T en="Security overview — who tried to sign in" ne="सुरक्षा — कसले login गर्न खोज्यो" />
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={exportHref}
            className="inline-flex h-9 items-center rounded-full border border-brand-green-line bg-brand-paper px-3 text-xs font-bold text-brand-green-ink transition hover:border-brand-green hover:text-brand-green"
          >
            Export CSV
          </a>
          {/* A button, not a link: prefetched, this built a whole backup of
              the shop every time the activity page was opened (owner,
              2026-09-30). */}
          <ExportButton
            href="/api/admin/backup"
            className="inline-flex h-9 items-center rounded-full bg-brand-green px-3 text-xs font-bold text-white"
          >
            Export backup
          </ExportButton>
        </div>
      </div>

      {/* Today in a few numbers that mean something to the shop. */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {tiles.map((tile) => (
          <div
            key={tile.key}
            className={`rounded-2xl border p-4 ${
              tile.key === "worry" && tile.value > 0 ? "border-brand-gold bg-brand-cream-soft" : "border-brand-green-line bg-brand-paper"
            }`}
          >
            <p className="text-3xl font-black tabular-nums text-brand-green-ink">{tile.value}</p>
            <p className="mt-1 text-sm font-bold text-brand-muted">
              <T en={tile.en} ne={tile.ne} />
            </p>
          </div>
        ))}
        <div
          className={`rounded-2xl border p-4 ${
            tonight?.nightly?.failed ? "border-brand-clay bg-brand-clay-tint" : "border-brand-green-line bg-brand-paper"
          }`}
        >
          <p className="text-3xl font-black text-brand-green-ink">{!tonight ? "—" : tonight.nightly?.failed ? "✗" : "✓"}</p>
          <p className="mt-1 text-sm font-bold text-brand-muted">
            {!tonight ? (
              <T en="Evening jobs: not yet today" ne="रातिका काम: आज अझै चलेनन्" />
            ) : tonight.nightly?.failed ? (
              <T en={tonight.said.en} ne={tonight.said.ne} />
            ) : (
              <T en="Evening jobs ran" ne="रातिका काम ठीक" />
            )}
          </p>
        </div>
      </div>

      {/* The warnings, each with what it was. */}
      <section className="mt-6 rounded-2xl border border-brand-green-line bg-brand-paper p-4 sm:p-5">
        <h2 className="text-lg font-black text-brand-green-ink">
          <T en="Warnings, last 7 days" ne="चेतावनी, पछिल्ला ७ दिन" />
        </h2>
        {warnings.length === 0 ? (
          <p className="mt-2 rounded-xl bg-brand-green-wash px-3 py-2 text-base font-bold text-brand-green">
            🟢 <T en="No warnings this week." ne="यो हप्ता कुनै चेतावनी छैन।" />
          </p>
        ) : (
          <>
            <p
              className={`mt-2 rounded-xl px-3 py-2 text-base font-bold ${
                worries.length ? "bg-brand-cream-soft text-brand-gold-ink" : "bg-brand-green-wash text-brand-green"
              }`}
            >
              {worries.length ? (
                <T en={`🟠 ${worries.length} worth a look`} ne={`🟠 ${worries.length} वटा हेर्नुपर्ने`} />
              ) : (
                <T
                  en={`🟢 Nothing to worry about — ${warnings.length} warning(s), each explained below`}
                  ne={`🟢 चिन्ता गर्नुपर्ने छैन — ${warnings.length} चेतावनी, तल हरेकको कारण`}
                />
              )}
            </p>
            <ul className="mt-3 grid gap-2">
              {warnings.map(({ event, en, ne, worry }) => (
                <li
                  key={event.id}
                  className={`grid gap-1 rounded-xl border px-3 py-2 text-base sm:grid-cols-[120px_1fr] ${
                    worry ? "border-brand-gold bg-brand-cream-soft" : "border-brand-green-line bg-brand-paper-deep"
                  }`}
                >
                  <span className="text-sm text-brand-muted">
                    {formatAdminDate(event.createdAt, { time: true })}
                  </span>
                  <span className="text-brand-green-ink">
                    <T en={en} ne={ne} />
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* The trail, by day. */}
      <section className="mt-6 rounded-2xl border border-brand-green-line bg-brand-paper p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black text-brand-green-ink">
            <T en="By day" ne="दिन अनुसार" />
          </h2>
          <div className="flex gap-1.5">
            <Link
              href={viewHref(false)}
              className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-black ${
                showAll ? "border-brand-green-line bg-brand-paper text-brand-green-ink" : "border-brand-green bg-brand-green text-white"
              }`}
            >
              <T en="What matters" ne="महत्त्वपूर्ण" />
            </Link>
            <Link
              href={viewHref(true)}
              className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-black ${
                showAll ? "border-brand-green bg-brand-green text-white" : "border-brand-green-line bg-brand-paper text-brand-green-ink"
              }`}
            >
              <T en="Everything" ne="सबै" />
            </Link>
          </div>
        </div>
        {!showAll ? (
          <p className="mt-1 text-sm text-brand-muted">
            <T
              en="Sign-in codes and order-list downloads are left out here; “Everything” shows them."
              ne="Login कोड र अर्डर सूची डाउनलोड यहाँ देखाइँदैनन्; “सबै” मा देखिन्छन्।"
            />
          </p>
        ) : null}

        <details className="mt-4 rounded-xl border border-brand-green-line bg-brand-paper-deep p-3" open={filtersActive}>
          <summary className="cursor-pointer text-sm font-black text-brand-green-ink">
            🔎 <T en="Search and filter" ne="खोज र छान्ने" />
          </summary>
          <form action="/admin/activity" className="mt-3 grid gap-3 lg:grid-cols-[1.3fr_1fr_0.8fr_1fr_0.8fr_0.8fr_auto]">
            {showAll ? <input type="hidden" name="view" value="all" /> : null}
            <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.12em] text-brand-muted">
              Search
              <input type="search" name="q" defaultValue={filters.q} placeholder="Action, detail, audit ID" className={input} />
            </label>
            <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.12em] text-brand-muted">
              Category
              <select name="category" defaultValue={filters.category} className={input}>
                <option value="all">All categories</option>
                {adminAuditCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.12em] text-brand-muted">
              Status
              <select name="status" defaultValue={filters.status} className={input}>
                <option value="all">All status</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.12em] text-brand-muted">
              Actor
              <input type="search" name="actor" defaultValue={filters.actor} placeholder="Name, email, role" className={input} />
            </label>
            <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.12em] text-brand-muted">
              From
              <NepaliDateFieldUncontrolled name="from" defaultValue={filters.from} />
            </label>
            <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.12em] text-brand-muted">
              To
              <NepaliDateFieldUncontrolled name="to" defaultValue={filters.to} />
            </label>
            <div className="flex items-end gap-2">
              <button type="submit" className="inline-flex h-10 items-center rounded-full bg-brand-green px-4 text-xs font-black text-white transition hover:bg-[#0A3F31]">
                Apply
              </button>
              {filtersActive ? (
                <Link
                  href={showAll ? "/admin/activity?view=all" : "/admin/activity"}
                  className="inline-flex h-10 items-center rounded-full border border-brand-green-line bg-brand-paper px-4 text-xs font-black text-brand-green-ink transition hover:border-brand-green hover:text-brand-green"
                >
                  Reset
                </Link>
              ) : null}
            </div>
          </form>
        </details>

        {days.length === 0 ? (
          <p className="mt-4 rounded-lg border border-brand-green-line bg-brand-paper-deep p-4 text-sm font-semibold text-brand-muted">
            {filtersActive ? (
              <T en="Nothing matched these filters." ne="यी छानोमा केही मिलेन।" />
            ) : (
              <T en="Nothing recorded yet." ne="अहिलेसम्म केही रेकर्ड भएको छैन।" />
            )}
          </p>
        ) : (
          <div className="mt-4 grid gap-5">
            {days.map(({ day, lines }) => (
              <div key={day}>
                <p className="text-sm font-black uppercase tracking-[0.1em] text-brand-gold-deep">
                  {day === today ? <T en="Today" ne="आज" /> : null}
                  {day === today ? " · " : ""}
                  {dayLabel(day)}
                </p>
                <ul className="mt-2 divide-y divide-dashed divide-brand-green-line rounded-xl border border-brand-green-line">
                  {lines.map((line) => (
                    <li key={line.key}>
                      <details className={line.warning ? "bg-brand-clay-tint/40" : ""}>
                        <summary className="grid cursor-pointer grid-cols-[76px_28px_1fr] items-start gap-2 px-3 py-2.5 text-base">
                          <span className="text-sm tabular-nums text-brand-muted">{clock(line.at)}</span>
                          <span aria-hidden="true">{line.said.icon}</span>
                          <span className={line.warning ? "font-bold text-brand-clay" : "text-brand-green-ink"}>
                            <T en={line.said.en} ne={line.said.ne} />
                          </span>
                        </summary>
                        <ul className="grid gap-2 border-t border-brand-green-line bg-brand-paper-deep px-4 py-3 text-sm text-brand-muted">
                          {line.events.map((event) => (
                            <li key={event.id} className="grid gap-0.5">
                              <span className="text-brand-green-ink">{event.detail}</span>
                              <span>
                                <DateDisplayAdmin date={event.createdAt} time={true} />
                                {actorDetail(event) ? ` · ${actorDetail(event)}` : ""} ·{" "}
                                <span className={event.status === "warning" ? "font-bold text-brand-clay" : ""}>{event.status}</span>
                              </span>
                              <span className="font-mono text-xs text-brand-muted-soft">{event.id}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
