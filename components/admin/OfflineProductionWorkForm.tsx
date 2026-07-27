"use client";

import { useEffect, useRef, useState } from "react";
import FormSubmitButton from "@/components/admin/FormSubmitButton";

type Option = { id: string; label: string };
const storageKey = "krishoe-production-work-draft-v1";
const input = "min-h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-brand-green-ink outline-none focus:border-brand-green";
const button = "min-h-12 rounded-xl bg-brand-green px-5 text-sm font-black text-white transition hover:bg-brand-green-ink";

function newSubmissionKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export default function OfflineProductionWorkForm({
  action, workOrders, employees, items, stages, today, className,
}: {
  action: (formData: FormData) => Promise<void>;
  workOrders: Option[];
  employees: Option[];
  items: Option[];
  stages: string[];
  today: string;
  className: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [message, setMessage] = useState("");

  function saveDraft(form = formRef.current) {
    if (!form) return;
    window.localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(new FormData(form).entries())));
    setMessage(online ? "Draft saved on this device." : "Offline draft saved. Submit after internet returns.");
  }

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const raw = window.localStorage.getItem(storageKey);
    if (raw && formRef.current) {
      try {
        const values = JSON.parse(raw) as Record<string, string>;
        for (const [name, value] of Object.entries(values)) {
          const field = formRef.current.elements.namedItem(name);
          if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) field.value = value;
        }
        queueMicrotask(() => setMessage("Saved production draft restored. Review before submitting."));
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    }
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  async function submit(formData: FormData) {
    if (!navigator.onLine) {
      saveDraft();
      return;
    }
    setMessage("Submitting reviewed draft…");
    try {
      await action(formData);
      window.localStorage.removeItem(storageKey);
      formRef.current?.reset();
      const key = formRef.current?.elements.namedItem("sourceSubmissionKey");
      if (key instanceof HTMLInputElement) key.value = newSubmissionKey();
      setMessage("Completed work approved and offline draft cleared.");
    } catch (error) {
      saveDraft();
      setMessage(error instanceof Error ? error.message : "Submit failed. Draft remains saved.");
    }
  }

  return (
    <form ref={formRef} action={submit} onChange={() => saveDraft()} className={className}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-brand-green-ink">6. Completed work</h2>
          <p className="mt-1 text-sm text-gray-500">After handover, enter it here. Weak internet keeps the draft on this device.</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${online ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
          {online ? "Online" : "Offline"}
        </span>
      </div>
      <input type="hidden" name="sourceSubmissionKey" defaultValue={newSubmissionKey()} />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <select name="workOrderId" className={`${input} sm:col-span-2`} defaultValue="">
          <option value="">No Work Order link (legacy/manual)</option>
          {workOrders.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
        </select>
        <select name="employeeId" className={input} required defaultValue="">
          <option value="" disabled>Select worker</option>
          {employees.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
        </select>
        <select name="itemId" className={input} required defaultValue="">
          <option value="" disabled>Select item</option>
          {items.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
        </select>
        <select name="stage" className={input}>{stages.map((stage) => <option key={stage}>{stage}</option>)}</select>
        <input name="workDate" type="date" className={input} defaultValue={today} required />
        <input name="totalPairs" type="number" min="1" className={input} placeholder="Total completed pairs" required />
        <input name="sizeBreakdown" className={input} placeholder="Optional: 36:10, 37:15" />
        <input name="rejectedPairs" type="number" min="0" className={input} placeholder="Rejected pairs" defaultValue="0" />
        <input name="reworkPairs" type="number" min="0" className={input} placeholder="Rework pairs" defaultValue="0" />
        <input name="note" className={`${input} sm:col-span-2`} placeholder="Remark (optional)" />
      </div>
      {message ? <p className="mt-3 text-xs font-bold text-gray-600" aria-live="polite">{message}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <FormSubmitButton className={button} pendingLabel="Approving work…">
          {online ? "Approve completed work" : "Save offline draft"}
        </FormSubmitButton>
        <button type="button" onClick={() => saveDraft()} className="min-h-12 rounded-xl border border-gray-200 bg-white px-4 text-sm font-black text-brand-green-ink">
          Save draft
        </button>
      </div>
    </form>
  );
}
