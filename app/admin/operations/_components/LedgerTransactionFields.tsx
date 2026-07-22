"use client";

import { useState } from "react";

// Payments and returns reduce what the customer owes, so the amount box can
// helpfully start at the full balance due. A credit sale or a manual note does
// not, so those start blank.
const CLEARING_TYPES = new Set(["Cash Payment", "Cheque Payment", "Return Adjustment"]);

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
      <select
        name="type"
        className={inputClass}
        value={type}
        onChange={(event) => handleTypeChange(event.target.value)}
      >
        <option>Cash Payment</option>
        <option>Cheque Payment</option>
        <option>Credit Sale</option>
        <option>Return Adjustment</option>
        <option>Manual Adjustment</option>
      </select>
      <input
        name="amount"
        type="number"
        min="1"
        required
        className={inputClass}
        placeholder="Amount"
        value={amount}
        onChange={(event) => {
          setAmount(event.target.value);
          setTouched(true);
        }}
      />
      {showHint ? (
        <p className="text-xs font-semibold text-brand-green">
          बाँकी रु. {balanceDue.toLocaleString("en-IN")} अगाडि भरिएको — फेर्न मिल्छ।
        </p>
      ) : null}
      <textarea
        name="note"
        className={textareaClass}
        placeholder="Bill number, cheque number, return note, or remark"
      />
    </>
  );
}
