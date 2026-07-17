"use client";

import { useState } from "react";

const inputClass =
  "h-10 rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand-green";

// One row as the form holds it. Strings, because that is what an input returns.
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

/**
 * The item rows of a POS bill.
 *
 * This used to be six rows rendered server-side, with the action reading
 * item1..item6. A seventh item was not rejected — it had nowhere to be typed,
 * and a counter sale of twenty-five pairs had to be split across bills. Rows
 * now grow as they are filled, and the action is told how many were rendered.
 */
export default function PosInvoiceItems() {
  const [rows, setRows] = useState<ItemRow[]>(() =>
    // Open at four: enough for the common counter sale without a wall of empty
    // inputs, and it grows from there.
    Array.from({ length: 4 }, (_, index) => emptyRow(index)),
  );
  const [nextKey, setNextKey] = useState(4);

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

  const subtotal = rows.reduce((total, row) => {
    const line = (Number(row.quantity) || 0) * (Number(row.rate) || 0) - (Number(row.discount) || 0);
    return total + Math.max(0, line);
  }, 0);

  return (
    <>
      {/* The action reads item0..itemN-1, so it has to know the row count
          rather than assume a maximum. */}
      <input type="hidden" name="itemCount" value={rows.length} />

      <div className="overflow-x-auto">
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
            {rows.map((row, index) => (
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
                    className={`${inputClass} min-w-56`}
                    list="pos-design-options"
                    placeholder="Design name"
                    required={index === 0}
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
                    className={`${inputClass} w-24`}
                    placeholder="0"
                    required={index === 0}
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
                    className={`${inputClass} w-28`}
                    placeholder="0"
                    required={index === 0}
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
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-brand-muted">
          A new row appears as you fill the last one. Blank rows are ignored.
        </p>
        <p className="text-sm font-semibold text-brand-green-ink">Items {money(subtotal)}</p>
      </div>
    </>
  );
}
