"use client";

import { useCallback, useEffect, useState } from "react";
import { createIdempotencyKeyRegistry } from "@/app/admin/factory/_components/idempotency-key";
import { nepalMonthKey } from "@/app/admin/factory/_components/nepal-date";

interface Summary {
  id: string;
  month: string;
  worker_id: string;
  worker_name: string;
  worker_type: string;
  category: string;
  total_pairs: number;
  total_earned: number;
  total_paid: number;
  final_balance: number;
  status: string;
}

export default function ReportsPage() {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [month, setMonth] = useState(() => nepalMonthKey());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKeys] = useState(() => createIdempotencyKeyRegistry());

  const generateSummaries = useCallback(async (selectedMonth: string) => {
    setError(null);
    try {
      const workersRes = await fetch("/api/factory/workers");
      if (!workersRes.ok) throw new Error("Could not load piece-rate workers.");
      const workersData = await workersRes.json();
      const workers = (workersData.workers || []).filter(
        (worker: { worker_type?: string }) => worker.worker_type === "piece_rate",
      );

      const newSummaries: Summary[] = [];
      for (const worker of workers) {
        const keyScope = `monthly-summary:${selectedMonth}:${worker.id}`;
        const res = await fetch("/api/factory/monthly-summary", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKeys.get(keyScope),
          },
          body: JSON.stringify({
            month: selectedMonth,
            worker_id: worker.id,
          }),
        });

        if (!res.ok) {
          throw new Error(`Could not calculate the report for ${worker.name}.`);
        }
        const data = await res.json();
        idempotencyKeys.rotate(keyScope);
        newSummaries.push({
          ...data,
          worker_name: worker.name,
          worker_type: worker.worker_type,
          category: worker.category,
        });
      }

      // Publish only a complete worker set. A failed worker must never leave a
      // deceptively low partial payroll total on screen.
      setSummaries(newSummaries);
      return true;
    } catch (error) {
      console.error("Error generating summaries:", error);
      setError(error instanceof Error ? error.message : "Could not generate reports.");
      return false;
    }
  }, [idempotencyKeys]);

  useEffect(() => {
    const loadSummaries = async () => {
      setLoading(true);
      setSummaries([]);
      try {
        // Draft summaries are derived snapshots. Recalculate every active
        // piece worker on load so new work, payments, or workers cannot leave
        // a plausible-looking partial/stale payroll total.
        await generateSummaries(month);
      } catch (error) {
        console.error("Error loading summaries:", error);
        setError(error instanceof Error ? error.message : "Could not load reports.");
      } finally {
        setLoading(false);
      }
    };

    loadSummaries();
  }, [generateSummaries, month]);

  const totalEarned = summaries.reduce((sum, s) => sum + s.total_earned, 0);
  const totalPairs = summaries.reduce((sum, s) => sum + s.total_pairs, 0);
  const totalPaid = summaries.reduce((sum, s) => sum + s.total_paid, 0);
  const totalBalance = summaries.reduce((sum, s) => sum + s.final_balance, 0);

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">📊 Monthly Reports</h1>

        <div className="flex gap-3 mb-6">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="min-h-12 px-3 py-2 border border-slate-300 rounded-lg"
          />
          <button
            onClick={() => generateSummaries(month)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors min-h-12"
          >
            🔄 Regenerate
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          {error} No partial report was shown.
        </div>
      )}

      {loading ? (
        <div className="text-center text-slate-500">Loading reports...</div>
      ) : (
        <div className="space-y-6">
          {/* Monthly Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white rounded-lg p-4 sm:p-6 border border-slate-200">
              <div className="text-xs sm:text-sm text-slate-600">Total Pairs</div>
              <div className="text-2xl sm:text-3xl font-bold text-blue-600 mt-2">{totalPairs}</div>
            </div>

            <div className="bg-white rounded-lg p-4 sm:p-6 border border-slate-200">
              <div className="text-xs sm:text-sm text-slate-600">Total Earned</div>
              <div className="text-2xl sm:text-3xl font-bold text-green-600 mt-2">
                Rs. {totalEarned.toLocaleString()}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 sm:p-6 border border-slate-200">
              <div className="text-xs sm:text-sm text-slate-600">Total Paid</div>
              <div className="text-2xl sm:text-3xl font-bold text-purple-600 mt-2">
                Rs. {totalPaid.toLocaleString()}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 sm:p-6 border border-slate-200">
              <div className="text-xs sm:text-sm text-slate-600">Balance Due</div>
              <div className="text-2xl sm:text-3xl font-bold text-amber-600 mt-2">
                Rs. {totalBalance.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Payroll Table */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
            <div className="p-4 sm:p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">💰 Payroll Summary</h2>
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200">
                  <tr className="text-xs sm:text-sm text-slate-600 font-semibold">
                    <th className="text-left py-2 px-2 sm:px-4">Worker Name</th>
                    <th className="text-left py-2 px-2 sm:px-4">Category</th>
                    <th className="text-center py-2 px-2 sm:px-4">Pairs</th>
                    <th className="text-right py-2 px-2 sm:px-4">Earned</th>
                    <th className="text-right py-2 px-2 sm:px-4">Paid</th>
                    <th className="text-right py-2 px-2 sm:px-4">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.length > 0 ? (
                    summaries
                      .sort((a, b) => b.total_earned - a.total_earned)
                      .map((summary, idx) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-3 px-2 sm:px-4 font-medium text-slate-900">
                            {summary.worker_name}
                          </td>
                          <td className="py-3 px-2 sm:px-4 text-slate-600">
                            {summary.category}
                          </td>
                          <td className="py-3 px-2 sm:px-4 text-center text-slate-900">
                            {summary.total_pairs}
                          </td>
                          <td className="py-3 px-2 sm:px-4 text-right text-green-600 font-semibold">
                            Rs. {summary.total_earned.toLocaleString()}
                          </td>
                          <td className="py-3 px-2 sm:px-4 text-right text-purple-600 font-semibold">
                            Rs. {summary.total_paid.toLocaleString()}
                          </td>
                          <td className="py-3 px-2 sm:px-4 text-right font-bold">
                            <span
                              className={`${
                                summary.final_balance > 0
                                  ? "text-amber-600"
                                  : "text-slate-500"
                              }`}
                            >
                              Rs. {summary.final_balance.toLocaleString()}
                            </span>
                          </td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No data for this month
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Export Button */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                const csv = [
                  ["Worker Name", "Category", "Pairs", "Earned", "Paid", "Due"],
                  ...summaries.map((s) => [
                    s.worker_name,
                    s.category,
                    s.total_pairs,
                    s.total_earned,
                    s.total_paid,
                    s.final_balance,
                  ]),
                ]
                  .map((row) => row.join(","))
                  .join("\n");

                const blob = new Blob([csv], { type: "text/csv" });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `payroll-${month}.csv`;
                a.click();
              }}
              className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              📥 Export CSV
            </button>
            <button
              onClick={() => window.print()}
              className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              🖨️ Print Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
