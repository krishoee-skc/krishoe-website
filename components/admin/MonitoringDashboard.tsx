"use client";

import { useCallback, useEffect, useState } from "react";
import type { ServiceStatus, UptimeEvidence } from "@/lib/monitoring";
import AlertText from "@/components/admin/AlertText";


/**
 * "6 मिनेटअघि" rather than a timestamp.
 *
 * The question this answers is "is it answering right now", and a reader should
 * not have to subtract two clock times to find out — least of all across the
 * five-and-three-quarter hours between Kathmandu and the server.
 */
function minutesAgo(minutes: number | null): { en: string; ne: string } {
  if (minutes === null) return { en: "—", ne: "—" };
  if (minutes < 2) return { en: "just now", ne: "अहिल्यै" };
  if (minutes < 60) return { en: `${minutes} minutes ago`, ne: `${minutes} मिनेटअघि` };

  const hours = Math.round(minutes / 60);
  if (hours < 24) return { en: `${hours} hours ago`, ne: `${hours} घण्टाअघि` };

  const days = Math.round(hours / 24);
  return { en: `${days} days ago`, ne: `${days} दिनअघि` };
}

interface MonitoringData {
  errors: {
    totalErrors: number;
    errorsByLevel: Record<string, number>;
    topErrors: Array<{ message: string; count: number }>;
    recentErrors: Array<{
      id: string;
      message: string;
      level: string;
      context?: string | null;
      timestamp?: string;
      created_at?: string;
    }>;
  };
  performance: {
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    slowestEndpoints: Array<{
      path: string;
      rating: string;
      avgTime: number;
      count: number;
    }>;
    errorRate: number;
    samples: number;
    setAside: number;
  };
  // The library type, not a copy of it. This block was a hand-written
  // duplicate of UptimeEvidence and went stale the moment that grew a field.
  uptime: UptimeEvidence;
  health: {
    scope: "live" | "local";
    database: ServiceStatus;
    cache: ServiceStatus;
    api: ServiceStatus;
    email: ServiceStatus;
    sms: ServiceStatus;
    storage: ServiceStatus;
  };
}

