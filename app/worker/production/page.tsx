"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface ProductionRecord {
  date: string;
  item: string;
  pairsCompleted: number;
  pairsRework: number;
  amountEarned: number;
}

export default function ProductionPage() {
  const searchParams = useSearchParams();
  const workerId = searchParams.get("id");

  // Mock data
  const monthlyProduction = {
    month: "August 2026",
    totalPairs: 430,
    reworkPairs: 8,
    totalEarnings: 25000,
    averageDailyPairs: 21,
    qualityRate: 98.1,
    records: [
      { date: "2026-08-06", item: "Model A", pairsCompleted: 25, pairsRework: 0, amountEarned: 1500 },
      { date: "2026-08-05", item: "Model B", pairsCompleted: 24, pairsRework: 1, amountEarned: 1400 },
      { date: "2026-08-04", item: "Model A", pairsCompleted: 20, pairsRework: 0, amountEarned: 1200 },
      { date: "2026-08-02", item: "Model C", pairsCompleted: 22, pairsRework: 2, amountEarned: 1200 },
      { date: "2026-08-01", item: "Model B", pairsCompleted: 23, pairsRework: 1, amountEarned: 1400 },
    ],
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 p-4 mb-6">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">📦 Production Details</h1>
          <Link
            href={`/worker/dashboard?id=${workerId}`}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        {/* Month Overview */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            📈 {monthlyProduction.month}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-600">Total Pairs</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">
                {monthlyProduction.totalPairs}
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-600">Daily Average</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">
                {monthlyProduction.averageDailyPairs} 👟
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-600">Quality Rate</div>
              <div className="text-3xl font-bold text-green-600 mt-2">
                {monthlyProduction.qualityRate}%
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-600">Total Earnings</div>
              <div className="text-3xl font-bold text-blue-600 mt-2">
                Rs. {(monthlyProduction.totalEarnings / 1000).toFixed(0)}K
              </div>
            </div>
          </div>
        </div>

        {/* Quality Metrics */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">✨ Quality Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm text-gray-600 mb-2">Completed Pairs</div>
              <div className="text-3xl font-bold text-gray-900">
                {monthlyProduction.totalPairs - monthlyProduction.reworkPairs}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Pairs that passed quality check
              </p>
            </div>

            <div>
              <div className="text-sm text-gray-600 mb-2">Rework Pairs</div>
              <div className="text-3xl font-bold text-orange-600">
                {monthlyProduction.reworkPairs}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Pairs requiring rework
              </p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <div className="bg-green-50 p-4 rounded">
              <p className="text-sm text-green-900">
                ✨ Your quality rate of {monthlyProduction.qualityRate}% is excellent!
              </p>
              <p className="text-xs text-green-600 mt-1">
                Keep it above 95% for bonus eligibility
              </p>
            </div>
          </div>
        </div>

        {/* Daily Records */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">📋 Daily Production Records</h3>
          </div>

          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Item
                </th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">
                  Completed
                </th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">
                  Rework
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                  Earned
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {monthlyProduction.records.map((record) => (
                <tr key={record.date} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-900">
                    {new Date(record.date).toLocaleDateString("default", {
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">
                    {record.item}
                  </td>
                  <td className="px-6 py-3 text-center text-sm text-gray-900 font-medium">
                    {record.pairsCompleted}
                  </td>
                  <td className="px-6 py-3 text-center text-sm">
                    {record.pairsRework > 0 ? (
                      <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                        {record.pairsRework}
                      </span>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right text-sm text-gray-900 font-medium">
                    Rs. {record.amountEarned.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between">
            <span className="font-semibold text-gray-900">Total This Month</span>
            <span className="font-bold text-gray-900">
              Rs. {monthlyProduction.totalEarnings.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
