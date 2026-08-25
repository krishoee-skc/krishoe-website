"use client";

import { useMemo, useState } from "react";
import { UserIcon, CheckIcon } from "@/components/Icons";

interface WorkerMetrics {
  workerId: string;
  workerName: string;
  category: string;

  // Today
  todayPairs: number;
  todayEarnings: number;

  // Weekly
  weeklyPairs: number;
  weeklyEarnings: number;
  weeklyDays: number;

  // Monthly
  monthlyPairs: number;
  monthlyEarnings: number;
  monthlyDays: number;

  // Quality
  completedPairs: number;
  reworkPairs: number;
  defectRate: number;

  // Attendance
  presentDays: number;
  absentDays: number;
  attendanceRate: number;
}

interface WorkerAnalyticsDashboardProps {
  workers: WorkerMetrics[];
  month?: string;
  year?: string;
}

const formatCurrency = (amount: number) => `Rs. ${amount.toLocaleString("en-IN")}`;
const formatNumber = (num: number) => num.toLocaleString("en-IN");

export default function WorkerAnalyticsDashboard({
  workers,
  month = "August",
  year = "2026",
}: WorkerAnalyticsDashboardProps) {
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);

  // Top performers
  const topPerformers = useMemo(() => {
    return [...workers]
      .sort((a, b) => b.monthlyEarnings - a.monthlyEarnings)
      .slice(0, 5);
  }, [workers]);

  // Quality champions (lowest defect rate)
  const qualityChampions = useMemo(() => {
    return [...workers]
      .filter((w) => w.defectRate >= 0)
      .sort((a, b) => a.defectRate - b.defectRate)
      .slice(0, 3);
  }, [workers]);

  // Attendance champions
  const attendanceChampions = useMemo(() => {
    return [...workers]
      .sort((a, b) => b.attendanceRate - a.attendanceRate)
      .slice(0, 3);
  }, [workers]);

  const selectedWorkerData = selectedWorker
    ? workers.find((w) => w.workerId === selectedWorker)
    : null;

  // Calculate team stats
  const teamStats = useMemo(() => {
    const totalWorkers = workers.length;
    const totalMonthlyEarnings = workers.reduce((sum, w) => sum + w.monthlyEarnings, 0);
    const totalMonthlyPairs = workers.reduce((sum, w) => sum + w.monthlyPairs, 0);
    const avgEarnings = totalMonthlyEarnings / totalWorkers;
    const avgPairs = totalMonthlyPairs / totalWorkers;
    const avgDefect = workers.reduce((sum, w) => sum + w.defectRate, 0) / totalWorkers;
    const avgAttendance = workers.reduce((sum, w) => sum + w.attendanceRate, 0) / totalWorkers;

    return {
      totalWorkers,
      totalMonthlyEarnings,
      totalMonthlyPairs,
      avgEarnings,
      avgPairs,
      avgDefect,
      avgAttendance,
    };
  }, [workers]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg border border-brand-green/20 bg-brand-paper p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-muted">
              Worker Analytics
            </p>
            <h1 className="text-2xl font-black text-brand-green-ink">
              🏆 Performance Dashboard
            </h1>
            <p className="mt-1 text-sm text-brand-muted">
              {month} {year} • {teamStats.totalWorkers} workers
            </p>
          </div>
        </div>
      </div>

      {/* Team Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-brand-green-line bg-brand-paper p-4">
          <p className="text-xs font-semibold uppercase text-brand-muted mb-2">
            📊 Total Pairs
          </p>
          <p className="text-2xl font-black text-brand-green-ink">
            {formatNumber(teamStats.totalMonthlyPairs)}
          </p>
          <p className="text-xs text-brand-muted mt-1">
            Avg: {Math.round(teamStats.avgPairs)} pairs/worker
          </p>
        </div>

        <div className="rounded-lg border border-brand-green-line bg-brand-paper p-4">
          <p className="text-xs font-semibold uppercase text-brand-muted mb-2">
            💰 Total Earnings
          </p>
          <p className="text-2xl font-black text-brand-green-ink">
            {formatCurrency(teamStats.totalMonthlyEarnings)}
          </p>
          <p className="text-xs text-brand-muted mt-1">
            Avg: {formatCurrency(teamStats.avgEarnings)}/worker
          </p>
        </div>

        <div className="rounded-lg border border-brand-green-line bg-brand-paper p-4">
          <p className="text-xs font-semibold uppercase text-brand-muted mb-2">
            ✅ Quality Rate
          </p>
          <p className="text-2xl font-black text-brand-green-ink">
            {(100 - teamStats.avgDefect).toFixed(1)}%
          </p>
          <p className="text-xs text-brand-muted mt-1">
            Defect rate: {teamStats.avgDefect.toFixed(2)}%
          </p>
        </div>

        <div className="rounded-lg border border-brand-green-line bg-brand-paper p-4">
          <p className="text-xs font-semibold uppercase text-brand-muted mb-2">
             📅 Attendance
          </p>
          <p className="text-2xl font-black text-brand-green-ink">
            {teamStats.avgAttendance.toFixed(0)}%
          </p>
          <p className="text-xs text-brand-muted mt-1">
            Avg attendance rate
          </p>
        </div>
      </div>

      {/* Top Performers */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Top 5 Earners */}
        <div className="rounded-lg border border-brand-green/20 bg-brand-paper p-6">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="font-bold text-brand-green-ink">📈 🥇 Top Earners</h2>
          </div>
          <div className="space-y-3">
            {topPerformers.map((worker, idx) => (
              <button
                key={worker.workerId}
                onClick={() => setSelectedWorker(worker.workerId)}
                className={`w-full rounded-lg border p-3 text-left transition ${
                  selectedWorker === worker.workerId
                    ? "border-brand-green bg-brand-green/10"
                    : "border-brand-green-line hover:border-brand-green"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-brand-green">
                        #{idx + 1}
                      </span>
                      <span className="font-bold text-brand-muted-deep">
                        {worker.workerName}
                      </span>
                    </div>
                    <p className="text-xs text-brand-muted mt-1">
                      {worker.category}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-brand-green-ink">
                      {formatCurrency(worker.monthlyEarnings)}
                    </p>
                    <p className="text-xs text-brand-muted">
                      {worker.monthlyPairs} pairs
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Quality Champions */}
        <div className="rounded-lg border border-brand-green/20 bg-brand-paper p-6">
          <div className="mb-4 flex items-center gap-2">
            <CheckIcon className="h-5 w-5 text-brand-green" />
            <h2 className="font-bold text-brand-green-ink">✨ Quality Leaders</h2>
          </div>
          <div className="space-y-3">
            {qualityChampions.map((worker, idx) => (
              <div
                key={worker.workerId}
                className="rounded-lg border border-emerald-200 bg-emerald-50 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-emerald-600">
                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}
                      </span>
                      <span className="font-bold text-emerald-900">
                        {worker.workerName}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-700">
                      {(100 - worker.defectRate).toFixed(1)}%
                    </p>
                    <p className="text-xs text-emerald-600">
                      Quality
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Attendance Champions */}
        <div className="rounded-lg border border-brand-green/20 bg-brand-paper p-6">
          <div className="mb-4 flex items-center gap-2">
            <UserIcon className="h-5 w-5 text-brand-green" />
            <h2 className="font-bold text-brand-green-ink">📅 Attendance Champs</h2>
          </div>
          <div className="space-y-3">
            {attendanceChampions.map((worker, idx) => (
              <div
                key={worker.workerId}
                className="rounded-lg border border-brand-green-line bg-brand-green-wash p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-brand-green">
                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}
                      </span>
                      <span className="font-bold text-brand-green">
                        {worker.workerName}
                      </span>
                    </div>
                    <p className="text-xs text-brand-green mt-1">
                      {worker.presentDays} days present
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-brand-green">
                      {worker.attendanceRate.toFixed(0)}%
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Selected Worker Details */}
      {selectedWorkerData && (
        <div className="rounded-lg border border-brand-green/30 bg-brand-green/5 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-brand-muted">
                Detailed View
              </p>
              <h2 className="text-2xl font-black text-brand-green-ink">
                {selectedWorkerData.workerName}
              </h2>
              <p className="text-sm text-brand-muted">
                {selectedWorkerData.category} • Piece-Rate Worker
              </p>
            </div>
            <button
              onClick={() => setSelectedWorker(null)}
              className="rounded-lg border border-brand-green-line px-4 py-2 font-bold text-brand-muted-deep hover:bg-brand-paper-deep"
            >
              Close
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {/* Today */}
            <div className="rounded-lg border border-brand-green-line bg-brand-paper p-4">
              <p className="text-xs font-bold uppercase text-brand-muted mb-2">
                📊 TODAY
              </p>
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-brand-muted">Pairs</p>
                  <p className="text-xl font-black text-brand-green-ink">
                    {selectedWorkerData.todayPairs}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-brand-muted">Earnings</p>
                  <p className="font-bold text-brand-green-ink">
                    {formatCurrency(selectedWorkerData.todayEarnings)}
                  </p>
                </div>
              </div>
            </div>

            {/* Weekly */}
            <div className="rounded-lg border border-brand-green-line bg-brand-paper p-4">
              <p className="text-xs font-bold uppercase text-brand-muted mb-2">
                📈 THIS WEEK
              </p>
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-brand-muted">Pairs</p>
                  <p className="text-xl font-black text-brand-green-ink">
                    {selectedWorkerData.weeklyPairs}
                  </p>
                  <p className="text-xs text-brand-muted">
                    {selectedWorkerData.weeklyDays} days
                  </p>
                </div>
                <div>
                  <p className="text-sm text-brand-muted">Earnings</p>
                  <p className="font-bold text-brand-green-ink">
                    {formatCurrency(selectedWorkerData.weeklyEarnings)}
                  </p>
                </div>
              </div>
            </div>

            {/* Monthly */}
            <div className="rounded-lg border border-brand-green-line bg-brand-paper p-4">
              <p className="text-xs font-bold uppercase text-brand-muted mb-2">
                📊 THIS MONTH
              </p>
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-brand-muted">Pairs</p>
                  <p className="text-xl font-black text-brand-green-ink">
                    {selectedWorkerData.monthlyPairs}
                  </p>
                  <p className="text-xs text-brand-muted">
                    {selectedWorkerData.monthlyDays} days
                  </p>
                </div>
                <div>
                  <p className="text-sm text-brand-muted">Earnings</p>
                  <p className="font-bold text-brand-green-ink">
                    {formatCurrency(selectedWorkerData.monthlyEarnings)}
                  </p>
                </div>
              </div>
            </div>

            {/* Quality Metrics */}
            <div className="rounded-lg border border-brand-green-line bg-brand-paper p-4">
              <p className="text-xs font-bold uppercase text-brand-muted mb-2">
                ✅ QUALITY
              </p>
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-brand-muted">Completed</p>
                  <p className="text-xl font-black text-emerald-600">
                    {selectedWorkerData.completedPairs}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-brand-muted">Rework</p>
                  <p className="text-lg font-bold text-orange-600">
                    {selectedWorkerData.reworkPairs}
                  </p>
                </div>
              </div>
            </div>

            {/* Defect Rate */}
            <div className="rounded-lg border border-brand-green-line bg-brand-paper p-4">
              <p className="text-xs font-bold uppercase text-brand-muted mb-2">
                🎯 DEFECT RATE
              </p>
              <div className="space-y-3">
                <div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-black text-brand-green-ink">
                      {(100 - selectedWorkerData.defectRate).toFixed(1)}%
                    </p>
                    <p className="text-xs text-brand-muted">quality</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-brand-muted">
                    Defect: {selectedWorkerData.defectRate.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Attendance */}
            <div className="rounded-lg border border-brand-green-line bg-brand-paper p-4">
              <p className="text-xs font-bold uppercase text-brand-muted mb-2">
                📅 ATTENDANCE
              </p>
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-brand-muted">Present</p>
                  <p className="text-xl font-black text-brand-green">
                    {selectedWorkerData.presentDays}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-brand-muted">Rate</p>
                  <p className="font-bold text-brand-green">
                    {selectedWorkerData.attendanceRate.toFixed(0)}%
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Gauge */}
          <div className="mt-6 rounded-lg border border-brand-green-line bg-brand-paper p-4">
            <p className="mb-4 font-bold text-brand-green-ink">
              📊 Monthly Performance vs Team Average
            </p>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between gap-2 mb-2">
                  <span className="text-sm font-semibold text-brand-muted-deep">
                    Earnings
                  </span>
                  <span className="text-sm font-bold text-brand-muted">
                    {(
                      (selectedWorkerData.monthlyEarnings /
                        teamStats.avgEarnings) *
                      100
                    ).toFixed(0)}% of avg
                  </span>
                </div>
                <div className="h-2 rounded-full bg-brand-green-line">
                  <div
                    className="h-2 rounded-full bg-brand-green transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        (selectedWorkerData.monthlyEarnings /
                          teamStats.avgEarnings) *
                          100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between gap-2 mb-2">
                  <span className="text-sm font-semibold text-brand-muted-deep">
                    Production
                  </span>
                  <span className="text-sm font-bold text-brand-muted">
                    {(
                      (selectedWorkerData.monthlyPairs /
                        teamStats.avgPairs) *
                      100
                    ).toFixed(0)}% of avg
                  </span>
                </div>
                <div className="h-2 rounded-full bg-brand-green-line">
                  <div
                    className="h-2 rounded-full bg-brand-green transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        (selectedWorkerData.monthlyPairs /
                          teamStats.avgPairs) *
                          100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between gap-2 mb-2">
                  <span className="text-sm font-semibold text-brand-muted-deep">
                    Quality Rate
                  </span>
                  <span className="text-sm font-bold text-brand-muted">
                    {(
                      ((100 - selectedWorkerData.defectRate) /
                        (100 - teamStats.avgDefect)) *
                      100
                    ).toFixed(0)}% of avg
                  </span>
                </div>
                <div className="h-2 rounded-full bg-brand-green-line">
                  <div
                    className="h-2 rounded-full bg-emerald-500 transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        (
                          ((100 - selectedWorkerData.defectRate) /
                            (100 - teamStats.avgDefect)) *
                          100
                        )
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Insights */}
      <div className="rounded-lg border border-brand-gold/30 bg-brand-cream-soft p-6">
        <p className="mb-3 font-bold text-brand-gold-ink">📌 Key Insights</p>
        <ul className="space-y-2 text-sm text-brand-muted-deep">
          <li>
            ✅ Top earner <span className="font-bold">{topPerformers[0]?.workerName}</span> made{" "}
            <span className="font-bold">
              {formatCurrency(topPerformers[0]?.monthlyEarnings || 0)}
            </span>{" "}
            this month
          </li>
          <li>
            ✨ Best quality worker{" "}
            <span className="font-bold">{qualityChampions[0]?.workerName}</span> with{" "}
            <span className="font-bold">
              {(100 - (qualityChampions[0]?.defectRate || 0)).toFixed(1)}%
            </span>{" "}
            quality rate
          </li>
          <li>
            📅 Best attendance{" "}
            <span className="font-bold">{attendanceChampions[0]?.workerName}</span> with{" "}
            <span className="font-bold">
              {attendanceChampions[0]?.attendanceRate.toFixed(0)}%
            </span>{" "}
            attendance
          </li>
          <li>
            🏆 Team produced{" "}
            <span className="font-bold">
              {formatNumber(teamStats.totalMonthlyPairs)} pairs
            </span>{" "}
            worth{" "}
            <span className="font-bold">
              {formatCurrency(teamStats.totalMonthlyEarnings)}
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
