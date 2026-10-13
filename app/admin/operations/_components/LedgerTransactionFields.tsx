"use client";

import { useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

// Payments and returns reduce what the customer owes, so the amount box can
// helpfully start at the full balance due. A credit sale or a manual note does
// not, so those start blank.
const CLEARING_TYPES = new Set(["Cash Payment", "Cheque Payment", "Return Adjustment"]);

/** The value saved stays the book's word; the owner reads his (2026-10-13). */
const KINDS: Array<{ value: string; en: string; ne: string }> = [
  { value: "Cash Payment", en: "Cash taken", ne: "नगद लिएको" },
  { value: "Cheque Payment", en: "Cheque taken", ne: "चेक लिएको" },
  { value: "Credit Sale", en: "Credit sale (due goes up)", ne: "उधारो बिक्री (बाँकी बढ्छ)" },
  { value: "Return Adjustment", en: "Goods returned (due goes down)", ne: "सामान फिर्ता (बाँकी घट्छ)" },
  { value: "Manual Adjustment", en: "Adjustment (due goes up)", ne: "हिसाब मिलान (बाँकी बढ्छ)" },
];

type LedgerTransactionFieldsProps = {
  balanceDue: number;
  inputClass: string;
  textareaClass: string;
};

export default function LedgerTransactionFields({
  balanceDue,
  inputClass,
  textareaClass,
}: LedgerTransactionFieldsProps) {
  const { text } = useLanguage();
  const dueString = balanceDue > 0 ? String(balanceDue) : "";
  const [type, setType] = useState("Cash Payment");
  const [amount, setAmount] = useState(dueString);
  // Once the owner types their own number, stop auto-filling so we never
  // overwrite what they entered.
  const [touched, setTouched] = useState(false);

  function handleTypeChange(next: string) {
    setType(next);
    if (!touched) {
      setAmount(CLEARING_TYPES.has(next) && balanceDue > 0 ? dueString : "");
    }
  }

  const showHint = balanceDue > 0 && CLEARING_TYPES.has(type) && !touched && amount === dueString;

  return (
    <>
      <select aria-label={text("Type", "किसिम")}
        name="type"
        className={inputClass}
        value={type}
        onChange={(event) => handleTypeChange(event.target.value)}
      >
        {KINDS.map((kind) => (
          <option key={kind.value} value={kind.value}>
            {text(kind.en, kind.ne)}
          </option>
        ))}
      </select>
      <input aria-label={text("Amount", "रकम")}
        name="amount" data-summary="money"
        type="number"
        min="1"
        required
        className={inputClass}
        placeholder={text("Amount", "रकम")}
        value={amount}
        onChange={(event) => {
          setAmount(event.target.value);
          setTouched(true);
        }}
      />
      {showHint ? (
        <p className="text-sm font-semibold text-brand-green">
          {text(
            `Balance Rs. ${balanceDue.toLocaleString("en-IN")} filled in — you can change it.`,
            `बाँकी रु. ${balanceDue.toLocaleString("en-IN")} अगाडि भरिएको — फेर्न मिल्छ।`,
          )}
        </p>
      ) : null}
      <textarea aria-label={text("Bill number, cheque number, return note, or remark", "बिल नं., चेक नं., फिर्ताको कारण वा टिपोट")}
        name="note"
        className={textareaClass}
        placeholder={text("Bill number, cheque number, return note, or remark", "बिल नं., चेक नं., फिर्ताको कारण वा टिपोट")}
      />
    </>
  );
}
