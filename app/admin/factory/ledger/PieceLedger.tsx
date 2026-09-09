"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { useToast } from "@/components/admin/ToastProvider";
import { money } from "@/lib/format-money";
import { useSearchParams } from "next/navigation";
import { createIdempotencyKeyRegistry } from "@/app/admin/factory/_components/idempotency-key";
import {
  nepalDateKey,
} from "@/app/admin/factory/_components/nepal-date";
import BikramMonthPicker from "@/components/admin/BikramMonthPicker";
import StatTile from "@/components/admin/StatTile";
import NepaliDateField from "@/components/admin/NepaliDateField";
import { bikramMonthKeyOf, toBikramSambatNumeric } from "@/lib/bikram-sambat";
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
  /** Which shoe this wage was for, read through the work row. Null on a
   *  payment, and on work saved before that link existed. */
  item_name: string | null;
  color: string | null;
  size: string | null;
  rate_applied: number | string | null;
  reject_pairs: number | null;
}

// One shape for a person on the books, defined where they are read.
import type { FactoryWorker as Worker } from "@/lib/factory-board";

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

/**
 * A team member's piece-wage ledger for one month.
 *
 * The server hands over the piece-rate team, so the name picker is filled on
 * arrival rather than after a round trip. Choosing a person or a month still
 * fetches that ledger — it is a different read each time, and there is nothing
 * to prefetch for a person nobody has picked yet.
 */
