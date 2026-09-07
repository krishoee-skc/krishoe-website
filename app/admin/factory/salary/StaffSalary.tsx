"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { useSearchParams } from "next/navigation";
import { createIdempotencyKeyRegistry } from "@/app/admin/factory/_components/idempotency-key";
import {
  nepalDateKey,
} from "@/app/admin/factory/_components/nepal-date";
import BikramMonthPicker from "@/components/admin/BikramMonthPicker";
import StatTile from "@/components/admin/StatTile";
import NepaliDateField from "@/components/admin/NepaliDateField";
import { bikramMonthKeyOf, toBikramSambatNumeric } from "@/lib/bikram-sambat";

import type { FactoryWorker as StaffWorker } from "@/lib/factory-board";

interface SalarySummary {
  worker_id: string;
  month: string;
  total_salary: number;
  total_paid: number;
  total_advance: number;
  remaining_balance: number;
}

/**
 * The staff salary screen.
 *
 * The server hands over the monthly-salaried staff, so the picker is filled on
 * arrival. The month's figures still load per person, since they only mean
 * anything once someone is chosen.
 */
export default function StaffSalary({ initialWorkers }: { initialWorkers: StaffWorker[] }) {
  const searchParams = useSearchParams();
  const requestedWorkerId = searchParams.get("workerId");
  const { text } = useLanguage();
  const [workers] = useState<StaffWorker[]>(initialWorkers);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>(() => {
    // A link may name someone; otherwise start with the first on the list.
    if (initialWorkers.some((worker) => worker.id === requestedWorkerId)) {
      return requestedWorkerId ?? "";
    }
    return initialWorkers[0]?.id ?? "";
  });
  // The Bikram Sambat month, because that is the month wages are agreed in.
  // nepalMonthKey() gave the English month in Nepal's timezone, which is a
  // different thing and was never the one being asked about.
  const [month, setMonth] = useState(() => bikramMonthKeyOf(new Date()));
  const [summary, setSummary] = useState<SalarySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [transactionType, setTransactionType] = useState<"advance" | "payment">("advance");
  const [transactionAmount, setTransactionAmount] = useState("");
  const [transactionDate, setTransactionDate] = useState(() => nepalDateKey());
  const [transactionNote, setTransactionNote] = useState("");
  const [transactionSaving, setTransactionSaving] = useState(false);
  const [idempotencyKeys] = useState(() => createIdempotencyKeyRegistry());

  // Load salary summary
  useEffect(() => {
    if (!selectedWorkerId) return;

    const loadSummary = async () => {
      try {
        setError(null);
        const res = await fetch(
          `/api/factory/salary?workerId=${selectedWorkerId}&bsMonth=${month}`
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

  const handleTransaction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedWorkerId || !summary) return;

    const numericAmount = Number(transactionAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter a valid positive amount.");
      return;
    }
    const keyScope = `salary-${transactionType}:${selectedWorkerId}:${month}:${transactionDate}:${numericAmount.toFixed(2)}`;

    try {
      setTransactionSaving(true);
      setError(null);
      setSuccess(null);
      const res = await fetch(
        transactionType === "advance" ? "/api/factory/salary-advance" : "/api/factory/salary-payment",
        {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKeys.get(keyScope),
        },
        body: JSON.stringify({
          worker_id: selectedWorkerId,
          amount: numericAmount,
          date: transactionDate,
          period_month: month,
          notes: transactionNote.trim() || (transactionType === "advance" ? "Owner-approved staff advance" : "Owner-approved salary payment"),
        }),
      });

      const response = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(response.error || "Transaction could not be recorded.");

      idempotencyKeys.rotate(keyScope);
      const summaryRes = await fetch(`/api/factory/salary?workerId=${selectedWorkerId}&month=${month}`);
      if (!summaryRes.ok) throw new Error("Transaction saved, but the refreshed salary summary could not load.");
      setSummary(await summaryRes.json());
      setTransactionAmount("");
      setTransactionNote("");
      setSuccess(`${transactionType === "advance" ? "Advance" : "Salary payment"} of Rs. ${numericAmount.toLocaleString()} recorded.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction could not be recorded.");
    } finally {
      setTransactionSaving(false);
    }
  };

  return (
    <div className="p-6">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-gold-deep">
        {text("Monthly payroll", "मासिक तलब")}
      </p>
      <h1 className="mt-2 font-display text-3xl font-black text-brand-green-ink mb-2">
        {text("Staff salary, advance and payment", "तलब, पेश्की र भुक्तानी")}
      </h1>

      <p className="mb-6 text-sm text-brand-muted">
        Monthly factory staff are managed here. Daily staff attendance, wages,
        deductions, and payroll remain in the HR section.
      </p>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}
      {success ? <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-800">{success}</div> : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-semibold text-brand-green-ink mb-2">
            {text("Select staff member", "कर्मचारी छान्नुहोस्")}
          </label>
          <select
            id="salary-staff"
            value={selectedWorkerId}
            onChange={(e) => setSelectedWorkerId(e.target.value)}
            className="w-full px-4 py-2 border border-brand-green-line rounded-lg"
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
          <BikramMonthPicker value={month} onChange={setMonth} label={text("Month", "महिना")} />
        </div>
      </div>

      {summary ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatTile
              label={text("Monthly salary", "मासिक तलब")}
              value={`Rs. ${summary.total_salary.toLocaleString()}`}
            />
            <StatTile
              label={text("Total paid", "जम्मा तिरेको")}
              value={`Rs. ${summary.total_paid.toLocaleString()}`}
              tone="good"
            />
            <StatTile
              label={text("Total advance", "पेस्की")}
              value={`Rs. ${summary.total_advance.toLocaleString()}`}
              tone="warn"
            />
            {/* A balance below zero means more has gone out than the month
                earned — the one number here that wants a red edge. */}
            <StatTile
              label={text("Balance", "बाँकी")}
              value={`Rs. ${summary.remaining_balance.toLocaleString()}`}
              tone={summary.remaining_balance >= 0 ? "good" : "danger"}
            />
          </div>

          <form onSubmit={handleTransaction} className="rounded-2xl border border-brand-green/20 bg-brand-mist p-4 sm:p-6">
            <div>
              <h2 className="text-lg font-black text-brand-green-ink">
                {text("Record cash transaction", "पैसाको लेनदेन टिप्ने")}
              </h2>
              <p className="mt-1 text-sm leading-6 text-brand-muted">Advance and salary payment are stored separately and both reduce the remaining salary balance for the selected month.</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-bold text-brand-green-ink">Transaction type
                <select value={transactionType} onChange={(event) => setTransactionType(event.target.value as "advance" | "payment")} className="min-h-12 rounded-lg border border-brand-green-line bg-brand-paper px-3">
                  <option value="advance">{text("Saturday kharcha / advance", "शनिबारको खर्च / पेश्की")}</option>
                  <option value="payment">{text("Salary payment", "तलब भुक्तानी")}</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm font-bold text-brand-green-ink">Date
                <NepaliDateField value={transactionDate} onChange={setTransactionDate} required />
                {/* The picker chooses in the English calendar, but the owner
                    reads the day in Bikram Sambat (2083/05/19) right below it, so
                    the date they record is the one they think in. */}
                {transactionDate ? (
                  <span className="text-xs font-semibold text-brand-green">
                    {text("Nepali date", "नेपाली मिति")}: {toBikramSambatNumeric(transactionDate)}
                  </span>
                ) : null}
              </label>
              <label className="grid gap-1 text-sm font-bold text-brand-green-ink">Amount (Rs.)
                <input type="number" min="0.01" step="0.01" value={transactionAmount} onChange={(event) => setTransactionAmount(event.target.value)} required className="min-h-12 rounded-lg border border-brand-green-line bg-brand-paper px-3" placeholder={text("Cash amount", "कति रुपैयाँ")} />
              </label>
              <label className="grid gap-1 text-sm font-bold text-brand-green-ink">Owner note
                <input value={transactionNote} onChange={(event) => setTransactionNote(event.target.value)} className="min-h-12 rounded-lg border border-brand-green-line bg-brand-paper px-3" placeholder={text("Optional reason or reference", "किन दिइयो — नलेखे पनि हुन्छ")} />
              </label>
            </div>
            <button type="submit" disabled={transactionSaving || !selectedWorkerId} className="mt-4 min-h-12 w-full rounded-xl bg-brand-green px-4 font-black text-white disabled:opacity-60">
              {transactionSaving ? "Saving..." : transactionType === "advance" ? "Record advance" : "Record salary payment"}
            </button>
          </form>

          <div className="bg-brand-paper rounded-lg border border-brand-green-line p-6">
            <h2 className="text-lg font-bold text-brand-green-ink mb-4">
              Salary Breakdown
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-brand-muted">{text("Base salary", "तय भएको तलब")}:</span>
                <span className="font-semibold">
                  Rs. {summary.total_salary.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between border-t pt-3">
                <span className="text-brand-muted">{text("Paid", "तिरेको")}:</span>
                <span className="font-semibold text-brand-green">
                  -Rs. {summary.total_paid.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-muted">Advances:</span>
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
        <div className="bg-brand-paper-deep rounded-lg p-6 text-center text-brand-muted">
          Select a staff member to view salary details
        </div>
      )}
    </div>
  );
}
