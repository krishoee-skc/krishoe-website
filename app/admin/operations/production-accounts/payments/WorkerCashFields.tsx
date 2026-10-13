"use client";

import { useLanguage } from "@/components/LanguageProvider";

const input =
  "min-h-12 w-full rounded-xl border border-brand-green-line bg-brand-paper px-3 text-sm text-brand-green-ink outline-none focus:border-brand-green";

/** The value saved stays the book's word; the owner reads his (2026-10-13). */
const KINDS: Array<{ value: string; en: string; ne: string }> = [
  { value: "Saturday Kharcha", en: "Saturday kharcha", ne: "शनिबारको खर्च" },
  { value: "Midweek Advance", en: "Midweek advance", ne: "हप्ताबीचको पेस्की" },
  { value: "Final Settlement", en: "Final settlement", ne: "पूरै हिसाब मिलाएको" },
  { value: "Bonus", en: "Bonus (adds to what is owed)", ne: "बोनस (दिनुपर्ने बढ्छ)" },
  { value: "Deduction", en: "Deduction", ne: "कटौती" },
];

/**
 * Who and what for, in both languages (owner's sample 7ग). The form around
 * them is the page's, so it posts and walks as before.
 */
export default function WorkerCashFields({ employees }: { employees: Array<{ id: string; name: string }> }) {
  const { text } = useLanguage();
  return (
    <>
      <select aria-label={text("Worker", "कामदार")} name="employeeId" className={input} required defaultValue="" data-summary="text">
        <option value="" disabled>
          {text("Select worker/staff", "कामदार छान्नुहोस्")}
        </option>
        {employees.map((employee) => (
          <option key={employee.id} value={employee.id}>
            {employee.name}
          </option>
        ))}
      </select>
      <select aria-label={text("Payment type", "के बापत")} name="paymentType" className={input} defaultValue="Saturday Kharcha" data-summary="text">
        {KINDS.map((kind) => (
          <option key={kind.value} value={kind.value}>
            {text(kind.en, kind.ne)}
          </option>
        ))}
      </select>
    </>
  );
}
