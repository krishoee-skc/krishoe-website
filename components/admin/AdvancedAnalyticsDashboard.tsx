"use client";

import { useCallback, useEffect, useState } from "react";
import { formatAdminDate } from "@/lib/format-date";
import { useLanguage } from "@/components/LanguageProvider";
import { Amount, AmountsToggle } from "@/components/admin/PageKit";
import { roundedMoney } from "@/lib/format-money";
import type { MonthGoals, RecentAverages } from "@/lib/recent-averages";

interface TrendDataPoint {
  date: string;
  label: string;
  value: number;
  target?: number;
}

interface AnalyticsMetric {
  metric: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: "up" | "down" | "flat";
}

interface GoalTracker {
  id: string;
  name: string;
  target: number;
  achieved: number;
  progress: number;
  status: "on_track" | "ahead" | "behind";
  deadline: string;
}

interface WorkerMetric {
  workerId: string;
  workerName: string;
  pairsThisMonth: number;
  earningsThisMonth: number;
  qualityRate: number;
  attendanceRate: number;
  bonusEligible: boolean;
  bonusAmount: number;
}

interface Analytics {
  salesTrend: TrendDataPoint[];
  productionTrend: TrendDataPoint[];
  revenueTrend: TrendDataPoint[];
  keyMetrics: AnalyticsMetric[];
  goals: GoalTracker[];
  customerAnalytics: {
    totalCustomers: number;
    returningCustomers: number;
    avgOrderValue: number;
    repeatOrderRate: number;
  };
}

const formatNumber = (value: number) => value.toLocaleString("en-IN");

