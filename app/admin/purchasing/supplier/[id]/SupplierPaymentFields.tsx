"use client";

import { useLanguage } from "@/components/LanguageProvider";
import RefusedNote from "@/app/admin/purchasing/_components/RefusedNote";

const inputClass =
  "h-10 rounded-md border border-brand-green-line bg-brand-paper px-3 text-sm outline-none focus:border-brand-green";
const textareaClass =
  "min-h-24 rounded-md border border-brand-green-line bg-brand-paper px-3 py-2 text-sm outline-none focus:border-brand-green";

/** The value saved stays the book's own word; the owner reads it in his. */
const KINDS: Array<{ value: string; en: string; ne: string }> = [
  { value: "Cash Payment", en: "Cash payment", ne: "नगद तिरेको" },
  { value: "Cheque Payment", en: "Cheque payment", ne: "चेकबाट तिरेको" },
  { value: "Bank Payment", en: "Bank payment", ne: "बैंकबाट तिरेको" },
  { value: "QR Payment", en: "QR payment", ne: "QR बाट तिरेको" },
  { value: "Return Adjustment", en: "Goods returned (due goes down)", ne: "सामान फिर्ता (बाँकी घट्छ)" },
  { value: "Manual Adjustment", en: "Manual adjustment (due goes up)", ne: "हातैले मिलाउने (बाँकी बढ्छ)" },
];

/**
 * The boxes of a supplier's payment, in both languages (owner's sample,
 * 2026-10-12). The form around them is the page's, so it posts and walks as
 * before.
 */
export default function SupplierPaymentFields() {
  const { text } = useLanguage();
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <RefusedNote className="md:col-span-3" />
      <label className="grid gap-1 text-sm font-bold text-brand-green-ink">
        {text("How", "कसरी")}
        <select aria-label={text("Type", "किसिम")} name="type" data-summary="text" className={inputClass} defaultValue="Cash Payment">
          {KINDS.map((kind) => (
            <option key={kind.value} value={kind.value}>
              {text(kind.en, kind.ne)}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-bold text-brand-green-ink">
        {text("Amount (Rs.)", "कति रुपैयाँ")}
        <input aria-label={text("Amount", "रकम")} name="amount" data-summary="money" type="number" min="1" required className={inputClass} placeholder={text("Amount", "रकम")} />
      </label>
      <label className="grid gap-1 text-sm font-bold text-brand-green-ink">
        {text("Note", "टिपोट")}
        <textarea
          aria-label={text("Voucher, cheque, bank reference, return note, or remark", "भौचर, चेक नं., बैंकको नम्बर, फिर्ताको कारण वा टिपोट")}
          name="note"
          className={textareaClass}
          placeholder={text("Voucher, cheque, bank reference, return note, or remark", "भौचर, चेक नं., बैंकको नम्बर, फिर्ताको कारण वा टिपोट")}
        />
      </label>
    </div>
  );
}
