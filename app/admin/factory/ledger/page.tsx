"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createIdempotencyKeyRegistry } from "@/app/admin/factory/_components/idempotency-key";
import {
  nepalDateKey,
  nepalMonthKey,
} from "@/app/admin/factory/_components/nepal-date";

interface WorkerLedger {
  id: string;
  date: string;
  entry_type: string;
  work_pairs: number;
  amount_earned: number;
  payment_given: number;
  running_balance: number;
}

interface Worker {
  id: string;
  name: string;
  worker_type: string;
  category: string;
  monthly_salary: number;
}

interface LedgerData {
  worker: Worker;
  ledger: WorkerLedger[];
  summary: {
    totalPairs: number;
    totalEarned: number;
    totalPaid: number;
    currentBalance: number;
  };
}

export default function LedgerPage() {
  const searchParams = useSearchParams();
  const workerId = searchParams.get("workerId");

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>(workerId || "");
  const [ledgerData, setLedgerData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(() => nepalMonthKey());
  const [idempotencyKeys] = useState(() => createIdempotencyKeyRegistry());

  useEffect(() => {
    const loadWorkers = async () => {
      try {
        setError(null);
        const res = await fetch("/api/factory/workers", {
          signal: AbortSignal.timeout(60000)
        });
        if (!res.ok) throw new Error(`Failed to fetch workers: ${res.status}`);
        const data = await res.json();
        const pieceWorkers = (data.workers || []).filter(
          (worker: Worker) => worker.worker_type === "piece_rate",
        );
        setWorkers(pieceWorkers);
        // A staff link belongs on the Salary screen, not this piece-wage ledger.
        if (!workerId || !pieceWorkers.some((worker: Worker) => worker.id === workerId)) {
          setSelectedWorkerId(pieceWorkers[0]?.id || "");
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        setError(`Failed to load workers: ${msg}`);
        console.error("Error loading workers:", error);
      }
    };

    loadWorkers();
  }, [workerId]);

  useEffect(() => {
    if (!selectedWorkerId) return;

    const loadLedger = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/factory/ledger?workerId=${selectedWorkerId}&month=${month}`,
          { signal: AbortSignal.timeout(60000) }
        );
        if (!res.ok) throw new Error(`Failed to fetch ledger: ${res.status}`);
        const data = await res.json();
        setLedgerData(data);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        setError(`Failed to load ledger: ${msg}`);
        setLedgerData(null);
        console.error("Error loading ledger:", error);
      } finally {
        setLoading(false);
      }
    };

    loadLedger();
  }, [selectedWorkerId, month]);

  const handleRecordPayment = async () => {
    if (!selectedWorkerId || !ledgerData) return;

    const amountToGive = prompt("Enter payment amount:", ledgerData.summary.currentBalance.toString());
    if (!amountToGive) return;
    const amount = Number(amountToGive);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Enter a valid positive payment amount.");
      return;
    }
    const paymentDate = nepalDateKey();
    const keyScope = `payment:${selectedWorkerId}:${paymentDate}:${amount.toFixed(2)}`;

    try {
      const res = await fetch("/api/factory/ledger", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKeys.get(keyScope),
        },
        body: JSON.stringify({
          worker_id: selectedWorkerId,
          date: paymentDate,
          entry_type: "payment",
          payment_given: amount,
          notes: "Payment recorded",
        }),
      });

      if (res.ok) {
        idempotencyKeys.rotate(keyScope);
        // Reload ledger
        const reloadRes = await fetch(
          `/api/factory/ledger?workerId=${selectedWorkerId}&month=${month}`
        );
        const data = await reloadRes.json();
        setLedgerData(data);
      }
    } catch (error) {
      alert("Error recording payment: " + error);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6">📋 Worker Ledger</h1>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">{error}</p>
          <p className="text-red-700 text-sm mt-1">
            Database may be temporarily unavailable. Try refreshing the page.
          </p>
        </div>
      )}

      {/* Worker Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-900 mb-2">Select Worker</label>
          <select
            value={selectedWorkerId}
            onChange={(e) => setSelectedWorkerId(e.target.value)}
            className="w-full min-h-12 px-3 py-2 border border-slate-300 rounded-lg"
          >
            <option value="">Select a worker...</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.category})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-900 mb-2">Month</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-full min-h-12 px-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center text-slate-500">Loading ledger...</div>
      ) : ledgerData ? (
        <div className="space-y-6">
          {/* Worker Info */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-4">
              {ledgerData.worker.name}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <div className="text-xs sm:text-sm text-slate-600">Type</div>
                <div className="font-semibold text-slate-900 capitalize">
                  {ledgerData.worker.worker_type.replace("_", " ")}
                </div>
              </div>
              <div>
                <div className="text-xs sm:text-sm text-slate-600">Category</div>
                <div className="font-semibold text-slate-900">{ledgerData.worker.category}</div>
              </div>
              {ledgerData.worker.monthly_salary && (
                <div>
                  <div className="text-xs sm:text-sm text-slate-600">Monthly Salary</div>
                  <div className="font-semibold text-slate-900">
                    Rs. {ledgerData.worker.monthly_salary.toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white rounded-lg p-4 sm:p-6 border border-slate-200">
              <div className="text-xs sm:text-sm text-slate-600">Total Pairs</div>
              <div className="text-2xl sm:text-3xl font-bold text-blue-600 mt-2">
                {ledgerData.summary.totalPairs}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 sm:p-6 border border-slate-200">
              <div className="text-xs sm:text-sm text-slate-600">Total Earned</div>
              <div className="text-2xl sm:text-3xl font-bold text-green-600 mt-2">
                Rs. {ledgerData.summary.totalEarned.toLocaleString()}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 sm:p-6 border border-slate-200">
              <div className="text-xs sm:text-sm text-slate-600">Total Paid</div>
              <div className="text-2xl sm:text-3xl font-bold text-purple-600 mt-2">
                Rs. {ledgerData.summary.totalPaid.toLocaleString()}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 sm:p-6 border border-slate-200">
              <div className="text-xs sm:text-sm text-slate-600">Current Balance</div>
              <div className="text-2xl sm:text-3xl font-bold text-amber-600 mt-2">
                Rs. {ledgerData.summary.currentBalance.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Ledger Entries */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
            <div className="p-4 sm:p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Ledger Entries</h3>
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200">
                  <tr className="text-xs sm:text-sm text-slate-600 font-semibold">
                    <th className="text-left py-2 px-2 sm:px-4">Date</th>
                    <th className="text-left py-2 px-2 sm:px-4">Type</th>
                    <th className="text-right py-2 px-2 sm:px-4">Pairs</th>
                    <th className="text-right py-2 px-2 sm:px-4">Earned</th>
                    <th className="text-right py-2 px-2 sm:px-4">Paid</th>
                    <th className="text-right py-2 px-2 sm:px-4">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerData.ledger.length > 0 ? (
                    ledgerData.ledger.map((entry, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-2 sm:px-4 text-slate-900">
                          {new Date(entry.date).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-2 sm:px-4">
                          <span className="text-xs sm:text-sm capitalize bg-slate-100 px-2 py-1 rounded">
                            {entry.entry_type}
                          </span>
                        </td>
                        <td className="py-3 px-2 sm:px-4 text-right text-slate-900">
                          {entry.work_pairs || "-"}
                        </td>
                        <td className="py-3 px-2 sm:px-4 text-right text-green-600 font-medium">
                          {entry.amount_earned ? `+${entry.amount_earned}` : "-"}
                        </td>
                        <td className="py-3 px-2 sm:px-4 text-right text-red-600 font-medium">
                          {entry.payment_given ? `-${entry.payment_given}` : "-"}
                        </td>
                        <td className="py-3 px-2 sm:px-4 text-right font-semibold text-slate-900">
                          Rs. {entry.running_balance.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No ledger entries for this month
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Button */}
          {ledgerData.summary.currentBalance > 0 && (
            <button
              onClick={handleRecordPayment}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              💳 Record Payment
            </button>
          )}
        </div>
      ) : (
        <div className="text-center text-slate-500">Select a worker to view ledger</div>
      )}
    </div>
  );
}
