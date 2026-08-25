"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createIdempotencyKeyRegistry } from "@/app/admin/factory/_components/idempotency-key";
import {
  nepalDateKey,
} from "@/app/admin/factory/_components/nepal-date";
import BikramMonthPicker from "@/components/admin/BikramMonthPicker";
import { bikramMonthKeyOf } from "@/lib/bikram-sambat";
import { DateDisplayAdmin } from "@/components/DateDisplay";

interface WorkerLedger {
  id: string;
  date: string;
  entry_type: string;
  work_pairs: number;
  amount_earned: number;
  payment_given: number;
  running_balance: number;
  status: string;
  notes: string | null;
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
  // The Bikram Sambat month, because that is the month wages are agreed in.
  // nepalMonthKey() gave the English month in Nepal's timezone, which is a
  // different thing and was never the one being asked about.
  const [month, setMonth] = useState(() => bikramMonthKeyOf(new Date()));
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => nepalDateKey());
  const [paymentKind, setPaymentKind] = useState("Saturday kharcha / advance");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
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
          `/api/factory/ledger?workerId=${selectedWorkerId}&bsMonth=${month}`,
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

  const handleRecordPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedWorkerId || !ledgerData) return;

    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid positive payment amount.");
      return;
    }
    const keyScope = `payment:${selectedWorkerId}:${paymentDate}:${amount.toFixed(2)}:${paymentKind}`;

    try {
      setPaymentSaving(true);
      setError(null);
      setSuccess(null);
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
          payment_kind: paymentKind,
          notes: `${paymentKind}${paymentNote.trim() ? ` · ${paymentNote.trim()}` : ""}`,
        }),
      });

      const response = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(response.error || "Payment could not be recorded.");

      idempotencyKeys.rotate(keyScope);
      const reloadRes = await fetch(`/api/factory/ledger?workerId=${selectedWorkerId}&month=${month}`);
      if (!reloadRes.ok) throw new Error("Payment saved, but the refreshed ledger could not load.");
      setLedgerData(await reloadRes.json());
      setPaymentAmount("");
      setSuccess(
        response.production_payment_synced
          ? "Cash payment saved. Production Accounts synchronized."
          : `Cash payment saved. ${
              response.production_payment_sync_reason ||
              "Link this Factory worker to HR to synchronize Production Accounts."
            }`,
      );
      setPaymentNote("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Payment could not be recorded.");
    } finally {
      setPaymentSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-gold-deep">ज्यालाको हिसाब</p>
      <h1 className="mt-2 text-2xl sm:text-3xl font-black text-brand-green-ink mb-2">
        कामदारको खाता <span className="text-lg font-bold text-brand-muted">· Work and payment ledger</span>
      </h1>
      <p className="mb-6 text-sm leading-6 text-brand-muted">Completed work adds earned wages. Saturday kharcha, advance or final wage payment reduces the balance and remains in the same statement.</p>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">{error}</p>
          <p className="text-red-700 text-sm mt-1">
            Database may be temporarily unavailable. Try refreshing the page.
          </p>
        </div>
      )}
      {success ? <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-800">{success}</div> : null}

      {/* Worker Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-brand-green-ink mb-2">Select Worker</label>
          <select
            value={selectedWorkerId}
            onChange={(e) => setSelectedWorkerId(e.target.value)}
            className="w-full min-h-12 px-3 py-2 border border-brand-green-line rounded-lg"
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
          <BikramMonthPicker value={month} onChange={setMonth} label="महिना" />
        </div>
      </div>

      {loading ? (
        <div className="text-center text-brand-muted">Loading ledger...</div>
      ) : ledgerData ? (
        <div className="space-y-6">
          {/* Worker Info */}
          <div className="bg-brand-paper rounded-lg border border-brand-green-line p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-brand-green-ink mb-4">
              {ledgerData.worker.name}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <div className="text-xs sm:text-sm text-brand-muted">Type</div>
                <div className="font-semibold text-brand-green-ink capitalize">
                  {ledgerData.worker.worker_type.replace("_", " ")}
                </div>
              </div>
              <div>
                <div className="text-xs sm:text-sm text-brand-muted">Category</div>
                <div className="font-semibold text-brand-green-ink">{ledgerData.worker.category}</div>
              </div>
              {ledgerData.worker.monthly_salary && (
                <div>
                  <div className="text-xs sm:text-sm text-brand-muted">Monthly Salary</div>
                  <div className="font-semibold text-brand-green-ink">
                    Rs. {ledgerData.worker.monthly_salary.toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-brand-paper rounded-lg p-4 sm:p-6 border border-brand-green-line">
              <div className="text-xs sm:text-sm text-brand-muted">Total Pairs</div>
              <div className="text-2xl sm:text-3xl font-bold text-brand-green mt-2">
                {ledgerData.summary.totalPairs}
              </div>
            </div>

            <div className="bg-brand-paper rounded-lg p-4 sm:p-6 border border-brand-green-line">
              <div className="text-xs sm:text-sm text-brand-muted">Total Earned</div>
              <div className="text-2xl sm:text-3xl font-bold text-green-600 mt-2">
                Rs. {ledgerData.summary.totalEarned.toLocaleString()}
              </div>
            </div>

            <div className="bg-brand-paper rounded-lg p-4 sm:p-6 border border-brand-green-line">
              <div className="text-xs sm:text-sm text-brand-muted">Total Paid</div>
              <div className="text-2xl sm:text-3xl font-bold text-purple-600 mt-2">
                Rs. {ledgerData.summary.totalPaid.toLocaleString()}
              </div>
            </div>

            <div className="bg-brand-paper rounded-lg p-4 sm:p-6 border border-brand-green-line">
              <div className="text-xs sm:text-sm text-brand-muted">Current Balance</div>
              <div className="text-2xl sm:text-3xl font-bold text-amber-600 mt-2">
                Rs. {ledgerData.summary.currentBalance.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Ledger Entries */}
          <div className="bg-brand-paper rounded-lg border border-brand-green-line overflow-x-auto">
            <div className="p-4 sm:p-6">
              <h3 className="text-lg font-bold text-brand-green-ink mb-4">Ledger Entries</h3>
              <table className="w-full text-sm">
                <thead className="border-b border-brand-green-line">
                  <tr className="text-xs sm:text-sm text-brand-muted font-semibold">
                    <th className="text-left py-2 px-2 sm:px-4">Date</th>
                    <th className="text-left py-2 px-2 sm:px-4">Type</th>
                    <th className="text-right py-2 px-2 sm:px-4">Pairs</th>
                    <th className="text-right py-2 px-2 sm:px-4">Earned</th>
                    <th className="text-right py-2 px-2 sm:px-4">Paid</th>
                    <th className="text-right py-2 px-2 sm:px-4">Balance</th>
                    <th className="text-left py-2 px-2 sm:px-4">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerData.ledger.length > 0 ? (
                    ledgerData.ledger.map((entry, idx) => (
                      <tr key={idx} className="border-b border-brand-green-line hover:bg-brand-paper-deep">
                        <td className="py-3 px-2 sm:px-4 text-brand-green-ink">
                          <DateDisplayAdmin date={entry.date} />
                        </td>
                        <td className="py-3 px-2 sm:px-4">
                          <span className="text-xs sm:text-sm capitalize bg-brand-mist px-2 py-1 rounded">
                            {entry.entry_type}
                          </span>
                        </td>
                        <td className="py-3 px-2 sm:px-4 text-right text-brand-green-ink">
                          {entry.work_pairs || "-"}
                        </td>
                        <td className="py-3 px-2 sm:px-4 text-right text-green-600 font-medium">
                          {entry.amount_earned ? `+${entry.amount_earned}` : "-"}
                        </td>
                        <td className="py-3 px-2 sm:px-4 text-right text-red-600 font-medium">
                          {entry.payment_given ? `-${entry.payment_given}` : "-"}
                        </td>
                        <td className="py-3 px-2 sm:px-4 text-right font-semibold text-brand-green-ink">
                          Rs. {entry.running_balance.toLocaleString()}
                        </td>
                        <td className="min-w-48 py-3 px-2 sm:px-4 text-xs text-brand-muted">{entry.notes || "-"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-brand-muted">
                        No ledger entries for this month
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <form onSubmit={handleRecordPayment} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-emerald-950">Record worker payment</h3>
                <p className="mt-1 text-sm leading-6 text-emerald-800">Payment may be the full balance, fixed Saturday kharcha, or an advance. If payment is more than earned balance, the negative balance is recovered from future work.</p>
              </div>
              <button type="button" onClick={() => setPaymentAmount(Math.max(0, ledgerData.summary.currentBalance).toString())} className="rounded-full border border-emerald-700 bg-brand-paper px-3 py-2 text-xs font-black text-emerald-800">Use current balance</button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-bold text-brand-green-ink">Payment type
                <select value={paymentKind} onChange={(event) => setPaymentKind(event.target.value)} className="min-h-12 rounded-lg border border-brand-green-line bg-brand-paper px-3">
                  <option>Saturday kharcha / advance</option>
                  <option>Weekly wage payment</option>
                  <option>Final wage settlement</option>
                  <option>Other Owner-approved payment</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm font-bold text-brand-green-ink">Payment date
                <input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} required className="min-h-12 rounded-lg border border-brand-green-line bg-brand-paper px-3" />
              </label>
              <label className="grid gap-1 text-sm font-bold text-brand-green-ink">Amount (Rs.)
                <input type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} required className="min-h-12 rounded-lg border border-brand-green-line bg-brand-paper px-3" placeholder="Payment amount" />
              </label>
              <label className="grid gap-1 text-sm font-bold text-brand-green-ink">Owner note
                <input value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} className="min-h-12 rounded-lg border border-brand-green-line bg-brand-paper px-3" placeholder="Optional reason or reference" />
              </label>
            </div>
            <button type="submit" disabled={paymentSaving || !selectedWorkerId} className="mt-4 min-h-12 w-full rounded-xl bg-emerald-700 px-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-60">
              {paymentSaving ? "Saving payment..." : "Record cash payment"}
            </button>
          </form>
        </div>
      ) : (
        <div className="text-center text-brand-muted">Select a worker to view ledger</div>
      )}
    </div>
  );
}
