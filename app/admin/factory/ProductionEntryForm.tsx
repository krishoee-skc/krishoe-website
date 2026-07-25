"use client";

import { useMemo, useState } from "react";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import { createFactoryProductionEntryAction } from "@/app/admin/factory/actions";

type SizeRow = { size: string; remainingPairs: number };

export default function ProductionEntryForm({
  assignmentId,
  sizes,
  wageRate,
}: {
  assignmentId: string;
  sizes: SizeRow[];
  wageRate: number;
}) {
  const [values, setValues] = useState<Record<string, number>>({});
  const totals = useMemo(
    () =>
      sizes.reduce(
        (sum, row) => ({
          good: sum.good + (values[`good:${row.size}`] ?? 0),
          reject: sum.reject + (values[`reject:${row.size}`] ?? 0),
          rework: sum.rework + (values[`rework:${row.size}`] ?? 0),
        }),
        { good: 0, reject: 0, rework: 0 },
      ),
    [sizes, values],
  );
  const processed = totals.good + totals.reject + totals.rework;
  const invalid = sizes.some((row) => {
    const entered =
      (values[`good:${row.size}`] ?? 0) +
      (values[`reject:${row.size}`] ?? 0) +
      (values[`rework:${row.size}`] ?? 0);
    return entered > row.remainingPairs;
  });

  function quantityField(kind: "good" | "reject" | "rework", size: string) {
    const key = `${kind}:${size}`;
    return (
      <input
        name={`${kind}__${size}`}
        type="number"
        min="0"
        step="1"
        value={values[key] ?? 0}
        aria-label={`${kind} pairs for size ${size}`}
        onChange={(event) =>
          setValues((current) => ({
            ...current,
            [key]: Math.max(0, Math.round(Number(event.target.value) || 0)),
          }))
        }
        className="h-10 w-full rounded-lg border border-gray-200 px-2 text-center text-sm"
      />
    );
  }

  return (
    <form action={createFactoryProductionEntryAction} className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
              <th className="pb-2">Size</th>
              <th className="pb-2 text-center">Remaining</th>
              <th className="pb-2 text-center text-emerald-700">Good</th>
              <th className="pb-2 text-center text-red-700">Reject</th>
              <th className="pb-2 text-center text-amber-700">Rework</th>
            </tr>
          </thead>
          <tbody>
            {sizes.filter((row) => row.remainingPairs > 0).map((row) => (
              <tr key={row.size} className="border-t border-gray-100">
                <td className="py-2 font-black">{row.size}</td>
                <td className="px-2 py-2 text-center font-bold">{row.remainingPairs}</td>
                <td className="px-1 py-2">{quantityField("good", row.size)}</td>
                <td className="px-1 py-2">{quantityField("reject", row.size)}</td>
                <td className="px-1 py-2">{quantityField("rework", row.size)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <label className="mt-3 block text-sm font-bold">
        Remarks
        <input name="remarks" placeholder="Today’s production note" className="mt-1 h-11 w-full rounded-lg border border-gray-200 px-3 font-normal" />
      </label>
      {invalid ? <p className="mt-2 text-xs font-bold text-red-600">One or more sizes exceed the remaining quantity.</p> : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 p-3">
        <div className="text-xs font-bold text-gray-600">
          Received {processed} · Good {totals.good} · Reject {totals.reject} · Rework {totals.rework}
          <br />
          Wage preview: Rs. {(totals.good * wageRate).toLocaleString("en-IN")}
        </div>
        <FormSubmitButton
          disabled={processed <= 0 || invalid}
          pendingLabel="Submitting…"
          className="min-h-11 rounded-xl bg-brand-green px-5 text-sm font-black text-white"
        >
          Submit production entry
        </FormSubmitButton>
      </div>
    </form>
  );
}
