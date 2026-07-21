"use client";

import { useState } from "react";
import { createSupplierTransactionAction } from "@/app/admin/purchasing/actions";
import FormSubmitButton from "@/components/admin/FormSubmitButton";

type SupplierOption = { id: string; name: string; due: number };

const inputClass =
  "h-10 rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand-green";
const textareaClass =
  "min-h-24 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-green";

const money = (value: number) => `Rs. ${value.toLocaleString("en-IN")}`;

// Paying a supplier, the amount fills itself to what is owed the moment the
// supplier is picked, so the common case — clearing the full due — is one tap.
// The cashier still edits it down for a part payment. Left untouched once typed.
export default function SupplierPaymentForm({ suppliers }: { suppliers: SupplierOption[] }) {
  const [supplierId, setSupplierId] = useState("");
  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);

  function chooseSupplier(id: string) {
    setSupplierId(id);
    if (!amountTouched) {
      const due = suppliers.find((supplier) => supplier.id === id)?.due ?? 0;
      setAmount(due > 0 ? String(due) : "");
    }
  }

  return (
    <form action={createSupplierTransactionAction} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-brand-green-ink">Supplier payment</h2>
      <div className="mt-4 grid gap-3">
        <select
          name="supplierLedgerId"
          required
          className={inputClass}
          value={supplierId}
          onChange={(event) => chooseSupplier(event.target.value)}
        >
          <option value="">Select supplier</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name} - due {money(supplier.due)}
            </option>
          ))}
        </select>
        <select name="type" className={inputClass} defaultValue="Cash Payment">
          <option>Cash Payment</option>
          <option>Cheque Payment</option>
          <option>Bank Payment</option>
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
            setAmountTouched(true);
            setAmount(event.target.value);
          }}
        />
        {supplierId && !amountTouched && amount ? (
          <p className="-mt-1 text-xs text-brand-muted">Full due filled — edit for a part payment.</p>
        ) : null}
        <textarea name="note" className={textareaClass} placeholder="Payment note or adjustment reason" />
        <FormSubmitButton
          className="h-10 rounded-full bg-brand-green-ink px-4 text-sm font-bold text-white"
          pendingLabel="Recording…"
        >
          Record payment
        </FormSubmitButton>
      </div>
    </form>
  );
}
