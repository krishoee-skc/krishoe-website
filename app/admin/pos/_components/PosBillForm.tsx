"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPosInvoiceAction } from "@/app/admin/pos/actions";
import type { ActionState } from "@/app/admin/actions";
import ActionMessage from "@/components/admin/ActionMessage";
import { posLineIssue } from "@/lib/pos-line-check";
import { autoPaidAmount, posBillTotal } from "@/lib/pos-bill";

type LedgerOption = { id: string; label: string };

// A design the shop can sell: how many pairs are on hand, and the price for each
// channel. The counter picks from these so the rate fills itself and the stock
// is in view — no typing a name and a price from memory.
export type SellableItem = {
  design: string;
  stock: number;
  retailRate: number;
  wholesaleRate: number;
  sizes: string;
};

// The items of the shop's most recent sale, ready to drop back into the form so
// a repeat order does not have to be keyed again.
export type RepeatBillItem = {
  sku: string;
  design: string;
  sizeRun: string;
  quantity: string;
  rate: string;
  discount: string;
};

export type RepeatBill = {
  channel: string;
  invoiceNumber: string;
  items: RepeatBillItem[];
};

type PosBillFormProps = {
  ledgers: LedgerOption[];
  catalog: SellableItem[];
  lastBill?: RepeatBill | null;
};

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

// Wholesale gets its own price; retail and online sell at the shelf price.
function rateForChannel(channel: string, item: SellableItem) {
  return channel === "Wholesale" ? item.wholesaleRate : item.retailRate;
}

const inputBase = "h-10 rounded-md border px-3 text-sm outline-none focus:border-brand-green";
const inputClass = `${inputBase} border-gray-200 bg-white`;
const textareaClass =
  "min-h-24 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-green";

function fieldClass(hasError: boolean) {
  return `${inputBase} ${hasError ? "border-brand-clay bg-brand-clay-tint/40" : "border-gray-200 bg-white"}`;
}

