"use client";

import { useMemo, useState } from "react";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import { createFactoryStageHandoverAction } from "@/app/admin/factory/actions";

type AvailableSize = { size: string; availablePairs: number };

export default function StageHandoverForm({
  fromAssignmentId,
  sizes,
  toStageName,
  toWorkerName,
}: {
  fromAssignmentId: string;
  sizes: AvailableSize[];
  toStageName: string;
  toWorkerName: string;
}) {
  const [values, setValues] = useState<Record<string, number>>({});
  const totals = useMemo(
    () =>
      sizes.reduce(
        (sum, row) => ({
          sent: sum.sent + (values[`sent:${row.size}`] ?? 0),
          received: sum.received + (values[`received:${row.size}`] ?? 0),
        }),
        { sent: 0, received: 0 },
      ),
    [sizes, values],
  );
  const invalid = sizes.some((row) => {
    const sent = values[`sent:${row.size}`] ?? 0;
    const received = values[`received:${row.size}`] ?? 0;
    return sent > row.availablePairs || received > sent;
  });

  return (
    <form action={createFactoryStageHandoverAction} className="mt-3 rounded-xl border border-purple-200 bg-purple-50 p-3">
      <input type="hidden" name="fromAssignmentId" value={fromAssignmentId} />
      <p className="text-xs font-black uppercase tracking-wider text-purple-900">
        Send to {toStageName} · {toWorkerName}
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[430px] text-xs">
          <thead>
            <tr className="text-left uppercase tracking-wider text-gray-500">
              <th className="pb-2">Size</th>
              <th className="pb-2 text-center">Available</th>
              <th className="pb-2 text-center">Sent</th>
              <th className="pb-2 text-center">Received</th>
            </tr>
          </thead>
          <tbody>
            {sizes.filter((row) => row.availablePairs > 0).map((row) => (
              <tr key={row.size} className="border-t border-purple-100">
                <td className="py-2 font-black">{row.size}</td>
                <td className="px-2 py-2 text-center font-bold">{row.availablePairs}</td>
                {(["sent", "received"] as const).map((kind) => {
                  const key = `${kind}:${row.size}`;
                  return (
                    <td key={kind} className="px-1 py-2">
                      <input
                        name={`${kind}__${row.size}`}
                        type="number"
                        min="0"
                        step="1"
                        value={values[key] ?? 0}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            [key]: Math.max(0, Math.round(Number(event.target.value) || 0)),
                          }))
                        }
                        className="h-10 w-full rounded-lg border border-purple-200 bg-white px-2 text-center text-sm"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <label className="mt-3 block text-xs font-bold text-purple-950">
        Handover remarks
        <input name="remarks" placeholder="Explain any sent/received difference" className="mt-1 h-11 w-full rounded-lg border border-purple-200 bg-white px-3 font-normal" />
      </label>
      {invalid ? <p className="mt-2 text-xs font-bold text-red-600">Received cannot exceed sent, and sent cannot exceed available.</p> : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-bold text-purple-900">
          Sent {totals.sent} · Received {totals.received} · Difference {totals.sent - totals.received}
        </p>
        <FormSubmitButton
          disabled={totals.sent <= 0 || invalid}
          pendingLabel="Handing over…"
          className="min-h-11 rounded-xl bg-purple-700 px-5 text-sm font-black text-white"
        >
          Confirm handover
        </FormSubmitButton>
      </div>
    </form>
  );
}
