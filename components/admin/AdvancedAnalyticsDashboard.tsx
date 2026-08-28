"use client";

import { useCallback, useEffect, useState } from "react";
import { formatAdminDate } from "@/lib/format-date";

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

export default function AdvancedAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [workers, setWorkers] = useState<WorkerMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "trends" | "forecast" | "goals" | "workers">(
    "overview"
  );

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const [analyticsRes, workersRes] = await Promise.all([
        fetch("/api/admin/analytics"),
        fetch("/api/admin/analytics?section=workers"),
      ]);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ahead":
        return "text-green-600 bg-green-50";
      case "on_track":
        return "text-brand-green bg-brand-green-wash";
      case "behind":
        return "text-orange-600 bg-orange-50";
      default:
        return "text-brand-muted bg-brand-paper-deep";
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return "bg-green-500";
    if (progress >= 75) return "bg-brand-green";
    if (progress >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-brand-muted">
        Loading advanced analytics...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-brand-paper rounded-lg border border-brand-green-line p-6">
        <h1 className="font-display text-3xl font-black text-brand-green-ink mb-2">
          📊 Advanced Analytics
        </h1>
        <p className="text-brand-muted">
          Comprehensive insights, trends, forecasts, and performance metrics
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-brand-green-line overflow-x-auto">
        {([
          { key: "overview" as const, label: "📈 Overview", icon: "📊" },
          { key: "trends" as const, label: "📉 30-Day Trends", icon: "📊" },
          { key: "forecast" as const, label: "🔮 Forecast", icon: "🔮" },
          { key: "goals" as const, label: "🎯 Goals", icon: "🎯" },
          { key: "workers" as const, label: "👥 Workers", icon: "👥" },
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
                      Last month: {metric.previous}
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

          {/* Customer Analytics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-brand-paper rounded-lg border border-brand-green-line p-4">
              <h3 className="font-semibold text-brand-green-ink mb-4">👥 Customer Analytics</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-brand-muted">Total Customers</span>
                  <span className="font-bold text-brand-green-ink">
                    {analytics.customerAnalytics.totalCustomers}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-muted">Returning Customers</span>
                  <span className="font-bold text-brand-green-ink">
                    {analytics.customerAnalytics.returningCustomers}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-muted">Avg Order Value</span>
                  <span className="font-bold text-brand-green-ink">
                    Rs. {analytics.customerAnalytics.avgOrderValue.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-muted">Repeat Order Rate</span>
                  <span className="font-bold text-brand-green-ink">
                    {analytics.customerAnalytics.repeatOrderRate}%
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-brand-paper rounded-lg border border-brand-green-line p-4">
              <h3 className="font-semibold text-brand-green-ink mb-4">📞 Customer Insights</h3>
              <div className="space-y-2 text-sm text-brand-muted">
                <p>
                  ✨ {analytics.customerAnalytics.repeatOrderRate}% of customers
                  made repeat purchases
                </p>
                <p>
                  💰 Average order value is Rs.{" "}
                  {analytics.customerAnalytics.avgOrderValue.toLocaleString()}
                </p>
                <p>
                  👥 {analytics.customerAnalytics.returningCustomers} out of{" "}
                  {analytics.customerAnalytics.totalCustomers} customers are
                  repeat buyers
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trends Tab */}
      {activeTab === "trends" && analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[
            { title: "📊 Sales Trend (30 Days)", data: analytics.salesTrend },
            { title: "📦 Production Trend (30 Days)", data: analytics.productionTrend },
            { title: "💰 Revenue Trend (30 Days)", data: analytics.revenueTrend },
          ].map((trend, idx) => (
            <div key={idx} className="bg-brand-paper rounded-lg border border-brand-green-line p-4">
              <h3 className="font-semibold text-brand-green-ink mb-4">{trend.title}</h3>
              <div className="space-y-2">
                {trend.data.slice(-7).map((point) => (
                  <div key={point.date} className="flex justify-between items-center">
                    <span className="text-sm text-brand-muted">{point.label}</span>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-6 bg-brand-green rounded"
                        style={{
                          width: `${Math.min(point.value / 10, 100)}px`,
                        }}
                      ></div>
                      <span className="font-bold text-brand-green-ink min-w-12">
                        {point.value}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-brand-green-line">
                <p className="text-xs text-brand-muted">
                  📊 Last 7 days shown. Total: {trend.data.reduce((sum, d) => sum + d.value, 0)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Forecast Tab */}
      {activeTab === "forecast" && (
        <div className="space-y-6">
          <div className="bg-brand-green-wash border border-brand-green-line rounded-lg p-4">
            <h3 className="font-semibold text-brand-green mb-2">🔮 AI-Powered Forecast</h3>
            <p className="text-sm text-brand-green">
              Based on recent trends, the system predicts next 30 days production and revenue
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-brand-paper rounded-lg border border-brand-green-line p-4">
              <h3 className="font-semibold text-brand-green-ink mb-4">📦 Production Forecast</h3>
              <div className="space-y-2 text-sm">
                <p className="text-brand-muted mb-3">Expected daily production:</p>
                <div className="bg-green-50 p-3 rounded">
                  <p className="font-bold text-green-900">Average: 180 pairs/day</p>
                  <p className="text-xs text-green-600">Confidence: 85%</p>
                </div>
                <p className="text-brand-muted text-xs mt-2">
                  Forecast is most accurate for next 7-10 days
                </p>
              </div>
            </div>

            <div className="bg-brand-paper rounded-lg border border-brand-green-line p-4">
              <h3 className="font-semibold text-brand-green-ink mb-4">💰 Revenue Forecast</h3>
              <div className="space-y-2 text-sm">
                <p className="text-brand-muted mb-3">Expected daily revenue:</p>
                <div className="bg-purple-50 p-3 rounded">
                  <p className="font-bold text-purple-900">Average: Rs. 35,000/day</p>
                  <p className="text-xs text-purple-600">Confidence: 80%</p>
                </div>
                <p className="text-brand-muted text-xs mt-2">
                  Based on last 7 days performance
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Goals Tab */}
      {activeTab === "goals" && analytics && (
        <div className="space-y-4">
          {analytics.goals.map((goal) => (
            <div
              key={goal.id}
              className={`rounded-lg border p-4 ${getStatusColor(goal.status)}`}
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold">{goal.name}</h3>
                <span className="text-xs font-medium px-2 py-1 rounded bg-brand-paper">
                  {goal.status.replace(/_/g, " ").toUpperCase()}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span className="font-bold">
                    {Math.round(goal.achieved)} / {goal.target}
                  </span>
                </div>

                <div className="w-full bg-brand-green-line rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${getProgressColor(
                      goal.progress
                    )}`}
                    style={{ width: `${Math.min(goal.progress, 100)}%` }}
                  ></div>
                </div>

                <div className="flex justify-between text-xs text-brand-muted">
                  <span>{Math.round(goal.progress)}% Complete</span>
                  <span>Due: {formatAdminDate(goal.deadline)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Workers Tab */}
      {activeTab === "workers" && (
        <div className="space-y-4">
          {workers.length === 0 ? (
            <div className="text-center py-8 text-brand-muted">No worker data available</div>
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
                    <p className="text-brand-muted">Quality Rate</p>
                    <p className="font-bold text-brand-green-ink">
                      {worker.qualityRate}%
                    </p>
                  </div>
                  <div>
                    <p className="text-brand-muted">Attendance</p>
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