export default function AdvancedAnalyticsDashboard() {
  const { text } = useLanguage();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [workers, setWorkers] = useState<WorkerMetric[]>([]);
  const [recent, setRecent] = useState<RecentAverages | null>(null);
  const [monthGoals, setMonthGoals] = useState<MonthGoals | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "trends" | "forecast" | "goals" | "workers">(
    "overview"
  );

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const [analyticsRes, workersRes, recentRes, goalsRes] = await Promise.all([
        fetch("/api/admin/analytics"),
        fetch("/api/admin/analytics?section=workers"),
        fetch("/api/admin/analytics?section=recent"),
        fetch("/api/admin/analytics?section=month_goals"),
      ]);

      if (goalsRes.ok) {
        const data = await goalsRes.json();
        setMonthGoals(data.data ?? null);
      }

      if (recentRes.ok) {
        const data = await recentRes.json();
        setRecent(data.data ?? null);
      }

      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data.analytics);
      }

      if (workersRes.ok) {
        const data = await workersRes.json();
        setWorkers(data.data || []);
      }
    } catch (error) {
      console.error("Failed to load analytics:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadAnalytics(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadAnalytics]);

  const getTrendEmoji = (trend: string) => {
    switch (trend) {
      case "up":
        return "📈";
      case "down":
        return "📉";
      default:
        return "➡️";
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-brand-muted">
        {text("Loading the figures…", "अंक खुल्दैछ…")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-brand-paper rounded-lg border border-brand-green-line p-6">
        <h1 className="font-display text-3xl font-black text-brand-green-ink mb-2">
          📊 {text("Business figures", "व्यापारका अंक")}
        </h1>
        <p className="text-brand-muted">
          {text("Customers, 30-day trends, goals and workers.", "ग्राहक, ३० दिनको चाल, लक्ष्य र कामदार।")}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-brand-green-line overflow-x-auto">
        {([
          { key: "overview" as const, label: text("📈 Overview", "📈 सारांश"), icon: "📊" },
          { key: "trends" as const, label: text("📉 30-day trends", "📉 ३० दिनको चाल"), icon: "📊" },
          { key: "forecast" as const, label: text("🔮 Last 30 days", "🔮 पछिल्लो ३० दिन"), icon: "🔮" },
          { key: "goals" as const, label: text("🎯 Goals", "🎯 लक्ष्य"), icon: "🎯" },
          { key: "workers" as const, label: text("👥 Workers", "👥 कामदार"), icon: "👥" },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? "border-brand-green text-brand-green"
                : "border-transparent text-brand-muted hover:text-brand-green-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && analytics && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {analytics.keyMetrics.map((metric) => (
              <div
                key={metric.metric}
                className="bg-brand-paper rounded-lg border border-brand-green-line p-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-brand-muted">{metric.metric}</p>
                    <p className="text-3xl font-bold text-brand-green-ink mt-2">
                      {metric.current}
                    </p>
                    <p className="text-xs text-brand-muted mt-1">
                      {text("Last month:", "गत महिना:")} {metric.previous}
                    </p>
                  </div>
                  <div
                    className={`text-2xl ${
                      metric.changePercent > 0
                        ? "text-green-600"
                        : metric.changePercent < 0
                        ? "text-red-600"
                        : "text-brand-muted"
                    }`}
                  >
                    {getTrendEmoji(metric.trend)}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-brand-green-line">
                  <span
                    className={`text-sm font-medium ${
                      metric.change > 0
                        ? "text-green-600"
                        : metric.change < 0
                        ? "text-red-600"
                        : "text-brand-muted"
                    }`}
                  >
                    {metric.change > 0 ? "+" : ""}{metric.change} ({metric.changePercent}%)
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Customers and the average bill (owner, 2026-10-14). "Average
              order" read the first digits of a website order's total text
              ("Rs. 2,100" as 2); the average bill is now the POS bills' own
              total, and the customer counts say they are the website's. */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-brand-green-line bg-brand-paper p-4">
              <h3 className="mb-4 font-semibold text-brand-green-ink">👥 {text("Website customers", "website का ग्राहक")}</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-brand-muted">{text("Ordered on the website", "website मा अर्डर गरेका")}</span>
                  <span className="font-bold text-brand-green-ink">{analytics.customerAnalytics.totalCustomers}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-muted">{text("Ordered more than once", "एकभन्दा बढी पटक अर्डर गरेका")}</span>
                  <span className="font-bold text-brand-green-ink">{analytics.customerAnalytics.returningCustomers}</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-brand-green-line bg-brand-paper p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <h3 className="font-semibold text-brand-green-ink">🧾 {text("Average bill (30 days)", "औसत बिल (३० दिन)")}</h3>
                <AmountsToggle />
              </div>
              {recent && recent.bills > 0 ? (
                <>
                  <p className="text-2xl font-black tabular-nums text-brand-green-ink">
                    <Amount>{roundedMoney(recent.averageBill)}</Amount>
                  </p>
                  <p className="mt-1 text-sm text-brand-muted">
                    {text(`${recent.bills} bills, voided ones left out`, `${recent.bills} वटा बिल, रद्द गरिएका बाहेक`)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-brand-muted">{text("No bill was cut in the last 30 days.", "पछिल्लो ३० दिनमा कुनै बिल काटिएको छैन।")}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Trends Tab — bills, pairs and sales from the shop's own records
          (owner, 2026-10-14). Rupees print as rupees, behind the eye, and the
          bars are drawn against the week's highest day. */}
      {activeTab === "trends" && analytics && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex justify-end lg:col-span-2">
            <AmountsToggle />
          </div>
          {[
            { title: text("🧾 Bills cut (30 days)", "🧾 काटिएका बिल (३० दिन)"), data: analytics.salesTrend, rupees: false },
            { title: text("📦 Pairs made (30 days)", "📦 बनेका जोडी (३० दिन)"), data: analytics.productionTrend, rupees: false },
            { title: text("💰 Sales less returns (30 days)", "💰 बिक्री, फिर्ता घटाएर (३० दिन)"), data: analytics.revenueTrend, rupees: true },
          ].map((trend) => {
            const week = trend.data.slice(-7);
            const highest = Math.max(1, ...week.map((point) => point.value));
            const total = trend.data.reduce((sum, point) => sum + point.value, 0);
            const show = (value: number) => (trend.rupees ? <Amount>{roundedMoney(value)}</Amount> : formatNumber(value));
            return (
              <div key={trend.title} className="rounded-lg border border-brand-green-line bg-brand-paper p-4">
                <h3 className="mb-4 font-semibold text-brand-green-ink">{trend.title}</h3>
                <div className="space-y-2">
                  {week.map((point) => (
                    <div key={point.date} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-2">
                      <span className="text-sm text-brand-muted">{point.label}</span>
                      <div className="h-5 rounded bg-brand-green-wash">
                        <div className="h-5 rounded bg-brand-green" style={{ width: `${(point.value / highest) * 100}%` }} />
                      </div>
                      <span className="min-w-12 text-right font-bold tabular-nums text-brand-green-ink">{show(point.value)}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 border-t border-brand-green-line pt-4 text-sm text-brand-muted">
                  {text("Last 7 days shown · 30 days in all: ", "पछिल्लो ७ दिन देखाइएको · ३० दिनमा जम्मा: ")}
                  <span className="font-bold text-brand-green-ink">{show(total)}</span>
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* The last 30 days, really (owner, 2026-10-14: "2 garau"). This tab
          showed "180 pairs/day, 85%" and "Rs. 35,000/day, 80%" written into
          the code since 2026-08-06; it now shows the shop's own records. */}
      {activeTab === "forecast" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-brand-green-line bg-brand-green-wash p-4">
            <p className="max-w-2xl text-sm leading-6 text-brand-green-ink">
              {text(
                "The real average of the last 30 days, from the shop's own records. Not a guess: the coming days may differ.",
                "पसलकै हिसाबबाट पछिल्लो ३० दिनको साँचो औसत। अनुमान होइन: आउने दिन फरक हुन सक्छन्।",
              )}
            </p>
            <AmountsToggle />
          </div>

          {recent === null ? (
            <p className="rounded-lg border border-dashed border-brand-green-line p-4 text-sm text-brand-muted">
              {text("These figures could not be read just now. Open the page again.", "अहिले यी अंक पढ्न सकिएन। page फेरि खोल्नुहोस्।")}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-brand-green-line bg-brand-paper p-4">
                <h3 className="font-semibold text-brand-green-ink">{text("📦 Pairs made", "📦 बनेका जोडी")}</h3>
                {recent.pairsTotal === 0 ? (
                  <p className="mt-3 text-sm text-brand-muted">{text("No work was entered in the last 30 days.", "पछिल्लो ३० दिनमा कुनै काम टिपिएको छैन।")}</p>
                ) : (
                  <div className="mt-3 grid gap-2 text-sm">
                    <p className="text-2xl font-black tabular-nums text-brand-green-ink">
                      {text(
                        `${formatNumber(Math.round(recent.pairsTotal / recent.pairsDays))} pairs on a working day`,
                        `काम भएको दिन ${formatNumber(Math.round(recent.pairsTotal / recent.pairsDays))} जोडी`,
                      )}
                    </p>
                    <p className="text-brand-muted">
                      {text(
                        `${formatNumber(recent.pairsTotal)} pairs in 30 days · work on ${recent.pairsDays} days · ${formatNumber(Math.round(recent.pairsTotal / recent.days))} a day across all 30`,
                        `३० दिनमा ${formatNumber(recent.pairsTotal)} जोडी · ${recent.pairsDays} दिन काम · ३० दिनमा बाँड्दा दिनको ${formatNumber(Math.round(recent.pairsTotal / recent.days))}`,
                      )}
                    </p>
                    <p className="text-brand-muted">
                      {text("Last work entered: ", "पछिल्लो काम टिपिएको: ")}
                      <span className="font-bold text-brand-green-ink">{formatAdminDate(recent.lastPairsDay)}</span>
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-brand-green-line bg-brand-paper p-4">
                <h3 className="font-semibold text-brand-green-ink">{text("💰 Shop sales (bills less returns)", "💰 पसलको बिक्री (बिल, फिर्ता घटाएर)")}</h3>
                {recent.salesDays === 0 ? (
                  <p className="mt-3 text-sm text-brand-muted">{text("No bill was cut in the last 30 days.", "पछिल्लो ३० दिनमा कुनै बिल काटिएको छैन।")}</p>
                ) : (
                  <div className="mt-3 grid gap-2 text-sm">
                    <p className="text-2xl font-black tabular-nums text-brand-green-ink">
                      <Amount>{roundedMoney(recent.salesTotal / recent.salesDays)}</Amount>{" "}
                      <span className="text-base font-bold">{text("on a day with sales", "बिक्री भएको दिन")}</span>
                    </p>
                    <p className="text-brand-muted">
                      {text("In 30 days: ", "३० दिनमा: ")}
                      <span className="font-bold text-brand-green-ink"><Amount>{roundedMoney(recent.salesTotal)}</Amount></span>
                      {text(` · sales on ${recent.salesDays} days · a day across all 30: `, ` · ${recent.salesDays} दिन बिक्री · ३० दिनमा बाँड्दा दिनको `)}
                      <span className="font-bold text-brand-green-ink"><Amount>{roundedMoney(recent.salesTotal / recent.days)}</Amount></span>
                    </p>
                    <p className="text-brand-muted">
                      {text("Last bill cut: ", "पछिल्लो बिल काटिएको: ")}
                      <span className="font-bold text-brand-green-ink">{formatAdminDate(recent.lastSalesDay)}</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Goals Tab — the owner's own goal for this Bikram month, from
          Settings (owner, 2026-10-14). It showed 150 orders, 5,000 pairs and
          Rs. 10 lakh written into the code. */}
      {activeTab === "goals" && (
        <div className="space-y-4">
          {monthGoals === null ? (
            <p className="rounded-lg border border-dashed border-brand-green-line p-4 text-sm text-brand-muted">
              {text("The goal could not be read just now. Open the page again.", "अहिले लक्ष्य पढ्न सकिएन। page फेरि खोल्नुहोस्।")}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-bold text-brand-green-ink">
                  {text(
                    `${monthGoals.monthEn} · day ${monthGoals.dayOfMonth} of ${monthGoals.daysInMonth}`,
                    `${monthGoals.monthNe} · ${monthGoals.daysInMonth} दिनमध्ये ${monthGoals.dayOfMonth} औँ दिन`,
                  )}
                </p>
                <AmountsToggle />
              </div>
              {[
                {
                  key: "sales",
                  title: text("💰 Sales less returns", "💰 बिक्री, फिर्ता घटाएर"),
                  goal: monthGoals.salesGoal,
                  done: monthGoals.salesSoFar,
                  show: (value: number) => <Amount>{roundedMoney(value)}</Amount>,
                },
                {
                  key: "pairs",
                  title: text("📦 Pairs made", "📦 बनेका जोडी"),
                  goal: monthGoals.productionGoal,
                  done: monthGoals.pairsSoFar,
                  show: (value: number) => <>{formatNumber(value)}</>,
                },
              ].map((row) => {
                const percent = row.goal > 0 ? (row.done / row.goal) * 100 : 0;
                const expected = (monthGoals.dayOfMonth / Math.max(1, monthGoals.daysInMonth)) * 100;
                return (
                  <div key={row.key} className="rounded-lg border border-brand-green-line bg-brand-paper p-4">
                    <h3 className="font-semibold text-brand-green-ink">{row.title}</h3>
                    {row.goal <= 0 ? (
                      <p className="mt-2 text-sm text-brand-muted">
                        {text("So far: ", "अहिलेसम्म: ")}
                        <b className="text-brand-green-ink">{row.show(row.done)}</b>
                        {text(" · no goal set for this month. ", " · यो महिनाको लक्ष्य राखिएको छैन। ")}
                        <a href="/admin/settings#goals" className="font-bold text-brand-green underline underline-offset-4">
                          {text("Set a goal", "लक्ष्य राख्ने")}
                        </a>
                      </p>
                    ) : (
                      <div className="mt-2 grid gap-2">
                        <div className="flex flex-wrap justify-between gap-2 text-sm">
                          <span>
                            <b className="text-brand-green-ink">{row.show(row.done)}</b> / {row.show(row.goal)}
                          </span>
                          <span className="font-bold text-brand-green-ink">
                            {text(`${Math.round(percent)}% done`, `${Math.round(percent)}% पूरा`)}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-brand-green-line">
                          <div className="h-2 rounded-full bg-brand-green" style={{ width: `${Math.min(percent, 100)}%` }} />
                        </div>
                        <p className="text-sm text-brand-muted">
                          {percent >= expected
                            ? text("On pace for the month.", "महिनाको गतिमा छ।")
                            : text(
                                `Behind: by today ${Math.round(expected)}% would be on pace.`,
                                `पछि छ: आजसम्म ${Math.round(expected)}% हुनुपर्ने।`,
                              )}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Workers Tab */}
      {activeTab === "workers" && (
        <div className="space-y-4">
          {workers.length === 0 ? (
            <div className="text-center py-8 text-brand-muted">{text("No worker figures yet", "अझै कामदारको अंक छैन")}</div>
          ) : (
            workers.map((worker) => (
              <div
                key={worker.workerId}
                className="bg-brand-paper rounded-lg border border-brand-green-line p-4"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-brand-green-ink">
                      {worker.workerName}
                    </h3>
                    <p className="text-sm text-brand-muted">
                      {worker.pairsThisMonth} pairs | Rs.{" "}
                      {worker.earningsThisMonth.toLocaleString()}
                    </p>
                  </div>
                  {worker.bonusEligible && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                      🎁 Bonus: Rs. {worker.bonusAmount.toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-brand-muted">{text("Quality", "गुणस्तर")}</p>
                    <p className="font-bold text-brand-green-ink">
                      {worker.qualityRate}%
                    </p>
                  </div>
                  <div>
                    <p className="text-brand-muted">{text("Attendance", "हाजिरी")}</p>
                    <p className="font-bold text-brand-green-ink">
                      {worker.attendanceRate}%
                    </p>
                  </div>
                </div>

                {worker.bonusEligible && (
                  <div className="mt-3 pt-3 border-t border-brand-green-line">
                    <p className="text-xs text-green-600">
                      ✨ Bonus eligible: Quality &gt; 95% + Attendance &gt; 90%
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
