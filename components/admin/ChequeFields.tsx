"use client";

import NepaliDateField from "@/components/admin/NepaliDateField";
import { useLanguage } from "@/components/LanguageProvider";
import { bankChoices, chequeDateWarning } from "@/lib/cheque-book-rules";

export type ChequeDetails = { bank: string; date: string; name: string };

/**
 * The cheque's own details, beside its number (owner, 2026-10-01: "which
 * bank, when to deposit"): the bank, the cheque's date, and the name written
 * on it. Posted as chequeBank, chequeDate (a day key) and chequeName.
 *
 * `direction` words the boxes: a cheque taken is the customer's bank; a cheque
 * given is the shop's own account.
 */
export default function ChequeFields({
  direction,
  value,
  onChange,
  usedBanks,
  todayKey,
  inputClass,
}: {
  direction: "in" | "out";
  value: ChequeDetails;
  onChange: (next: ChequeDetails) => void;
  usedBanks: string[];
  todayKey: string;
  inputClass: string;
}) {
  const { text } = useLanguage();
  const banks = bankChoices(usedBanks);
  const quick = banks.slice(0, 6);
  const old = chequeDateWarning(value.date, todayKey);
  const listId = `cheque-banks-${direction}`;

  return (
    <div className="grid gap-3 rounded-2xl border border-brand-green-line bg-brand-paper p-3 text-base" data-cheque-fields={direction}>
      <p className="text-base font-black text-brand-green-ink">
        {direction === "in" ? text("🏦 The cheque", "🏦 चेकको विवरण") : text("🏦 Our cheque", "🏦 हाम्रो चेक")}
      </p>
      <label className="grid gap-1">
        <span className="text-sm font-bold text-brand-muted">
          {direction === "in" ? text("Bank (on the cheque) *", "बैंक (चेकमा भएको) *") : text("From our account at *", "हाम्रो कुन बैंकको खाता *")}
        </span>
        <input
          name="chequeBank"
          list={listId}
          value={value.bank}
          onChange={(event) => onChange({ ...value, bank: event.target.value })}
          placeholder={text("Type or pick the bank", "बैंक लेख्नुहोस् वा छान्नुहोस्")}
          className={inputClass}
          autoComplete="off"
        />
        <datalist id={listId}>
          {banks.map((bank) => (
            <option key={bank} value={bank} />
          ))}
        </datalist>
        <span className="flex flex-wrap gap-1.5">
          {quick.map((bank) => (
            <button
              key={bank}
              type="button"
              aria-pressed={value.bank === bank}
              onClick={() => onChange({ ...value, bank })}
              className={`min-h-9 rounded-full border px-3 text-sm font-bold ${
                value.bank === bank ? "border-brand-green bg-brand-green-wash text-brand-green" : "border-brand-green-line text-brand-green-ink"
              }`}
            >
              {bank}
            </button>
          ))}
        </span>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-sm font-bold text-brand-muted">
            {direction === "in" ? text("Cheque date — deposit on *", "चेकको मिति — कहिले साट्ने *") : text("Cheque date — cashable from *", "चेकको मिति — कहिलेदेखि साट्न मिल्ने *")}
          </span>
          <NepaliDateField name="chequeDate" value={value.date} onChange={(date) => onChange({ ...value, date })} />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-bold text-brand-muted">
            {direction === "in" ? text("Name on the cheque", "चेकमा लेखिएको नाम") : text("Pay (name written)", "कसको नाममा लेखेको")}
          </span>
          <input
            name="chequeName"
            value={value.name}
            onChange={(event) => onChange({ ...value, name: event.target.value })}
            placeholder={text("If not the customer's own", "ग्राहकको आफ्नै नाम नभए")}
            className={inputClass}
          />
        </label>
      </div>
      {old ? <p className="rounded-xl bg-brand-cream-soft px-3 py-2 text-sm font-bold text-brand-gold-deep">⚠ {text(old.en, old.ne)}</p> : null}
      {value.date && value.date > todayKey ? (
        <p className="text-sm font-bold text-brand-green">
          {direction === "in"
            ? text("Dated ahead — the cheque book will remind you on its day.", "पछिको मितिको चेक — त्यो दिन चेक खाताले सम्झाउँछ।")
            : text("Dated ahead — you will be reminded two days before to keep the money in the bank.", "पछिको मिति — २ दिनअघि बैंकमा पैसा राख्न सम्झाइन्छ।")}
        </p>
      ) : null}
    </div>
  );
}