export default function PieceLedger({ initialWorkers }: { initialWorkers: Worker[] }) {
  const searchParams = useSearchParams();
  const workerId = searchParams.get("workerId");

  const { text } = useLanguage();
  const toast = useToast();

  const workers = initialWorkers;
  // A staff link belongs on the Salary screen, not this piece-wage ledger, so a
  // workerId that names nobody here falls back to the first of the team.
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>(() =>
    workerId && initialWorkers.some((worker) => worker.id === workerId)
      ? workerId
      : initialWorkers[0]?.id || "",
  );
  const [ledgerData, setLedgerData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(false);
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
      toast.show(
        response.production_payment_synced
          ? text("Payment saved, and the production accounts agree.", "भुक्तानी टिपियो, उत्पादन खातासँग पनि मिल्यो।")
          : text("Payment saved.", "भुक्तानी टिपियो।"),
        "success",
      );
      setSuccess(
        response.production_payment_synced
          ? null
          : response.production_payment_sync_reason ||
            text(
              "Link this worker to HR to keep the production accounts in step.",
              "उत्पादन खाता मिलिरहोस् भन्नाका लागि यो कामदारलाई HR सँग जोड्नुहोस्।",
            ),
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
      <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-gold-deep">
        {text("Piece-rate wages", "ज्यालाको हिसाब")}
      </p>
      <h1 className="mt-2 font-display text-2xl sm:text-3xl font-black text-brand-green-ink mb-2">
        {text("Work and payment ledger", "कामदारको खाता")}
      </h1>
      <p className="mb-6 text-sm leading-6 text-brand-muted">
        {text(
          "Completed work adds earned wages. Saturday kharcha, advance or final wage payment reduces the balance and remains in the same statement.",
          "काम सकिँदा ज्याला थपिन्छ। शनिबारको खर्च, पेश्की वा तलब दिँदा घट्छ — सबै यही एउटै हिसाबमा देखिन्छ।",
        )}
      </p>

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
          <label htmlFor="ledger-worker" className="block text-sm font-medium text-brand-green-ink mb-2">{text("Select worker", "कामदार छान्नुहोस्")}</label>
          <select
            id="ledger-worker"
            value={selectedWorkerId}
            onChange={(e) => setSelectedWorkerId(e.target.value)}
            className="w-full min-h-12 px-3 py-2 border border-brand-green-line rounded-lg"
          >
            <option value="">{text("Select a worker…", "कामदार छान्नुहोस्…")}</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.category})
              </option>
            ))}
          </select>
        </div>

        <div>
          <BikramMonthPicker value={month} onChange={setMonth} label={text("Month", "महिना")} />
        </div>
      </div>

      {loading ? (
        <div className="text-center text-brand-muted">{text("Loading ledger…", "खाता खुल्दैछ…")}</div>
      ) : ledgerData ? (
        <div className="space-y-6">
          {/* Whose account this is.
              The name used to sit at text-lg above figures set in text-2xl, so
              the biggest thing on a page about one person was a number, and the
              owner had to look for the name to be sure whose wages they were
              about to pay. It leads now, and says what it is. */}
          <div className="rounded-lg border-2 border-brand-gold/50 bg-brand-gold/10 p-4 sm:p-6">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-gold-deep">
              {text("Account of", "यो खाता कसको")}
            </p>
            <h2 className="mt-1 font-display text-2xl font-black leading-tight text-brand-green-ink sm:text-3xl">
              {ledgerData.worker.name}
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <div className="text-xs sm:text-sm text-brand-muted">{text("Type", "किसिम")}</div>
                <div className="font-semibold text-brand-green-ink capitalize">
                  {ledgerData.worker.worker_type.replace("_", " ")}
                </div>
              </div>
              <div>
                <div className="text-xs sm:text-sm text-brand-muted">{text("Category", "कुन चरण")}</div>
                <div className="font-semibold text-brand-green-ink">{ledgerData.worker.category}</div>
              </div>
              {ledgerData.worker.monthly_salary && (
                <div>
                  <div className="text-xs sm:text-sm text-brand-muted">{text("Monthly salary", "मासिक तलब")}</div>
                  <div className="font-semibold text-brand-green-ink">
                    Rs. {ledgerData.worker.monthly_salary.toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <StatTile label={text("Total pairs", "जम्मा जोडी")} value={ledgerData.summary.totalPairs} />
            <StatTile
              label={text("Total earned", "जम्मा कमाएको")}
              value={money(ledgerData.summary.totalEarned)}
              tone="good"
            />
            <StatTile
              label={text("Total paid", "जम्मा पाएको")}
              value={money(ledgerData.summary.totalPaid)}
            />
            {/* Owing a worker mid-week is the ordinary state, not a
                warning — the week's work is cleared on Saturday. Nil is
                settled; a negative balance means the worker was paid ahead of
                their work, which is the one worth marking. */}
            <StatTile
              label={text("Current balance", "अहिलेको बाँकी")}
              value={money(ledgerData.summary.currentBalance)}
              detail={
                ledgerData.summary.currentBalance > 0
                  ? text("to pay on Saturday", "शनिबार दिनुपर्ने")
                  : ledgerData.summary.currentBalance < 0
                    ? text("paid ahead — recover from future work", "बढी दिइएको — पछिको कामबाट कट्ने")
                    : text("settled", "चुक्ता")
              }
              tone={
                ledgerData.summary.currentBalance < 0
                  ? "warn"
                  : ledgerData.summary.currentBalance === 0
                    ? "good"
                    : "default"
              }
            />
          </div>

          {/* Ledger Entries */}
          <div className="bg-brand-paper rounded-lg border border-brand-green-line overflow-x-auto">
            <div className="p-4 sm:p-6">
              <h3 className="text-lg font-bold text-brand-green-ink mb-4">{text("Ledger entries", "खाताका हिसाब")}</h3>
              <table className="reflow-table w-full text-sm">
                <thead className="border-b border-brand-green-line">
                  <tr className="text-xs sm:text-sm text-brand-muted font-semibold">
                    <th className="text-left py-2 px-2 sm:px-4">{text("Date", "मिति")}</th>
                    <th className="text-left py-2 px-2 sm:px-4">{text("Type", "के भयो")}</th>
                    <th className="text-left py-2 px-2 sm:px-4">{text("Item", "के बनायो")}</th>
                    <th className="text-right py-2 px-2 sm:px-4">{text("Pairs", "जोडी")}</th>
                    <th className="text-right py-2 px-2 sm:px-4">{text("Amount", "रकम")}</th>
                    <th className="text-right py-2 px-2 sm:px-4">{text("Balance", "बाँकी")}</th>
                    <th className="text-left py-2 px-2 sm:px-4">{text("Note", "टिपोट")}</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerData.ledger.length > 0 ? (
                    ledgerData.ledger.map((entry, idx) => (
                      <tr
                        key={idx}
                        className={`border-b border-brand-green-line hover:bg-brand-paper-deep ${
                          entry.status === "reversed" ? "opacity-70" : ""
                        }`}
                      >
                        <td className="reflow-primary py-3 px-2 sm:px-4 text-brand-green-ink">
                          <DateDisplayAdmin date={entry.date} />
                        </td>
                        <td data-label={text("Type", "के भयो")} className="py-3 px-2 sm:px-4">
                          <span className="text-xs sm:text-sm capitalize bg-brand-mist px-2 py-1 rounded">
                            {entry.entry_type}
                          </span>
                          {/* Two identical Rs. 9,720 payments sat here, one of
                              them reversed, told apart only by a sentence at
                              the end of a note column. */}
                          {entry.status === "reversed" ? (
                            <span className="ms-1.5 inline-block rounded bg-brand-clay-tint px-2 py-1 text-xs font-black text-brand-clay">
                              {text("reversed", "फिर्ता")}
                            </span>
                          ) : null}
                        </td>
                        <td
                          data-label={text("Item", "के बनायो")}
                          className={`py-3 px-2 sm:px-4 text-brand-green-ink ${
                            entry.item_name ? "" : "reflow-blank"
                          }`}
                        >
                          {/* One wrapper, so the phone card lays the label
                              against a single block rather than against each
                              line in turn. */}
                          <span className="block min-w-0 text-right sm:text-left">
                            {entry.item_name ? (
                              <>
                                <span className="block break-words font-bold">{entry.item_name}</span>
                                {entry.color || entry.size ? (
                                  <span className="mt-0.5 block break-words text-xs text-brand-muted">
                                    {[entry.color, entry.size].filter(Boolean).join(" · ")}
                                  </span>
                                ) : (
                                  <span className="mt-0.5 block text-xs text-brand-muted">
                                    {text("colour and size not entered", "रङ र साइज टिपिएको छैन")}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-brand-muted-soft">—</span>
                            )}
                          </span>
                        </td>
                        <td
                          data-label={text("Pairs", "जोडी")}
                          className={`py-3 px-2 sm:px-4 text-right text-brand-green-ink ${
                            entry.work_pairs ? "" : "reflow-blank"
                          }`}
                        >
                          <span className="block min-w-0">
                            {entry.work_pairs || <span className="text-brand-muted-soft">—</span>}
                            {entry.rate_applied ? (
                              <span className="mt-0.5 block text-xs text-brand-muted">
                                × Rs. {Number(entry.rate_applied)}
                              </span>
                            ) : null}
                            {entry.reject_pairs ? (
                              <span className="mt-0.5 block text-xs font-bold text-brand-clay">
                                {text(`${entry.reject_pairs} reject`, `${entry.reject_pairs} बिग्रेको`)}
                              </span>
                            ) : null}
                          </span>
                        </td>
                        {/* Number(), not the raw value: Postgres returns
                            numeric as a string and "0.00" is truthy, so every
                            work row printed "-0.00" and every payment "+0.00".
                            Empty rather than a dash on a phone, where the
                            reflow gives each cell its own labelled line and an
                            existing rule hides an empty one. */}
                        {/* One column, because no row is ever both: a row has
                            pairs and a wage, or it has cash handed over. Two
                            columns left one of them empty on every row. The
                            sign says which, the way a passbook does. */}
                        <td
                          data-label={text("Amount", "रकम")}
                          className="py-3 px-2 sm:px-4 text-right font-bold"
                        >
                          {Number(entry.payment_given) > 0 ? (
                            <span className={`text-red-600 ${entry.status === "reversed" ? "line-through" : ""}`}>
                              −{Number(entry.payment_given).toLocaleString("en-IN")}
                            </span>
                          ) : Number(entry.amount_earned) > 0 ? (
                            <span className={`text-green-600 ${entry.status === "reversed" ? "line-through" : ""}`}>
                              +{Number(entry.amount_earned).toLocaleString("en-IN")}
                            </span>
                          ) : (
                            <span className="text-brand-muted-soft">—</span>
                          )}
                        </td>
                        <td
                          data-label={text("Balance", "बाँकी")}
                          className="py-3 px-2 sm:px-4 text-right font-semibold text-brand-green-ink"
                        >
                          {entry.status === "reversed" ? (
                            <span className="font-normal text-brand-muted">{text("no change", "फेरबदल छैन")}</span>
                          ) : (
                            money(entry.running_balance)
                          )}
                        </td>
                        {/* No minimum width: the note is empty on every work
                            row, and 192px of it pushed the table wider than a
                            tablet for the sake of one reversal message. */}
                        <td
                          data-label={text("Note", "टिपोट")}
                          className={`py-3 px-2 sm:px-4 text-xs text-brand-muted ${
                            entry.notes ? "" : "reflow-blank"
                          }`}
                        >
                          {entry.notes ? (
                            <span className="block min-w-0 break-words">{entry.notes}</span>
                          ) : (
                            <span className="text-brand-muted-soft">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-brand-muted">
                        {text(
                          "No ledger entries for this month",
                          "यो महिना यस कामदारको कुनै हिसाब छैन।",
                        )}
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
                {/* Whose payment. Money handed to the wrong name is the one
                    mistake this form can make, and the person picked at the
                    top of the page is a long way above this box. */}
                <h3 className="text-lg font-black text-emerald-950">
                  {text("Pay", "पैसा दिने")}{" "}
                  <span className="underline decoration-emerald-400 decoration-2 underline-offset-4">
                    {ledgerData.worker.name}
                  </span>
                </h3>
                <p className="mt-1 text-sm leading-6 text-emerald-800">
                  {text(
                    "Payment may be the full balance, fixed Saturday kharcha, or an advance. If payment is more than earned balance, the negative balance is recovered from future work.",
                    "पूरै बाँकी, शनिबारको खर्च वा पेश्की — जे दिए पनि हुन्छ। कमाएकोभन्दा बढी दिए, त्यो पछिको कामबाट कट्छ।",
                  )}
                </p>
              </div>
              <button type="button" onClick={() => setPaymentAmount(Math.max(0, ledgerData.summary.currentBalance).toString())} className="rounded-full border border-emerald-700 bg-brand-paper px-3 py-2 text-xs font-black text-emerald-800">{text("Use current balance", "अहिलेको बाँकी हाल्ने")}</button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-bold text-brand-green-ink">{text("Payment type", "के बापत")}
                <select value={paymentKind} onChange={(event) => setPaymentKind(event.target.value)} className="min-h-12 rounded-lg border border-brand-green-line bg-brand-paper px-3">
                  <option>{text("Saturday kharcha / advance", "शनिबारको खर्च / पेश्की")}</option>
                  <option>{text("Weekly wage payment", "साप्ताहिक ज्याला")}</option>
                  <option>{text("Final wage settlement", "पूरै हिसाब मिलाएको")}</option>
                  <option>{text("Other Owner-approved payment", "मालिकले भनेर दिएको अरू")}</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm font-bold text-brand-green-ink">{text("Payment date", "कहिले दिइयो")}
                <NepaliDateField value={paymentDate} onChange={setPaymentDate} required />
                {/* The Bikram Sambat reading of the chosen day (2083/05/19), so
                    the owner records the payment by the Nepali calendar. */}
                {paymentDate ? (
                  <span className="text-xs font-semibold text-brand-green">
                    {text("Nepali date", "नेपाली मिति")}: {toBikramSambatNumeric(paymentDate)}
                  </span>
                ) : null}
              </label>
              <label className="grid gap-1 text-sm font-bold text-brand-green-ink">{text("Amount (Rs.)", "कति रुपैयाँ")}
                <input type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} required className="min-h-12 rounded-lg border border-brand-green-line bg-brand-paper px-3" placeholder={text("Payment amount", "कति दिने")} />
              </label>
              <label className="grid gap-1 text-sm font-bold text-brand-green-ink">{text("Owner note", "मालिकको टिपोट")}
                <input value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} className="min-h-12 rounded-lg border border-brand-green-line bg-brand-paper px-3" placeholder={text("Optional reason or reference", "किन दिइयो — नलेखे पनि हुन्छ")} />
              </label>
            </div>
            <button type="submit" disabled={paymentSaving || !selectedWorkerId} className="mt-4 min-h-12 w-full rounded-xl bg-emerald-700 px-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-60">
              {paymentSaving
                ? text("Saving…", "टिप्दै…")
                : text("Record cash payment", "नगद दिएको टिप्ने")}
            </button>
          </form>
        </div>
      ) : (
        <div className="text-center text-brand-muted">{text("Select a worker to view their ledger", "खाता हेर्न कामदार छान्नुहोस्")}</div>
      )}
    </div>
  );
}
