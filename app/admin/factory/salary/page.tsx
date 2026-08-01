"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createIdempotencyKeyRegistry } from "@/app/admin/factory/_components/idempotency-key";
import {
  nepalDateKey,
  nepalMonthKey,
} from "@/app/admin/factory/_components/nepal-date";

interface StaffWorker {
  id: string;
  name: string;
  category: string;
  monthly_salary: number;
  status: string;
  worker_type: string;
}

interface SalarySummary {
  worker_id: string;
  month: string;
  total_salary: number;
  total_paid: number;
  total_advance: number;
  remaining_balance: number;
}

export default function StaffSalaryPage() {
  const searchParams = useSearchParams();
  const requestedWorkerId = searchParams.get("workerId");
  const [workers, setWorkers] = useState<StaffWorker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>("");
  const [month, setMonth] = useState(() => nepalMonthKey());
  const [summary, setSummary] = useState<SalarySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKeys] = useState(() => createIdempotencyKeyRegistry());

  // Load staff workers
  useEffect(() => {
    const loadWorkers = async () => {
      try {
        setError(null);
        const res = await fetch("/api/factory/workers?type=staff");
        if (!res.ok) throw new Error("Failed to fetch workers");
        const data = await res.json();
        const staffWorkers = (data.workers || []).filter(
          (w: StaffWorker) => w.worker_type === "monthly_staff",
        );
        setWorkers(staffWorkers);
        if (staffWorkers.length > 0) {
          setSelectedWorkerId(
            staffWorkers.some((worker: StaffWorker) => worker.id === requestedWorkerId)
              ? requestedWorkerId || staffWorkers[0].id
              : staffWorkers[0].id,
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading workers");
      } finally {
        setLoading(false);
      }
    };

    loadWorkers();
  }, [requestedWorkerId]);

  // Load salary summary
  useEffect(() => {
    if (!selectedWorkerId) return;

    const loadSummary = async () => {
      try {
        setError(null);
        const res = await fetch(
          `/api/factory/salary?workerId=${selectedWorkerId}&month=${month}`
        );
        if (!res.ok) throw new Error("Failed to load salary summary");
        const data = await res.json();
        setSummary(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading summary");
        setSummary(null);
      }
    };

    loadSummary();
  }, [selectedWorkerId, month]);

  const handleAddAdvance = async () => {
    if (!selectedWorkerId) return;

    const amount = prompt("Enter advance amount:");
    if (!amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return;
    const numericAmount = Number(amount);
    const paymentDate = nepalDateKey();
    const keyScope = `salary-advance:${selectedWorkerId}:${month}:${paymentDate}:${numericAmount.toFixed(2)}`;

    try {
      const res = await fetch("/api/factory/salary-advance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKeys.get(keyScope),
        },
        body: JSON.stringify({
          worker_id: selectedWorkerId,
          amount: numericAmount,
          date: paymentDate,
          period_month: month,
        }),
      });

      if (!res.ok) throw new Error("Failed to record advance");

      idempotencyKeys.rotate(keyScope);
      // Reload summary
      window.location.reload();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const handleAddPayment = async () => {
    if (!selectedWorkerId || !summary) return;

    const amount = prompt(
      `Enter payment amount (remaining balance: Rs. ${summary.remaining_balance}):`
    );
    if (!amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return;
    const numericAmount = Number(amount);
    const paymentDate = nepalDateKey();
    const keyScope = `salary-payment:${selectedWorkerId}:${month}:${paymentDate}:${numericAmount.toFixed(2)}`;

    try {
      const res = await fetch("/api/factory/salary-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKeys.get(keyScope),
        },
        body: JSON.stringify({
          worker_id: selectedWorkerId,
          amount: numericAmount,
          date: paymentDate,
          period_month: month,
        }),
      });

      if (!res.ok) throw new Error("Failed to record payment");

      idempotencyKeys.rotate(keyScope);
      // Reload summary
      window.location.reload();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  if (loading) {
    return <div className="p-6">Loading staff workers...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-black text-brand-green-ink mb-6">
        💼 Staff Salary Management
      </h1>

      <p className="mb-6 text-sm text-slate-600">
        Monthly factory staff are managed here. Daily staff attendance, wages,
        deductions, and payroll remain in the HR section.
      </p>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Select Staff Member
          </label>
          <select
            value={selectedWorkerId}
            onChange={(e) => setSelectedWorkerId(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg"
          >
            <option value="">-- Choose staff --</option>
            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.name} - Rs. {worker.monthly_salary}/month
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Month
          </label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg"
          />
        </div>
      </div>

      {summary ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-600 font-semibold">
                Monthly Salary
              </p>
              <p className="text-2xl font-black text-brand-green mt-2">
                Rs. {summary.total_salary.toLocaleString()}
              </p>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-600 font-semibold">Total Paid</p>
              <p className="text-2xl font-black text-blue-600 mt-2">
                Rs. {summary.total_paid.toLocaleString()}
              </p>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-600 font-semibold">
                Total Advance
              </p>
              <p className="text-2xl font-black text-amber-600 mt-2">
                Rs. {summary.total_advance.toLocaleString()}
              </p>
            </div>

            <div
              className={`rounded-lg border p-4 ${
                summary.remaining_balance >= 0
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <p className="text-xs font-semibold">Balance</p>
              <p
                className={`text-2xl font-black mt-2 ${
                  summary.remaining_balance >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                Rs. {summary.remaining_balance.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleAddAdvance}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 px-4 rounded-lg transition"
            >
              ➕ Add Advance
            </button>

            <button
              onClick={handleAddPayment}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition"
            >
              💳 Record Payment
            </button>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              Salary Breakdown
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-600">Base Salary:</span>
                <span className="font-semibold">
                  Rs. {summary.total_salary.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between border-t pt-3">
                <span className="text-slate-600">Paid:</span>
                <span className="font-semibold text-blue-600">
                  -Rs. {summary.total_paid.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Advances:</span>
                <span className="font-semibold text-amber-600">
                  -Rs. {summary.total_advance.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between border-t pt-3 text-lg">
                <span className="font-bold">Remaining:</span>
                <span
                  className={`font-black ${
                    summary.remaining_balance >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  Rs. {summary.remaining_balance.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-lg p-6 text-center text-slate-600">
          Select a staff member to view salary details
        </div>
      )}
    </div>
  );
}
