"use client";

import { useEffect, useState } from "react";
import type { AnalyticsSnapshot } from "@/lib/google-analytics";
import { useLanguage } from "@/components/LanguageProvider";

type DashboardState =
  | { state: "loading" }
  | { state: "error"; reason: string; configured: boolean }
  | { state: "ready"; snapshot: AnalyticsSnapshot };

/**
 * Fetches one range and returns what to show, rather than setting state itself.
 *
 * Keeping it outside the component is what lets the effect below do its single
 * setState after the await: a state update in the synchronous part of an effect
 * is both a lint error here and the thing that makes an extra render.
 */
async function loadSnapshot(days: number): Promise<DashboardState> {
  try {
    const response = await fetch(`/api/admin/google-analytics?days=${days}`);
    // Three shapes come back: the route's two, plus whatever the framework
    // returns when the permission check refuses. The third carries
    // `ok?: undefined` purely so `payload.ok` is a legal discriminant across
    // all of them — without it a signed-out admin gets a blank panel instead of
    // a reason.
    const payload = (await response.json().catch(() => null)) as
      | { ok: true; snapshot: AnalyticsSnapshot }
      | { ok: false; reason: string; configured: boolean }
      | { ok?: undefined; error?: string }
      | null;

    if (!response.ok || !payload?.ok) {
      return {
        state: "error",
        reason:
          (payload && "reason" in payload ? payload.reason : undefined) ??
          (payload && "error" in payload ? payload.error : undefined) ??
          "Google Analytics did not load.",
        configured: payload && "configured" in payload ? payload.configured : false,
      };
    }

    return { state: "ready", snapshot: payload.snapshot };
  } catch {
    return { state: "error", reason: "Could not connect to Google Analytics.", configured: true };
  }
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remaining}s` : `${remaining}s`;
}

export default function GoogleAnalyticsDashboard() {
  const { text } = useLanguage();
  const [days, setDays] = useState(28);
  // Bumped to ask again for the range already shown, which changing `days`
  // alone cannot express.
  const [attempt, setAttempt] = useState(0);
  const [dashboard, setDashboard] = useState<DashboardState>({ state: "loading" });

  useEffect(() => {
    let current = true;

    void loadSnapshot(days).then((next) => {
      // 90 days is a slower report than 7. Without this guard, switching down
      // to 7 and getting the older 90-day answer back afterwards would leave
      // the wrong numbers under a highlighted "7 दिन" button.
      if (current) setDashboard(next);
    });

    return () => {
      current = false;
    };
  }, [days, attempt]);

  /** Shows the spinner from the click that caused the reload, not from a render. */
  function reload(nextDays: number) {
    setDashboard({ state: "loading" });
    if (nextDays === days) setAttempt((value) => value + 1);
    else setDays(nextDays);
  }

  return (
    <section className="rounded-2xl border border-brand-green/15 bg-brand-paper p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-gold-deep">Google Analytics 4</p>
          <h2 className="mt-1 text-xl font-black text-brand-green-ink">{text("Customers who came to the website", "Website मा आएका ग्राहक")}</h2>
          <p className="mt-1 text-sm text-brand-muted">
            {text("Live website data on which pages they saw and where they came from.", "कुन पाना हेरे र कहाँबाट आए भन्ने live website data।")}
          </p>
        </div>
        <div className="flex gap-2" aria-label="Analytics time range">
          {[7, 28, 90].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => reload(option)}
              className={`min-h-10 rounded-full px-3 text-sm font-bold transition ${
                days === option ? "bg-brand-green text-white" : "border border-brand-green/20 text-brand-green hover:bg-brand-mist"
              }`}
            >
              {text(`${option} days`, `${option} दिन`)}
            </button>
          ))}
        </div>
      </div>

      {dashboard.state === "loading" ? (
        <p className="mt-6 text-sm text-brand-muted">{text("Reading Google's data…", "Google को data पढिँदैछ…")}</p>
      ) : null}

      {dashboard.state === "error" ? (
        <div className="mt-5 rounded-xl border border-brand-gold-bright/40 bg-brand-cream-soft p-4 text-sm text-brand-green-ink">
          <p className="font-black">{dashboard.configured ? text("Could not fetch data", "Data लिन सकिएन") : text("Google dashboard still to connect", "Google dashboard जोड्न बाँकी")}</p>
          <p className="mt-1 leading-6">{dashboard.reason}</p>
          {!dashboard.configured ? (
            <p className="mt-3 leading-6">
              {text("In Vercel, add ", "Vercel मा ")}
              <code>GA4_PROPERTY_ID</code> {text("and", "र")} <code>GA_SERVICE_ACCOUNT_KEY</code>
              {text(", then make the service account a ", " राखेर service account लाई ")}
              <strong>Viewer</strong>
              {text(" on the Google Analytics property.", " बनाउनुहोस्।")}
            </p>
          ) : null}
          <button type="button" onClick={() => reload(days)} className="mt-3 min-h-10 rounded-full bg-brand-green px-4 text-sm font-bold text-white">
            {text("Try again", "फेरि प्रयास गर्ने")}
          </button>
        </div>
      ) : null}

      {dashboard.state === "ready" ? (
        <div className="mt-5 space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Visitors", dashboard.snapshot.overview.users.toLocaleString()],
              ["Page views", dashboard.snapshot.overview.pageViews.toLocaleString()],
              ["Sessions", dashboard.snapshot.overview.sessions.toLocaleString()],
              ["Avg. time", formatDuration(dashboard.snapshot.overview.avgSeconds)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-brand-mist p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-green/70">{label}</p>
                <p className="mt-2 text-2xl font-black text-brand-green-ink">{value}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <AnalyticsList title={text("Most-viewed pages", "धेरै हेरिएका पाना")} rows={dashboard.snapshot.topPages} />
            <AnalyticsList title={text("Where customers came from", "ग्राहक कहाँबाट आए")} rows={dashboard.snapshot.channels} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AnalyticsList({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  const { text } = useLanguage();
  const maximum = Math.max(...rows.map((row) => row.count), 1);

  return (
    <div>
      <h3 className="font-black text-brand-green-ink">{title}</h3>
      <div className="mt-3 space-y-3">
        {rows.length === 0 ? <p className="text-sm text-brand-muted">{text("No data yet.", "अहिलेसम्म data छैन।")}</p> : null}
        {rows.map((row) => (
          <div key={row.label}>
            <div className="flex justify-between gap-3 text-sm"><span className="truncate text-brand-muted-deep">{row.label}</span><strong>{row.count.toLocaleString()}</strong></div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-brand-mist"><div className="h-full rounded-full bg-brand-gold-bright" style={{ width: `${(row.count / maximum) * 100}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
