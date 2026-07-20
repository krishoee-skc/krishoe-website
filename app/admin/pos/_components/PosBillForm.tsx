"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPosInvoiceAction } from "@/app/admin/pos/actions";
import type { ActionState } from "@/app/admin/actions";
import ActionMessage from "@/components/admin/ActionMessage";
import { posLineIssue } from "@/lib/pos-line-check";

type LedgerOption = { id: string; label: string };

type PosBillFormProps = {
  ledgers: LedgerOption[];
  designOptions: string[];
};

// One item row as the form holds it. Strings, because that is what an input
// returns; the numbers are parsed only for the running total.
type ItemRow = {
  key: number;
  sku: string;
  design: string;
  sizeRun: string;
  quantity: string;
  rate: string;
  discount: string;
};

function emptyRow(key: number): ItemRow {
  return { key, sku: "", design: "", sizeRun: "", quantity: "", rate: "", discount: "" };
}

function rowIsTouched(row: ItemRow) {
  return Boolean(row.sku || row.design || row.quantity || row.rate);
}

const money = (value: number) =>
  `Rs. ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const inputBase = "h-10 rounded-md border px-3 text-sm outline-none focus:border-brand-green";
const inputClass = `${inputBase} border-gray-200 bg-white`;
const textareaClass =
  "min-h-24 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-green";

// The same box, red when the field is what is holding the bill back.
function fieldClass(hasError: boolean) {
  return `${inputBase} ${hasError ? "border-brand-clay bg-brand-clay-tint/40" : "border-gray-200 bg-white"}`;
}

export default function PosBillForm({ ledgers, designOptions }: PosBillFormProps) {
  // Open at four rows: enough for the common counter sale without a wall of
  // empty inputs, and it grows from there.
  const [rows, setRows] = useState<ItemRow[]>(() => Array.from({ length: 4 }, (_, index) => emptyRow(index)));
  const [nextKey, setNextKey] = useState(4);
  const [state, setState] = useState<ActionState | null>(null);
  const [isSaving, startSaving] = useTransition();
  const router = useRouter();

  function updateRow(key: number, patch: Partial<ItemRow>) {
    setRows((current) => {
      const next = current.map((row) => (row.key === key ? { ...row, ...patch } : row));

      if (next[next.length - 1].key === key && rowIsTouched(next[next.length - 1])) {
        next.push(emptyRow(nextKey));
        setNextKey((value) => value + 1);
      }

      return next;
    });
  }

  const subtotal = useMemo(
    () =>
      rows.reduce((total, row) => {
        const line = (Number(row.quantity) || 0) * (Number(row.rate) || 0) - (Number(row.discount) || 0);
        return total + Math.max(0, line);
      }, 0),
    [rows],
  );

  // Submitted here rather than through the form's action so a failure comes back
  // as a message, not the admin error page, with every line the cashier typed
  // still on screen to fix.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const started = rows.filter(rowIsTouched);
    const firstBadIndex = started.findIndex((row) => posLineIssue(row));

    if (started.length === 0) {
      setState({ ok: false, message: "Add at least one item — a design, with quantity and rate." });
      return;
    }

    if (firstBadIndex !== -1) {
      const issue = posLineIssue(started[firstBadIndex]);
      setState({ ok: false, message: `Item ${firstBadIndex + 1}: ${issue?.message ?? "please complete this line."}` });
      return;
    }

    startSaving(async () => {
      const result = await createPosInvoiceAction(state, formData);
      setState(result);

      // A saved bill opens its receipt — the counter's next move is to print it,
      // which is what the old flow did too. A failed one stays put with the
      // reason shown.
      if (result.ok && result.href) {
        router.push(result.href);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <input type="hidden" name="itemCount" value={rows.length} />

      <div className="mb-5">
        <h2 className="text-lg font-black text-brand-green-ink">New bill</h2>
        <p className="mt-1 text-sm text-gray-500">
          Bill save posts stock automatically. Select a customer ledger for credit sales.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <select name="kind" className={inputClass} defaultValue="Sale" aria-label="Bill type">
          <option>Sale</option>
          <option>Return</option>
        </select>
        <select name="channel" className={inputClass} defaultValue="Retail" aria-label="Sales channel">
          <option>Retail</option>
          <option>Wholesale</option>
          <option>Online</option>
        </select>
        <select name="paymentMethod" className={inputClass} defaultValue="Cash" aria-label="Payment method">
          <option>Cash</option>
          <option>Cheque</option>
          <option>Credit</option>
          <option>QR</option>
          <option>eSewa</option>
          <option>Khalti</option>
          <option>Bank</option>
        </select>
        <input name="cashier" className={inputClass} placeholder="Cashier / counter" />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <input name="customerName" className={inputClass} placeholder="Customer name" />
        <input name="phone" className={inputClass} placeholder="Phone" />
        <select name="ledgerId" className={inputClass} defaultValue="" aria-label="Customer ledger">
          <option value="">No ledger / walk-in</option>
          {ledgers.map((ledger) => (
            <option key={ledger.id} value={ledger.id}>
              {ledger.label}
            </option>
          ))}
        </select>
        <input name="paymentReference" className={inputClass} placeholder="Cheque/QR/ref no." />
      </div>

      <datalist id="pos-design-options">
        {designOptions.map((design) => (
          <option key={design} value={design} />
        ))}
      </datalist>

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b text-left text-gray-500">
            <tr>
              <th className="py-2 pr-3">SKU</th>
              <th className="py-2 pr-3">Design / item</th>
              <th className="py-2 pr-3">Size</th>
              <th className="py-2 pr-3">Pairs</th>
              <th className="py-2 pr-3">Rate</th>
              <th className="py-2 pr-3">Discount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row, index) => {
              const issue = posLineIssue(row);

              return (
                <tr key={row.key}>
                  <td className="py-2 pr-3">
                    <input
                      name={`item${index}Sku`}
                      className={`${inputClass} w-28`}
                      placeholder="SKU"
                      value={row.sku}
                      onChange={(event) => updateRow(row.key, { sku: event.target.value })}
                      aria-label={`Item ${index + 1} SKU`}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      name={`item${index}Design`}
                      className={`${fieldClass(Boolean(issue?.design))} min-w-56`}
                      list="pos-design-options"
                      placeholder="Design name"
                      value={row.design}
                      onChange={(event) => updateRow(row.key, { design: event.target.value })}
                      aria-label={`Item ${index + 1} design`}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      name={`item${index}SizeRun`}
                      className={`${inputClass} w-24`}
                      placeholder="Mixed"
                      value={row.sizeRun}
                      onChange={(event) => updateRow(row.key, { sizeRun: event.target.value })}
                      aria-label={`Item ${index + 1} size run`}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      name={`item${index}Quantity`}
                      type="number"
                      min="0"
                      className={`${fieldClass(Boolean(issue?.quantity))} w-24`}
                      placeholder="0"
                      value={row.quantity}
                      onChange={(event) => updateRow(row.key, { quantity: event.target.value })}
                      aria-label={`Item ${index + 1} pairs`}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      name={`item${index}Rate`}
                      type="number"
                      min="0"
                      className={`${fieldClass(Boolean(issue?.rate))} w-28`}
                      placeholder="0"
                      value={row.rate}
                      onChange={(event) => updateRow(row.key, { rate: event.target.value })}
                      aria-label={`Item ${index + 1} rate`}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      name={`item${index}Discount`}
                      type="number"
                      min="0"
                      className={`${inputClass} w-28`}
                      placeholder="0"
                      value={row.discount}
                      onChange={(event) => updateRow(row.key, { discount: event.target.value })}
                      aria-label={`Item ${index + 1} discount`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-brand-muted">
          A new row appears as you fill the last one. Blank rows are ignored.
        </p>
        <p className="text-sm font-semibold text-brand-green-ink">Items {money(subtotal)}</p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <input name="invoiceDiscount" type="number" min="0" className={inputClass} placeholder="Bill discount" />
        <input name="tax" type="number" min="0" className={inputClass} placeholder="Tax / VAT" />
        <input name="paidAmount" type="number" min="0" className={inputClass} placeholder="Paid amount" />
        <textarea name="note" className={textareaClass} placeholder="Delivery, return, QR, or counter note" />
      </div>

      <div className="mt-4 space-y-3">
        <ActionMessage state={state} linkLabel="Open receipt" />
        <button
          type="submit"
          disabled={isSaving}
          className="h-11 rounded-full bg-brand-green-ink px-6 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save bill and open receipt"}
        </button>
      </div>
    </form>
  );
}
