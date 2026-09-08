"use client";

import { useCallback, useEffect, useState } from "react";
import { createIdempotencyKeyRegistry } from "@/app/admin/factory/_components/idempotency-key";
import { money } from "@/lib/format-money";
import BikramMonthPicker from "@/components/admin/BikramMonthPicker";
import StatTile from "@/components/admin/StatTile";
import {
  normalisePayrollRow,
  payrollTotals,
  sortPayroll,
  type FactoryPayrollRow,
} from "@/lib/factory-board";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * The payroll screen.
 *
 * The server hands over the month's payroll as it already stands, so the
 * numbers are on screen at first paint instead of after a rebuild.
 *
 * The rebuild still runs on arrival and on every change of month — a draft
 * summary is a derived snapshot, and work entered since the last visit would
 * otherwise show a stale total that looks perfectly plausible. What changed is
 * that it no longer runs *instead of* showing the month.
 *
 * It remains a write per worker, which is the real cost: at the two to five
 * hundred people this factory is built for, that is hundreds of serial
 * transactions. Fixing it properly means one set-based recompute for the whole
 * month, which is a change to the API, not to this screen.
 */
export default function PayrollReport({
  initialMonth,
  initialSummaries,
}: {
  initialMonth: string;
  initialSummaries: FactoryPayrollRow[];
}) {
  const { text } = useLanguage();
  const [summaries, setSummaries] = useState<FactoryPayrollRow[]>(initialSummaries);
  // The Bikram Sambat month, because that is the month wages are agreed in.
  // nepalMonthKey() gave the English month in Nepal's timezone, which is a
  // different thing and was never the one being asked about.
  const [month, setMonth] = useState(initialMonth);
  // A rebuild running behind a table that is already showing the month.
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKeys] = useState(() => createIdempotencyKeyRegistry());

  const generateSummaries = useCallback(async (
    selectedMonth: string,
    // Answers "is this rebuild still the one being waited for?" — a month
    // switched away from must not publish its result over the new one.
    isCurrent: () => boolean = () => true,
  ) => {
    setError(null);
    try {
      const workersRes = await fetch("/api/factory/workers");
      if (!workersRes.ok) throw new Error("Could not load piece-rate workers.");
      const workersData = await workersRes.json();
      const workers = (workersData.workers || []).filter(
        (worker: { worker_type?: string }) => worker.worker_type === "piece_rate",
      );

      const newSummaries: FactoryPayrollRow[] = [];
      for (const worker of workers) {
        const keyScope = `monthly-summary:${selectedMonth}:${worker.id}`;
        const res = await fetch("/api/factory/monthly-summary", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKeys.get(keyScope),
          },
          body: JSON.stringify({
            bsMonth: selectedMonth,
            worker_id: worker.id,
          }),
        });

        if (!res.ok) {
          throw new Error(`Could not calculate the report for ${worker.name}.`);
        }
        const data = await res.json();
        idempotencyKeys.rotate(keyScope);
        newSummaries.push(
          normalisePayrollRow({
            ...data,
            worker_name: worker.name,
            category: worker.category,
          }),
        );
      }

      // Publish only a complete worker set. A failed worker must never leave a
      // deceptively low partial payroll total on screen.
      if (isCurrent()) {
        setSummaries(newSummaries);
      }
      return true;
    } catch (error) {
      console.error("Error generating summaries:", error);
      setError(error instanceof Error ? error.message : "Could not generate reports.");
      return false;
    }
  }, [idempotencyKeys]);

  useEffect(() => {
    // Draft summaries are derived snapshots, so they are rebuilt on arrival:
    // work entered or paid since the last visit would otherwise show a stale
    // total that looks perfectly plausible.
    //
    // What changed is that the screen no longer empties itself first. The
    // server handed over the stored payroll, so the month is readable while
    // the rebuild runs behind it — and only a completed rebuild replaces it.
    // Blanking the table to rebuild what is already correct is how a wage
    // screen reads as broken on a slow connection.
    let current = true;

    const rebuild = async () => {
      setIsRebuilding(true);
      try {
        await generateSummaries(month, () => current);
      } catch (error) {
        console.error("Error loading summaries:", error);
        setError(error instanceof Error ? error.message : "Could not load reports.");
      } finally {
        if (current) setIsRebuilding(false);
      }
    };

    rebuild();

    // A month switched away from must not have its rebuild land on the new one.
    return () => {
      current = false;
    };
  }, [generateSummaries, month]);

  // Wages are money, and NUMERIC columns reach the browser as strings; both
  // are settled in lib/factory-board, which is tested. Sorted there too, on a
  // copy — sorting this list in place would reorder what React renders from.
  const payroll = sortPayroll(summaries.map(normalisePayrollRow));
  const totals = payrollTotals(payroll);
  const { totalPairs, totalEarned, totalPaid, totalBalance } = totals;

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-8">
        <h1 className="font-display text-2xl sm:text-3xl font-black text-brand-green-ink">{text("Monthly reports", "मासिक रिपोर्ट")}</h1>
        <p className="mb-4 mt-1 text-sm text-brand-muted">
          {text(
            "What each team member made this month, what they were paid, and what is still owed.",
            "यो महिना कसले कति बनायो, कति पायो, कति बाँकी छ।",
          )}
        </p>

        <div className="flex gap-3 mb-6">
          <BikramMonthPicker value={month} onChange={setMonth} label={text("Month", "महिना")} className="min-w-[180px]" />
          <button
            onClick={() => generateSummaries(month)}
            disabled={isRebuilding}
            className="bg-brand-green hover:bg-brand-green-ink text-white font-semibold py-3 px-4 rounded-lg transition-colors min-h-12 disabled:cursor-not-allowed disabled:opacity-60"
          >
            🔄 {isRebuilding ? text("Recalculating…", "गणना हुँदै…") : text("Regenerate", "फेरि गणना")}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          {error} {text("No partial report was shown.", "अधुरो रिपोर्ट देखाइएन।")}
        </div>
      )}

      {isRebuilding ? (
        <p className="mb-4 text-sm font-semibold text-brand-muted">
          {text(
            "Recalculating this month behind the figures below…",
            "तलका अङ्कहरू पछाडि यो महिना फेरि गणना हुँदै…",
          )}
        </p>
      ) : null}

      <div className="space-y-6">
          {/* Monthly Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <StatTile label={text("Total pairs", "जम्मा जोडी")} value={totalPairs} />
            <StatTile
              label={text("Total earned", "जम्मा कमाएको")}
              value={money(totalEarned)}
              tone="good"
            />
            <StatTile
              label={text("Total paid", "जम्मा तिरेको")}
              value={money(totalPaid)}
            />
            <StatTile
              label={text("Balance due", "तिर्न बाँकी")}
              value={money(totalBalance)}
              tone={totalBalance > 0 ? "warn" : "good"}
            />
          </div>

          {/* Payroll Table */}
          <div className="bg-brand-paper rounded-lg border border-brand-green-line overflow-x-auto">
            <div className="p-4 sm:p-6">
              <h2 className="text-lg font-bold text-brand-green-ink mb-4">💰 {text("Payroll summary", "ज्यालाको हिसाब")}</h2>
              <table className="reflow-table w-full text-sm">
                <thead className="border-b border-brand-green-line">
                  <tr className="text-xs sm:text-sm text-brand-muted font-semibold">
                    <th className="text-left py-2 px-2 sm:px-4">{text("Team member", "टोली सदस्य")}</th>
                    <th className="text-left py-2 px-2 sm:px-4">{text("Category", "किसिम")}</th>
                    <th className="text-center py-2 px-2 sm:px-4">{text("Pairs", "जोडी")}</th>
                    <th className="text-right py-2 px-2 sm:px-4">{text("Earned", "कमाएको")}</th>
                    <th className="text-right py-2 px-2 sm:px-4">{text("Paid", "तिरेको")}</th>
                    <th className="text-right py-2 px-2 sm:px-4">{text("Due", "बाँकी")}</th>
                  </tr>
                </thead>
                <tbody>
                  {payroll.length > 0 ? (
                    payroll.map((summary, idx) => (
                        <tr key={idx} className="border-b border-brand-green-line hover:bg-brand-paper-deep">
                          <td className="reflow-primary py-3 px-2 sm:px-4 font-medium text-brand-green-ink">
                            {summary.worker_name}
                          </td>
                          <td data-label={text("Category", "किसिम")} className="py-3 px-2 sm:px-4 text-brand-muted">
                            {summary.category}
                          </td>
                          <td data-label={text("Pairs", "जोडी")} className="py-3 px-2 sm:px-4 text-center text-brand-green-ink">
                            {summary.total_pairs}
                          </td>
                          <td data-label={text("Earned", "कमाएको")} className="py-3 px-2 sm:px-4 text-right text-green-600 font-semibold">
                            Rs. {summary.total_earned.toLocaleString()}
                          </td>
                          <td data-label={text("Paid", "तिरेको")} className="py-3 px-2 sm:px-4 text-right text-purple-600 font-semibold">
                            Rs. {summary.total_paid.toLocaleString()}
                          </td>
                          <td data-label={text("Due", "बाँकी")} className="py-3 px-2 sm:px-4 text-right font-bold">
                            <span
                              className={`${
                                summary.final_balance > 0
                                  ? "text-amber-600"
                                  : "text-brand-muted"
                              }`}
                            >
                              Rs. {summary.final_balance.toLocaleString()}
                            </span>
                          </td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-brand-muted">
                        {text("No work recorded this month", "यो महिना कुनै काम टिपिएको छैन")}
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
                  ...payroll.map((s) => [
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
              className="flex-1 bg-brand-muted-deep hover:bg-brand-green-ink text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              📥 {text("Export CSV", "CSV निकाल्ने")}
            </button>
            <button
              onClick={() => window.print()}
              className="flex-1 bg-brand-muted-deep hover:bg-brand-green-ink text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              🖨️ {text("Print report", "रिपोर्ट छाप्ने")}
            </button>
          </div>
        </div>
    </div>
  );
}
