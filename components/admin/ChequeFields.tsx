"use client";

import NepaliDateField from "@/components/admin/NepaliDateField";
import { useLanguage } from "@/components/LanguageProvider";
import { bankChoices, chequeDateWarning } from "@/lib/cheque-book-rules";

export type ChequeDetails = { bank: string; date: string; name: string; number?: string };

/**
 * The cheque's own details (owner, 2026-10-01: "which bank, when to
 * deposit"): the bank, the cheque's date, the name written on it — and, on a
 * bill, its number. Posted as chequeBank, chequeDate (a day key), chequeName
 * and chequeNo.
 *
 * `later` — on a counter bill — asks for nothing: only the amount matters
 * while the customer waits, and the rest is filled in the cheque book after
 * (owner, 2026-10-01). The boxes are there, folded, for whoever has them.
 * Without it — a cheque the shop gives — the bank and date are asked here.
 */
export default function ChequeFields({
  direction,
  value,
  onChange,
  usedBanks,
  todayKey,
  inputClass,
  later = false,
}: {
  direction: "in" | "out";
  value: ChequeDetails;
  onChange: (next: ChequeDetails) => void;
  usedBanks: string[];
  todayKey: string;
  inputClass: string;
  later?: boolean;
}) {
  const { text } = useLanguage();
  const banks = bankChoices(usedBanks);
  const quick = banks.slice(0, 6);
  const old = chequeDateWarning(value.date, todayKey);
  const listId = `cheque-banks-${direction}`;
  const star = later ? "" : " *";

  const boxes = (
    <>
      {later ? (
        <label className="grid gap-1">
          <span className="text-sm font-bold text-brand-muted">{text("Cheque no.", "चेक नं.")}</span>
          <input
            name="chequeNo"
            value={value.number ?? ""}
            onChange={(event) => onChange({ ...value, number: event.target.value })}
            inputMode="numeric"
            className={inputClass}
            autoComplete="off"
          />
        </label>
      ) : null}
      <label className="grid gap-1">
        <span className="text-sm font-bold text-brand-muted">
          {direction === "in" ? text(`Bank (on the cheque)${star}`, `बैंक (चेकमा भएको)${star}`) : text(`From our account at${star}`, `हाम्रो कुन बैंकको खाता${star}`)}
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
        <span className="flex flex-wrap gap-1.5" data-enter-skip>
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
            {direction === "in" ? text(`Cheque date — deposit on${star}`, `चेकको मिति — कहिले साट्ने${star}`) : text(`Cheque date — cashable from${star}`, `चेकको मिति — कहिलेदेखि साट्न मिल्ने${star}`)}
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
    </>
  );

  if (later) {
    const filled = Boolean(value.number || value.bank || value.date || value.name);
    return (
      <div className="grid gap-2 rounded-2xl border border-brand-green-line bg-brand-paper p-3 text-base" data-cheque-fields={direction}>
        <p className="text-sm font-bold text-brand-green-ink">
          {text(
            "🏦 Only the amount is needed now. The cheque's number, bank and date can be filled later in Cheques.",
            "🏦 अहिले रकम मात्र चाहिन्छ। चेकको नम्बर, बैंक र मिति पछि चेक खातामा भर्न मिल्छ।",
          )}
        </p>
        <details open={filled} className="grid gap-3">
          <summary className="cursor-pointer text-sm font-black text-brand-green" data-enter-skip>
            {text("+ Add them now", "+ अहिल्यै भर्ने")}
          </summary>
          <div className="mt-2 grid gap-3">{boxes}</div>
        </details>
      </div>
    );
  }

  return (
    <div className="grid gap-3 rounded-2xl border border-brand-green-line bg-brand-paper p-3 text-base" data-cheque-fields={direction}>
      <p className="text-base font-black text-brand-green-ink">
        {direction === "in" ? text("🏦 The cheque", "🏦 चेकको विवरण") : text("🏦 Our cheque", "🏦 हाम्रो चेक")}
      </p>
      {boxes}
    </div>
  );
}