export default function PosBillForm({ ledgers, catalog, lastBill }: PosBillFormProps) {
  const [rows, setRows] = useState<ItemRow[]>(() => Array.from({ length: 4 }, (_, index) => emptyRow(index)));
  const [nextKey, setNextKey] = useState(4);
  const [channel, setChannel] = useState("Retail");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [invoiceDiscount, setInvoiceDiscount] = useState("");
  const [tax, setTax] = useState("");
  // The paid amount fills itself to the bill total; the cashier only touches it
  // to enter a part payment, and once touched it stops following the total.
  const [paidManual, setPaidManual] = useState("");
  const [paidTouched, setPaidTouched] = useState(false);
  const [state, setState] = useState<ActionState | null>(null);
  const [isSaving, startSaving] = useTransition();
  const router = useRouter();

  // Look a design up by name, case-insensitively, so a picked or typed item
  // finds its stock and price.
  const catalogByDesign = useMemo(() => {
    const map = new Map<string, SellableItem>();
    for (const item of catalog) {
      map.set(item.design.trim().toLowerCase(), item);
    }
    return map;
  }, [catalog]);

  function lookup(design: string) {
    return catalogByDesign.get(design.trim().toLowerCase());
  }

  function updateRow(key: number, patch: Partial<ItemRow>) {
    setRows((current) => {
      const next = current.map((row) => {
        if (row.key !== key) {
          return row;
        }

        const merged = { ...row, ...patch };

        // Picking or typing a known design fills its price for the current
        // channel, so the cashier is not keying a rate they already set on the
        // product. They can still edit it after.
        if (patch.design !== undefined) {
          const item = lookup(patch.design);
          if (item) {
            merged.rate = String(rateForChannel(channel, item));
            // Fill the size run from the design so the receipt shows its sizes
            // without the cashier keying them. Left alone if the design has none.
            if (item.sizes) {
              merged.sizeRun = item.sizes;
            }
          }
        }

        return merged;
      });

      if (next[next.length - 1].key === key && rowIsTouched(next[next.length - 1])) {
        next.push(emptyRow(nextKey));
        setNextKey((value) => value + 1);
      }

      return next;
    });
  }

  // Switching between retail and wholesale re-prices every matched line, so a
  // wholesale bill does not quietly keep retail rates.
  function changeChannel(nextChannel: string) {
    setChannel(nextChannel);
    setRows((current) =>
      current.map((row) => {
        const item = lookup(row.design);
        return item ? { ...row, rate: String(rateForChannel(nextChannel, item)) } : row;
      }),
    );
  }

  // Drop the last sale's lines back into the form — a repeat customer buying
  // the same run does not need it all keyed again. The rates come straight from
  // that bill, so the channel is set without re-pricing.
  function repeatLastBill() {
    if (!lastBill || lastBill.items.length === 0) {
      return;
    }

    const filled = lastBill.items.map((item, index) => ({ key: index, ...item }));
    filled.push(emptyRow(filled.length));
    setRows(filled);
    setNextKey(filled.length);
    setChannel(lastBill.channel);
    setState(null);
  }

  const subtotal = useMemo(
    () =>
      rows.reduce((total, row) => {
        const line = (Number(row.quantity) || 0) * (Number(row.rate) || 0) - (Number(row.discount) || 0);
        return total + Math.max(0, line);
      }, 0),
    [rows],
  );

  const billTotal = posBillTotal(subtotal, Number(invoiceDiscount) || 0, Number(tax) || 0);
  // Until the cashier types in it, the paid box shows the amount that fills
  // itself — the full total for a pay-now method, nothing for Credit.
  const autoPaid = autoPaidAmount(paymentMethod, billTotal);
  const paidValue = paidTouched ? paidManual : autoPaid > 0 ? String(autoPaid) : "";
  const isCredit = paymentMethod === "Credit";

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

      if (result.ok && result.href) {
        router.push(result.href);
      }
    });
  }

  const inStockCount = catalog.filter((item) => item.stock > 0).length;

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <input type="hidden" name="itemCount" value={rows.length} />

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-brand-green-ink">New bill</h2>
          <p className="mt-1 text-sm text-gray-500">
            Pick an item and its price fills in. Bill save posts stock automatically.
          </p>
        </div>
        {lastBill && lastBill.items.length > 0 ? (
          <button
            type="button"
            onClick={repeatLastBill}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-brand-green bg-white px-4 text-sm font-bold text-brand-green transition hover:bg-brand-green hover:text-white"
          >
            ↻ Repeat last bill
            <span className="font-mono text-xs opacity-70">{lastBill.invoiceNumber}</span>
          </button>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <select name="kind" className={inputClass} defaultValue="Sale" aria-label="Bill type">
          <option>Sale</option>
          <option>Return</option>
        </select>
        <select
          name="channel"
          className={inputClass}
          value={channel}
          onChange={(event) => changeChannel(event.target.value)}
          aria-label="Sales channel"
        >
          <option>Retail</option>
          <option>Wholesale</option>
          <option>Online</option>
        </select>
        <select
          name="paymentMethod"
          className={inputClass}
          value={paymentMethod}
          onChange={(event) => setPaymentMethod(event.target.value)}
          aria-label="Payment method"
        >
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

      {/* In-stock designs first, each showing pairs on hand, so the counter
          picks from what is actually sellable. Still typeable for anything off
          the catalog — a return, a one-off. */}
      <datalist id="pos-design-options">
        {catalog.map((item) => (
          <option key={item.design} value={item.design} label={item.stock > 0 ? `${item.stock} in stock` : "out of stock"} />
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
              const item = lookup(row.design);
              const wanted = Number(row.quantity) || 0;
              const oversell = Boolean(item) && wanted > (item?.stock ?? 0);

              return (
                <tr key={row.key}>
                  <td className="py-2 pr-3 align-top">
                    <input
                      name={`item${index}Sku`}
                      className={`${inputClass} w-28`}
                      placeholder="SKU"
                      value={row.sku}
                      onChange={(event) => updateRow(row.key, { sku: event.target.value })}
                      aria-label={`Item ${index + 1} SKU`}
                    />
                  </td>
                  <td className="py-2 pr-3 align-top">
                    <input
                      name={`item${index}Design`}
                      className={`${fieldClass(Boolean(issue?.design))} min-w-56`}
                      list="pos-design-options"
                      placeholder="Type or pick a design"
                      value={row.design}
                      onChange={(event) => updateRow(row.key, { design: event.target.value })}
                      aria-label={`Item ${index + 1} design`}
                    />
                    {item ? (
                      <p className={`mt-1 text-xs font-semibold ${oversell ? "text-brand-clay" : "text-brand-muted"}`}>
                        {oversell ? `Only ${item.stock} in stock` : `${item.stock} in stock`}
                      </p>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 align-top">
                    <input
                      name={`item${index}SizeRun`}
                      className={`${inputClass} w-24`}
                      placeholder="Mixed"
                      value={row.sizeRun}
                      onChange={(event) => updateRow(row.key, { sizeRun: event.target.value })}
                      aria-label={`Item ${index + 1} size run`}
                    />
                  </td>
                  <td className="py-2 pr-3 align-top">
                    <input
                      name={`item${index}Quantity`}
                      type="number"
                      min="0"
                      className={`${fieldClass(Boolean(issue?.quantity) || oversell)} w-24`}
                      placeholder="0"
                      value={row.quantity}
                      onChange={(event) => updateRow(row.key, { quantity: event.target.value })}
                      aria-label={`Item ${index + 1} pairs`}
                    />
                  </td>
                  <td className="py-2 pr-3 align-top">
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
                  <td className="py-2 pr-3 align-top">
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

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-brand-muted">
          {inStockCount > 0
            ? `${inStockCount} design${inStockCount === 1 ? "" : "s"} in stock. Pick one and its price fills in.`
            : "A new row appears as you fill the last one."}
        </p>
        <p className="text-sm font-semibold text-brand-green-ink">Items {money(subtotal)}</p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <input
          name="invoiceDiscount"
          type="number"
          min="0"
          className={inputClass}
          placeholder="Bill discount"
          value={invoiceDiscount}
          onChange={(event) => setInvoiceDiscount(event.target.value)}
        />
        <input
          name="tax"
          type="number"
          min="0"
          className={inputClass}
          placeholder="Tax / VAT"
          value={tax}
          onChange={(event) => setTax(event.target.value)}
        />
        <div className="grid gap-1">
          <input
            name="paidAmount"
            type="number"
            min="0"
            className={inputClass}
            placeholder="Paid amount"
            value={isCredit ? "" : paidValue}
            disabled={isCredit}
            onChange={(event) => {
              setPaidTouched(true);
              setPaidManual(event.target.value);
            }}
          />
          {!isCredit && !paidTouched && billTotal > 0 ? (
            <p className="text-xs text-brand-muted">Full amount — edit if paid in part.</p>
          ) : null}
        </div>
        <textarea name="note" className={textareaClass} placeholder="Delivery, return, QR, or counter note" />
      </div>

      <div className="mt-4 space-y-3">
        <ActionMessage state={state} linkLabel="Open receipt" />
        {/* Big, full-width on a phone so the counter can tap it without aiming —
            this is the action the shop runs dozens of times a day. */}
        <button
          type="submit"
          disabled={isSaving}
          className="h-14 w-full rounded-full bg-brand-green-ink px-6 text-base font-black text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
        >
          {isSaving ? "Saving..." : "Save bill and open receipt"}
        </button>
      </div>
    </form>
  );
}