/** Nepal time, as a clock reads it. The column stores UTC. */
function formatWhen(value?: string | null) {
  if (!value) return "—";

  const when = new Date(value);
  if (Number.isNaN(when.getTime())) return "—";

  return when.toLocaleString("en-GB", {
    timeZone: "Asia/Kathmandu",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function MonitoringDashboard() {
  const [monitoring, setMonitoring] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadMonitoring = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/monitoring");
      if (res.ok) {
        const data = await res.json();
        setMonitoring(data.monitoring);
      }
    } catch (error) {
      console.error("Failed to load monitoring:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Clear the error log on the owner's word — a clean slate after fixing what
  // caused the errors. Only the error table is emptied; the speed and answering
  // figures, and every shop/stock/sales record, are untouched. Confirmed first,
  // then the list reloads to show it empty.
  const [clearing, setClearing] = useState(false);
  const clearErrors = useCallback(async () => {
    if (clearing) return;
    if (!window.confirm("Clear all logged errors? Speed, uptime and all shop data are untouched.")) {
      return;
    }
    setClearing(true);
    try {
      const res = await fetch("/api/admin/monitoring", { method: "DELETE" });
      if (res.ok) {
        await loadMonitoring();
      } else {
        window.alert("Could not clear the errors. Please try again.");
      }
    } catch (error) {
      console.error("Failed to clear errors:", error);
      window.alert("Could not clear the errors. Please try again.");
    } finally {
      setClearing(false);
    }
  }, [clearing, loadMonitoring]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadMonitoring(), 0);
    if (autoRefresh) {
      const interval = setInterval(() => void loadMonitoring(), 30000);
      return () => {
        window.clearTimeout(initialLoad);
        clearInterval(interval);
      };
    }
    return () => window.clearTimeout(initialLoad);
  }, [autoRefresh, loadMonitoring]);

  if (loading) {
    return (
      <div className="p-6 text-center text-brand-muted">
        Loading monitoring data...
      </div>
    );
  }

  if (!monitoring) {
    return (
      <div className="p-6 text-center text-red-500">
        Failed to load monitoring data
      </div>
    );
  }

  // Grey for "not set up", so the eye stops treating it as a fault.
  const getHealthColor = (status: ServiceStatus) =>
    status === "up"
      ? "bg-green-100 text-green-700"
      : status === "off"
        ? "bg-brand-mist text-brand-muted"
        : "bg-red-100 text-red-700";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-brand-paper rounded-lg border border-brand-green-line p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="font-display text-3xl font-black text-brand-green-ink mb-2">
              🔍 Production Monitoring
            </h1>
            <p className="text-brand-muted">
              Real-time system health, performance, and error tracking
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadMonitoring}
              className="px-4 py-2 bg-brand-green text-white rounded-lg hover:bg-brand-green-ink text-sm font-medium"
            >
              🔄 Refresh Now
            </button>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                autoRefresh
                  ? "bg-green-600 text-white"
                  : "bg-brand-green-line text-brand-green-ink"
              }`}
            >
              {autoRefresh ? "✓ Auto-Refresh" : "○ Manual"}
            </button>
          </div>
        </div>
      </div>

      {/* System Health */}
      <div className="bg-brand-paper rounded-lg border border-brand-green-line p-6">
        <h2 className="text-lg font-semibold text-brand-green-ink">
          💚 System Health
        </h2>
        {/* Storage, Email and SMS are read off environment variables, which
            belong to the machine rendering this page. On the owner's laptop
            Storage read "Not set up" while the live shop had a Blob store with
            four product photos in it, serving them fine — the screen was
            describing the laptop and saying it about the shop. */}
        {monitoring.health.scope === "local" ? (
          <p className="mb-4 mt-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-900">
            💻{" "}
            <AlertText
              en="This is your computer's state, not the shop's. Storage, Email and SMS may read “not set up” here while they are working on the live shop. Open this from the live site to see the shop itself."
              ne="यो तपाईंको कम्प्युटरको हालत हो — पसलको होइन। Storage, Email र SMS यहाँ “सेट अप छैन” देखिन सक्छन्, तर live पसलमा चालु हुन सक्छन्। पसलको साँचो हालत हेर्न live साइटबाट खोल्नुहोस्।"
            />
          </p>
        ) : (
          <p className="mb-4 mt-1 text-sm leading-6 text-brand-muted">
            <AlertText en="The live shop's state" ne="live पसलको हालत" />
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { name: "Database", status: monitoring.health.database, icon: "🗄️" },
            { name: "API", status: monitoring.health.api, icon: "🔌" },
            { name: "Email", status: monitoring.health.email, icon: "📧" },
            { name: "SMS", status: monitoring.health.sms, icon: "📱" },
            { name: "Storage", status: monitoring.health.storage, icon: "💾" },
            { name: "Cache", status: monitoring.health.cache, icon: "⚡" },
          ].map((service) => (
            <div
              key={service.name}
              className={`p-4 rounded-lg ${getHealthColor(service.status)}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{service.icon}</span>
                <span className="font-semibold">{service.name}</span>
              </div>
              {/* Red is reserved for something that is configured and failing.
                  Three of these six were red for services this shop has never
                  set up, and one — Email — was working the whole time. A
                  dashboard that cries outage over a service nobody bought
                  teaches its reader to ignore red, which is the one thing a
                  health screen must never do. */}
              <span className="text-sm">
                {service.status === "up"
                  ? "🟢 Healthy"
                  : service.status === "off"
                    ? "⚪ Not set up"
                    : "🔴 Down"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-brand-paper rounded-lg border border-brand-green-line p-4">
          {/* This said "Uptime (30 days)" and a percentage over a figure
              nothing had ever written — 0% standing in for "we never looked",
              which is the worst possible way to say it.

              A cron pinging the site from inside Vercel would not have fixed
              it: when the site is down that cron does not run either, so it
              records a wall of "up" and misses every outage. The checker that
              feeds the percentage below runs on GitHub's machines instead and
              writes straight to the database, so an outage is recorded by
              something the outage cannot reach.

              Both halves are shown. The percentage is the shop being
              reachable; the line under it is a real shopper's browser
              confirming it served them. A perfect month of checks on a shop
              nobody visits is not the same news. */}
          <div className="text-sm text-brand-muted">
            <AlertText en="Answering?" ne="जवाफ दिइरहेको छ?" />
          </div>

          {monitoring.uptime.outside.percent !== null ? (
            <>
              <div className="mt-2 text-3xl font-bold text-brand-green-ink">
                {monitoring.uptime.outside.percent}%
              </div>
              <div className="mt-1 text-xs leading-5 text-brand-muted">
                <AlertText
                  en={`${monitoring.uptime.outside.answered} of ${monitoring.uptime.outside.checks} checks answered · 30 days, checked from outside`}
                  ne={`${monitoring.uptime.outside.checks} जाँचमध्ये ${monitoring.uptime.outside.answered} ले जवाफ दियो · ३० दिन, बाहिरबाट जाँचिएको`}
                />
              </div>
            </>
          ) : (
            <div className="mt-2 rounded bg-brand-mist px-2 py-1 text-xs font-medium text-brand-muted">
              <AlertText
                en="The outside check has not run yet"
                ne="बाहिरी जाँच अझै चलेको छैन"
              />
            </div>
          )}

          {monitoring.uptime.lastAnsweredAt ? (
            <>
              <div className="mt-3 text-xs leading-5 text-brand-muted">
                <AlertText
                  en={`A shopper's own browser was served ${minutesAgo(monitoring.uptime.minutesSinceAnswer).en} · ${monitoring.uptime.readings} readings over ${monitoring.uptime.daysObserved} days`}
                  ne={`ग्राहकको फोनले ${minutesAgo(monitoring.uptime.minutesSinceAnswer).ne} जवाफ पायो · ${monitoring.uptime.readings} नाप, ${monitoring.uptime.daysObserved} दिनमा`}
                />
              </div>
              <div
                className={`mt-2 rounded px-2 py-1 text-xs font-medium ${
                  monitoring.uptime.recentErrors > 0
                    ? "bg-brand-cream-soft text-brand-gold-ink"
                    : "bg-brand-green-tint text-brand-green"
                }`}
              >
                <AlertText
                  en={
                    monitoring.uptime.recentErrors > 0
                      ? `${monitoring.uptime.recentErrors} errors in 7 days`
                      : "No errors in 7 days"
                  }
                  ne={
                    monitoring.uptime.recentErrors > 0
                      ? `७ दिनमा ${monitoring.uptime.recentErrors} गल्ती`
                      : "७ दिनमा कुनै गल्ती छैन"
                  }
                />
              </div>
            </>
          ) : (
            <div className="mt-3 rounded bg-brand-mist px-2 py-1 text-xs font-medium text-brand-muted">
              <AlertText en="Nobody has opened the shop yet" ne="कसैले पसल खोलेकै छैन" />
            </div>
          )}
        </div>

        <div className="bg-brand-paper rounded-lg border border-brand-green-line p-4">
          {/* Largest Contentful Paint, taken on the shopper's own phone —
              how long until the main thing is on screen. A server timing would
              read a few milliseconds for a prerendered page while the shopper
              on a Nepali mobile connection waited seconds for it. */}
          <div className="text-sm text-brand-muted">
            <AlertText en="How long a page takes to appear" ne="पाना देखिन लाग्ने समय" />
          </div>
          {monitoring.performance.avgResponseTime > 0 ? (
            <>
              <div
                className={`mt-2 text-3xl font-bold ${
                  monitoring.performance.avgResponseTime <= 2500
                    ? "text-green-600"
                    : monitoring.performance.avgResponseTime <= 4000
                      ? "text-yellow-600"
                      : "text-red-600"
                }`}
              >
                {(monitoring.performance.avgResponseTime / 1000).toFixed(1)}s
              </div>
              <div className="mt-2 text-xs text-brand-muted">
                {/* The slowest quarter is what people leave over, so the
                    average alone is not the whole answer. */}
                <AlertText
                  en={`Slowest 5%: ${(monitoring.performance.p95ResponseTime / 1000).toFixed(1)}s${
                    monitoring.performance.avgResponseTime <= 2500 ? " · good" : " · needs work"
                  }`}
                  ne={`सुस्त ५%: ${(monitoring.performance.p95ResponseTime / 1000).toFixed(1)}s${
                    monitoring.performance.avgResponseTime <= 2500 ? " · राम्रो" : " · सुधार चाहिन्छ"
                  }`}
                />
              </div>
            </>
          ) : (
            <>
              <div className="mt-2 text-3xl font-bold text-brand-muted-soft">—</div>
              <div className="mt-2 rounded bg-brand-mist px-2 py-1 text-xs font-medium text-brand-muted">
                <AlertText en="No shopper has come yet" ne="अझै कुनै ग्राहक आएका छैनन्" />
              </div>
            </>
          )}
        </div>

        <div className="bg-brand-paper rounded-lg border border-brand-green-line p-4">
          <div className="text-sm text-brand-muted">Error Rate</div>
          <div
            className={`text-3xl font-bold mt-2 ${
              monitoring.performance.errorRate > 1
                ? "text-red-600"
                : "text-green-600"
            }`}
          >
            {monitoring.performance.errorRate.toFixed(2)}%
          </div>
        </div>

        <div className="bg-brand-paper rounded-lg border border-brand-green-line p-4">
          <div className="text-sm text-brand-muted">Total Errors</div>
          <div
            className={`text-3xl font-bold mt-2 ${
              monitoring.errors.totalErrors > 10 ? "text-red-600" : "text-brand-green"
            }`}
          >
            {monitoring.errors.totalErrors}
          </div>
          <div className="text-xs text-brand-muted mt-2">
            Last 24 hours
          </div>
        </div>
      </div>

      {/* Top Errors */}
      <div className="bg-brand-paper rounded-lg border border-brand-green-line p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-brand-green-ink">
            🚨 Top Errors
          </h2>
          {monitoring.errors.topErrors.length > 0 ? (
            <button
              type="button"
              onClick={clearErrors}
              disabled={clearing}
              className="shrink-0 rounded-lg border border-brand-green-line px-3 py-1.5 text-xs font-bold text-brand-muted transition hover:border-brand-clay hover:text-brand-clay disabled:opacity-50"
            >
              {clearing ? "Clearing…" : "🧹 Clear errors"}
            </button>
          ) : null}
        </div>
        {monitoring.errors.topErrors.length === 0 ? (
          <div className="text-center py-8 text-green-600">
            ✨ No errors detected! System is healthy.
          </div>
        ) : (
          <div className="space-y-3">
            {monitoring.errors.topErrors.map((error, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center p-3 bg-red-50 border border-red-200 rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium text-brand-green-ink text-sm">
                    {error.message}
                  </p>
                </div>
                <span className="px-3 py-1 bg-red-200 text-red-700 rounded-full text-sm font-medium">
                  {error.count}x
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Errors.
          These were being fetched on every refresh and then dropped: the page
          asked the server for the last twenty failures and rendered none of
          them. Top Errors above answers "what keeps breaking"; only this
          answers "what broke just now, and during what" — which is the one a
          shop needs at four in the afternoon with an order half-placed. */}
      <div className="bg-brand-paper rounded-lg border border-brand-green-line p-6">
        <h2 className="text-lg font-semibold text-brand-green-ink mb-4">
          🕐 Recent Errors
        </h2>
        {monitoring.errors.recentErrors.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-green-600">
              ✨ <AlertText en="Nothing has broken." ne="केही बिग्रेको छैन।" />
            </p>
            <p className="mt-1 text-xs text-brand-muted">
              <AlertText
                en="Not one error recorded in the last 24 hours."
                ne="पछिल्लो २४ घण्टामा एउटै गल्ती रेकर्ड भएको छैन।"
              />
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-brand-green-line">
            {monitoring.errors.recentErrors.map((entry) => (
              <li key={entry.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${
                      entry.level === "error"
                        ? "bg-red-100 text-red-700"
                        : entry.level === "warning"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-brand-mist text-brand-muted"
                    }`}
                  >
                    {entry.level}
                  </span>
                  <span className="text-xs tabular-nums text-brand-muted">
                    {formatWhen(entry.created_at ?? entry.timestamp)}
                  </span>
                  {entry.context ? (
                    <span className="rounded bg-brand-mist px-2 py-0.5 font-mono text-xs text-brand-muted">
                      {entry.context}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 break-words text-sm text-brand-green-ink">
                  {entry.message}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* How fast the shop felt, ordered slowest first. */}
      <div className="bg-brand-paper rounded-lg border border-brand-green-line p-6">
        <h2 className="text-lg font-semibold text-brand-green-ink">
          ⚡ <AlertText en="How fast a page opens" ne="पाना कति छिटो खुल्छ" />
        </h2>
        {/* Two readings of one page were being ranked as "the slowest page",
            which reads as a fault and was nothing of the kind: 428ms is a good
            time, and it was the only page anybody had measured. The colour
            called anything over 1000ms slow, so that good time was drawn in
            warning yellow. Both said something the numbers did not.

            The thresholds are Google's own for Largest Contentful Paint — 2.5s
            good, 4s needs work — because that is the bar the shop is judged
            against by the search that sends it customers. */}
        <p className="mt-1 text-sm leading-6 text-brand-muted">
          <AlertText
            en={`Measured on shoppers' own phones — last 24 hours${
              monitoring.performance.samples > 0
                ? ` · ${monitoring.performance.samples} readings in all`
                : ""
            }`}
            ne={`ग्राहकको फोनमा नापिएको — पछिल्लो २४ घण्टा${
              monitoring.performance.samples > 0
                ? ` · जम्मा ${monitoring.performance.samples} नाप`
                : ""
            }`}
          />
        </p>

        {/* Said out loud rather than dropped silently. A dev server compiles a
            page on first request and takes ten to twenty seconds; those
            readings were landing here as though customers were waiting that
            long, and /contact was reported at 20.6s on a day the live page
            answered in 1.1s. They are set aside now — and the screen says so,
            because a number quietly removed is its own kind of dishonesty. */}
        {monitoring.performance.setAside > 0 ? (
          <p className="mt-1 text-xs leading-5 text-brand-muted">
            ℹ️{" "}
            <AlertText
              en={`${monitoring.performance.setAside} readings were from testing (your own computer, or a preview) — they are not counted above.`}
              ne={`${monitoring.performance.setAside} नाप परीक्षणका (आफ्नै कम्प्युटर वा preview) — माथिको हिसाबमा गनिएको छैन।`}
            />
          </p>
        ) : null}

        {monitoring.performance.slowestEndpoints.length === 0 ? (
          <p className="mt-4 rounded-lg bg-brand-paper-deep px-4 py-3 text-sm text-brand-muted">
            <AlertText
              en="No shopper has come yet — this fills in once there is something to measure."
              ne="अझै कुनै ग्राहक आएका छैनन् — नाप्ने कुरा भएपछि यहीँ देखिन्छ।"
            />
          </p>
        ) : (
          <>
            {/* A ranking has to say how much of one it is. Under ten readings
                the order is chance, and the first row looks like a finding. */}
            {monitoring.performance.samples < 10 ? (
              <p className="mt-4 rounded-lg border border-brand-green-line bg-brand-green-wash px-4 py-3 text-sm font-semibold leading-6 text-brand-green">
                🔵{" "}
                <AlertText
                  en="Too few readings yet — a dependable ranking needs at least ten. What is below is everything there is, not an order of merit."
                  ne="अझै थोरै नाप — भरपर्दो क्रम देखाउन कम्तीमा १० चाहिन्छ। तल क्रम होइन, भएको जति देखाइएको हो।"
                />
              </p>
            ) : null}

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-brand-green-line">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-brand-green-ink">
                      <AlertText en="Page" ne="पाना" />
                    </th>
                    <th className="px-4 py-2 text-left font-semibold text-brand-green-ink">
                      <AlertText en="Time" ne="समय" />
                    </th>
                    <th className="px-4 py-2 text-left font-semibold text-brand-green-ink">
                      <AlertText en="How it reads" ne="कस्तो" />
                    </th>
                    <th className="px-4 py-2 text-left font-semibold text-brand-green-ink">
                      <AlertText en="Readings" ne="नाप" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-green-line">
                  {monitoring.performance.slowestEndpoints.map((endpoint) => {
                    const verdict =
                      endpoint.avgTime <= 2500
                        ? { label: { en: "🟢 Good", ne: "🟢 राम्रो" }, tone: "text-green-700" }
                        : endpoint.avgTime <= 4000
                          ? { label: { en: "🟡 Needs work", ne: "🟡 सुधार चाहिन्छ" }, tone: "text-yellow-700" }
                          : { label: { en: "🔴 Slow", ne: "🔴 सुस्त" }, tone: "text-red-700" };
                    return (
                      <tr key={`${endpoint.path}-${endpoint.rating}`} className="hover:bg-brand-paper-deep">
                        <td className="px-4 py-2 text-brand-green-ink">
                          {/* The rating used to be printed against the path —
                              "good /account/reset-password" — where it read as
                              part of the address. */}
                          <span className="rounded bg-brand-mist px-2 py-1 font-mono text-xs">
                            {endpoint.path}
                          </span>
                        </td>
                        <td className={`px-4 py-2 font-medium tabular-nums ${verdict.tone}`}>
                          {(endpoint.avgTime / 1000).toFixed(1)}s
                        </td>
                        <td className={`px-4 py-2 text-xs font-bold ${verdict.tone}`}>
                          <AlertText en={verdict.label.en} ne={verdict.label.ne} />
                        </td>
                        <td className="px-4 py-2 tabular-nums text-brand-muted">{endpoint.count}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Recommendations */}
      <div className="bg-brand-green-wash border border-brand-green-line rounded-lg p-4">
        <h3 className="font-semibold text-brand-green mb-2">💡 Recommendations</h3>
        <ul className="text-sm text-brand-green space-y-1">
          {monitoring.performance.errorRate > 1 && (
            <li>✓ Error rate is high - check recent deployments</li>
          )}
          {monitoring.performance.avgResponseTime > 1000 && (
            <li>✓ Average response time is slow - optimize slow endpoints</li>
          )}
          {monitoring.errors.totalErrors > 50 && (
            <li>✓ Many errors in last 24h - urgent investigation needed</li>
          )}
          {/* This advised adding an outside checker, which was the honest
              thing to say until there was one. There is now: GitHub Actions
              files a reading every twenty minutes while the shop is open. The
              line worth having is the opposite one — said only while nothing
              has arrived, because that is when somebody needs to look. */}
          {monitoring.uptime.outside.checks === 0 ? (
            <li>
              <AlertText
                en="✓ The outside check has filed nothing yet. If this is still empty tomorrow, look at the Uptime workflow on GitHub."
                ne="✓ बाहिरी जाँचले अझै केही पठाएको छैन। भोलि पनि खाली रह्यो भने GitHub को Uptime workflow हेर्नुहोस्।"
              />
            </li>
          ) : null}
          {monitoring.uptime.outside.lastFailureAt ? (
            <li>
              <AlertText
                en="✓ The shop failed an outside check in the last 30 days — worth reading the errors below."
                ne="✓ पछिल्लो ३० दिनमा बाहिरी जाँच एक पटक असफल भयो — तलका गल्ती हेर्नु राम्रो।"
              />
            </li>
          ) : null}
          {/* This read `!v`, left over from when these were booleans. Every value
              here is now a non-empty string, so the test was false for "down"
              exactly as often as for "up" — the line could never appear, on any
              screen, for any outage. */}
          {Object.values(monitoring.health).some((v) => v === "down") && (
            <li>✓ Some services unhealthy - check system status</li>
          )}
        </ul>
      </div>
    </div>
  );
}
