"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import { createFactoryProductionEntryAction } from "@/app/admin/factory/actions";
import {
  factoryOfflineDraftStorageKey,
  normalizeFactoryOfflineDraft,
  parseFactoryOfflineDrafts,
  type FactoryOfflineProductionDraft,
} from "@/lib/factory-offline";

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
  const searchParams = useSearchParams();
  const [values, setValues] = useState<Record<string, number>>({});
  const [remarks, setRemarks] = useState("");
  const [drafts, setDrafts] = useState<FactoryOfflineProductionDraft[]>([]);
  const [online, setOnline] = useState(true);
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    const syncedId = searchParams.get("offlineSynced");
    const hydrateTimer = window.setTimeout(() => {
      updateOnline();
      const all = parseFactoryOfflineDrafts(
        window.localStorage.getItem(factoryOfflineDraftStorageKey),
      ).filter((draft) => draft.id !== syncedId);
      if (syncedId) {
        window.localStorage.setItem(
          factoryOfflineDraftStorageKey,
          JSON.stringify(all),
        );
      }
      setDrafts(all.filter((draft) => draft.assignmentId === assignmentId));
    }, 0);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.clearTimeout(hydrateTimer);
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, [assignmentId, searchParams]);

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

  function writeDrafts(nextAssignmentDrafts: FactoryOfflineProductionDraft[]) {
    const otherDrafts = parseFactoryOfflineDrafts(
      window.localStorage.getItem(factoryOfflineDraftStorageKey),
    ).filter((draft) => draft.assignmentId !== assignmentId);
    window.localStorage.setItem(
      factoryOfflineDraftStorageKey,
      JSON.stringify([...nextAssignmentDrafts, ...otherDrafts]),
    );
    setDrafts(nextAssignmentDrafts);
  }

  function saveOfflineDraft() {
    if (processed <= 0 || invalid) return;
    const draft = normalizeFactoryOfflineDraft({
      id: `FDRAFT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      assignmentId,
      createdAt: new Date().toISOString(),
      remarks,
      sizes: sizes.map((row) => ({
        size: row.size,
        goodPairs: values[`good:${row.size}`] ?? 0,
        rejectPairs: values[`reject:${row.size}`] ?? 0,
        reworkPairs: values[`rework:${row.size}`] ?? 0,
      })),
    });
    writeDrafts([draft, ...drafts]);
    setValues({});
    setRemarks("");
    setSavedMessage("Draft saved on this device. Review and sync when online.");
  }

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
    <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
      <div className={`mb-3 rounded-lg px-3 py-2 text-xs font-black ${
        online ? "bg-emerald-50 text-emerald-800" : "bg-amber-100 text-amber-900"
      }`}>
        {online
          ? "Online · direct submission available"
          : "Offline · save a device draft; submission is paused"}
      </div>
      <form
        action={createFactoryProductionEntryAction}
        onSubmit={(event) => {
          if (!navigator.onLine) {
            event.preventDefault();
            saveOfflineDraft();
          }
        }}
      >
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
          <input
            name="remarks"
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            placeholder="Today’s production note"
            className="mt-1 h-11 w-full rounded-lg border border-gray-200 px-3 font-normal"
          />
        </label>
        {invalid ? <p className="mt-2 text-xs font-bold text-red-600">One or more sizes exceed the remaining quantity.</p> : null}
        {savedMessage ? <p className="mt-2 text-xs font-bold text-blue-700">{savedMessage}</p> : null}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 p-3">
          <div className="text-xs font-bold text-gray-600">
            Received {processed} · Good {totals.good} · Reject {totals.reject} · Rework {totals.rework}
            <br />
            Wage preview: Rs. {(totals.good * wageRate).toLocaleString("en-IN")}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={processed <= 0 || invalid}
              onClick={saveOfflineDraft}
              className="min-h-11 rounded-xl border border-blue-600 px-4 text-sm font-black text-blue-700 disabled:opacity-50"
            >
              Save device draft
            </button>
            <FormSubmitButton
              disabled={processed <= 0 || invalid || !online}
              pendingLabel="Submitting…"
              className="min-h-11 rounded-xl bg-brand-green px-5 text-sm font-black text-white"
            >
              Submit production entry
            </FormSubmitButton>
          </div>
        </div>
      </form>

      {drafts.length > 0 ? (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs font-black uppercase tracking-wider text-blue-900">
            Device drafts · review before sync
          </p>
          <div className="mt-3 space-y-2">
            {drafts.map((draft) => (
              <div key={draft.id} className="rounded-xl bg-white p-3 text-xs text-gray-700">
                <p className="font-black text-brand-green-ink">
                  {new Date(draft.createdAt).toLocaleString("en-NP")}
                </p>
                <p className="mt-1">
                  {draft.sizes.map((row) => `${row.size}: G${row.goodPairs}/R${row.rejectPairs}/RW${row.reworkPairs}`).join(" · ")}
                </p>
                <p className="mt-1 text-gray-500">{draft.remarks || "No remarks."}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <form action={createFactoryProductionEntryAction}>
                    <input type="hidden" name="assignmentId" value={assignmentId} />
                    <input type="hidden" name="offlineDraftId" value={draft.id} />
                    <input type="hidden" name="remarks" value={draft.remarks} />
                    {draft.sizes.flatMap((row) => [
                      <input key={`g-${row.size}`} type="hidden" name={`good__${row.size}`} value={row.goodPairs} />,
                      <input key={`r-${row.size}`} type="hidden" name={`reject__${row.size}`} value={row.rejectPairs} />,
                      <input key={`rw-${row.size}`} type="hidden" name={`rework__${row.size}`} value={row.reworkPairs} />,
                    ])}
                    <FormSubmitButton
                      disabled={!online}
                      pendingLabel="Syncing…"
                      className="min-h-10 rounded-lg bg-blue-700 px-4 font-black text-white"
                    >
                      Review complete · sync
                    </FormSubmitButton>
                  </form>
                  <button
                    type="button"
                    onClick={() => writeDrafts(drafts.filter((entry) => entry.id !== draft.id))}
                    className="min-h-10 rounded-lg border border-red-200 px-4 font-black text-red-700"
                  >
                    Delete draft
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
