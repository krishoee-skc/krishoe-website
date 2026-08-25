"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { useCallback, useEffect, useState } from "react";
import {
  FACTORY_WORKER_CATEGORIES,
  FACTORY_WORKER_TYPES,
  FACTORY_WORKER_TYPE_LABELS,
  type FactoryWorkerType,
} from "@/lib/factory-worker-options";

type Worker = {
  id: string;
  name: string;
  worker_type: string;
  category: string;
  monthly_salary: number | null;
  weekly_advance: number | null;
  status: string;
};

const categories = FACTORY_WORKER_CATEGORIES;

const inputClass = "min-h-12 w-full rounded-xl border border-brand-green-line bg-brand-paper px-3 py-2 text-brand-green-ink";

export default function WorkersPage() {
  const { text } = useLanguage();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [edits, setEdits] = useState<Record<string, { name: string; category: string; worker_type: string }>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    worker_type: "piece_rate",
    category: "Upper",
    monthly_salary: "",
    weekly_advance: "",
  });

  const loadWorkers = useCallback(async () => {
    setLoading(true);
    try {
      // Retired workers included, because this is the only screen that can
      // bring one back. Every other list and form still hides them.
      const response = await fetch("/api/factory/workers?include=retired", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Workers could not be loaded.");
      const nextWorkers = (data.workers || []) as Worker[];
      setWorkers(nextWorkers);
      setEdits(
        Object.fromEntries(
          nextWorkers.map((worker) => [
            worker.id,
            { name: worker.name, category: worker.category, worker_type: worker.worker_type },
          ]),
        ),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Workers could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadId = window.setTimeout(() => void loadWorkers(), 0);
    return () => window.clearTimeout(loadId);
  }, [loadWorkers]);

  async function createWorker(event: React.FormEvent) {
    event.preventDefault();
    setSaving("new");
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/factory/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          monthly_salary: formData.monthly_salary ? Number(formData.monthly_salary) : null,
          weekly_advance: formData.weekly_advance ? Number(formData.weekly_advance) : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Worker could not be created.");
      setFormData({ name: "", worker_type: "piece_rate", category: "Upper", monthly_salary: "", weekly_advance: "" });
      setShowForm(false);
      setMessage("Worker created and HR link saved.");
      await loadWorkers();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Worker could not be created.");
    } finally {
      setSaving("");
    }
  }

  /**
   * Correct what was typed, or take someone off the forms.
   *
   * A worker record was created by typing a name while entering work, and none
   * of it could be changed afterwards. A name mistyped once printed on that
   * person's payslip every month after; someone who left the factory stayed in
   * every dropdown, waiting for a day's work to be entered against them.
   *
   * Changing the stage is safe for the reason it looks dangerous: every row of
   * daily work already carries the rate and the amount it was paid at, so a
   * correction moves what happens next and never rewrites last month's wages.
   */
  async function saveWorker(workerId: string, patch: Record<string, string>) {
    setSaving(workerId);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/factory/workers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worker_id: workerId, ...patch }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Worker could not be saved.");
      setMessage(
        patch.status === "inactive"
          ? text(
              "Closed — they no longer appear on the work form. Past wages are untouched.",
              "बन्द भयो — अब काम भर्ने फारममा देखिँदैन। पुरानो ज्याला जस्ताको तस्तै छ।",
            )
          : patch.status === "active"
            ? text(
                "Active again — they appear on the work form.",
                "फेरि चालु भयो — अब काम भर्ने फारममा देखिन्छ।",
              )
            : text(
                "Saved — past wages are untouched.",
                "सच्चियो — पुरानो ज्याला जस्ताको तस्तै छ।",
              ),
      );
      await loadWorkers();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Worker could not be saved.");
    } finally {
      setSaving("");
    }
  }

  return (
    <section className="p-4 pb-28 sm:p-6 sm:pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green">
            {text("Factory people", "कारखानाका मान्छे")}
          </p>
          <h1 className="mt-2 text-2xl font-black text-brand-green-ink sm:text-3xl">
            {text("Workers and HR linkage", "कामदार")}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-muted">
            Wages, piece rates and the worker portal all run from this list — nothing here needs an HR link. The link is only required to use Work Orders and the production-accounts ledger, so leaving it empty costs nothing.
          </p>
        </div>
        <button type="button" onClick={() => setShowForm((value) => !value)} className="min-h-11 rounded-full bg-brand-green px-5 text-sm font-black text-white">
          {showForm ? "Close form" : "+ Add worker"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
        <span className="rounded-full bg-brand-mist px-3 py-1.5 text-brand-muted">
          {text(
            `${workers.filter((worker) => worker.status === "active").length} working`,
            `${workers.filter((worker) => worker.status === "active").length} जना काममा`,
          )}
        </span>
      </div>

      {message ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-900">{message}</p> : null}
      {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-900">{error}</p> : null}

      {showForm ? (
        <form onSubmit={createWorker} className="mt-6 grid max-w-3xl gap-4 rounded-3xl border border-brand-green-line bg-brand-paper p-5 shadow-sm sm:grid-cols-2">
          <label className="text-sm font-bold">Name<input value={formData.name} onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))} className={`${inputClass} mt-2`} required /></label>
          <label className="text-sm font-bold">{text("Worker type", "कस्तो कामदार")}<select value={formData.worker_type} onChange={(event) => setFormData((current) => ({ ...current, worker_type: event.target.value }))} className={`${inputClass} mt-2`}><option value="piece_rate">{text("Piece rate", "ज्यालामा")}</option><option value="daily_staff">{text("Daily staff", "दैनिक")}</option><option value="monthly_staff">{text("Monthly staff", "मासिक तलबमा")}</option></select></label>
          <label className="text-sm font-bold">{text("Factory stage", "कारखानाको कुन चरण")}<select value={formData.category} onChange={(event) => setFormData((current) => ({ ...current, category: event.target.value }))} className={`${inputClass} mt-2`}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label className="text-sm font-bold">{text("Monthly salary", "मासिक तलब")}<input type="number" min="0" step="0.01" value={formData.monthly_salary} onChange={(event) => setFormData((current) => ({ ...current, monthly_salary: event.target.value }))} className={`${inputClass} mt-2`} /></label>
          <label className="text-sm font-bold">{text("Usual Saturday kharcha", "शनिबारको खर्च")}<input type="number" min="0" step="0.01" value={formData.weekly_advance} onChange={(event) => setFormData((current) => ({ ...current, weekly_advance: event.target.value }))} className={`${inputClass} mt-2`} /></label>
          <button disabled={saving === "new"} className="min-h-12 rounded-xl bg-brand-green px-5 font-black text-white disabled:opacity-60 sm:col-span-2">{saving === "new" ? "Saving..." : "Save worker"}</button>
        </form>
      ) : null}

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {loading ? <p className="text-sm text-brand-muted">{text("Loading workers…", "कामदार खुल्दैछन्…")}</p> : null}
        {!loading && workers.length === 0 ? <p className="rounded-2xl border border-brand-green-line bg-brand-paper p-5 text-sm text-brand-muted">{text("No factory workers yet.", "कारखानामा अझै कामदार थपिएको छैन।")}</p> : null}
        {workers.map((worker) => (
          <article key={worker.id} className={`rounded-3xl border p-5 shadow-sm ${worker.status !== "active" ? "border-brand-green-line bg-brand-paper-deep" : "border-brand-green-line bg-brand-paper"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className={`text-lg font-black ${worker.status !== "active" ? "text-brand-muted line-through" : "text-brand-green-ink"}`}>{worker.name}</h2>
                <p className="mt-1 text-xs font-semibold text-brand-muted">{worker.category} · {worker.worker_type.replaceAll("_", " ")}</p>
              </div>
              {worker.status !== "active" ? (
                <span className="rounded-full bg-brand-green-line px-3 py-1 text-xs font-black text-brand-muted-deep">
                  {text("Closed", "बन्द")}
                </span>
              ) : null}
              {/* Grey, not amber. An unlinked worker is not a fault: wages, piece
                  rates and the worker portal all read this list directly, and
                  the HR link only matters for Work Orders. Amber read as "fix
                  me" and pointed at a module holding no attendance or payroll. */}
            </div>

            {/* What was typed can be typed again. The stage list comes from
                lib/factory-worker-options so it cannot drift from what the
                database will accept — it had already lost "Fibermen", which is
                where five of this shop's eight workers work, so their stage
                could not have been saved back. */}
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <label className="text-xs font-black uppercase tracking-wide text-brand-muted">
                {text("Name", "नाम")}
                <input
                  value={edits[worker.id]?.name ?? worker.name}
                  onChange={(event) =>
                    setEdits((current) => ({
                      ...current,
                      [worker.id]: { ...current[worker.id], name: event.target.value },
                    }))
                  }
                  className={`mt-1 ${inputClass}`}
                  aria-label={`Name for ${worker.name}`}
                />
              </label>
              <label className="text-xs font-black uppercase tracking-wide text-brand-muted">
                {text("Factory stage", "कारखानाको चरण")}
                <select
                  value={edits[worker.id]?.category ?? worker.category}
                  onChange={(event) =>
                    setEdits((current) => ({
                      ...current,
                      [worker.id]: { ...current[worker.id], category: event.target.value },
                    }))
                  }
                  className={`mt-1 ${inputClass}`}
                  aria-label={`Stage for ${worker.name}`}
                >
                  {FACTORY_WORKER_CATEGORIES.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-black uppercase tracking-wide text-brand-muted">
                {text("Wage type", "ज्यालाको किसिम")}
                <select
                  value={edits[worker.id]?.worker_type ?? worker.worker_type}
                  onChange={(event) =>
                    setEdits((current) => ({
                      ...current,
                      [worker.id]: { ...current[worker.id], worker_type: event.target.value },
                    }))
                  }
                  className={`mt-1 ${inputClass}`}
                  aria-label={`Pay type for ${worker.name}`}
                >
                  {FACTORY_WORKER_TYPES.map((option) => (
                    <option key={option} value={option}>{FACTORY_WORKER_TYPE_LABELS[option as FactoryWorkerType]}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => void saveWorker(worker.id, edits[worker.id] ?? {})}
                disabled={
                  saving === worker.id ||
                  ((edits[worker.id]?.name ?? worker.name) === worker.name &&
                    (edits[worker.id]?.category ?? worker.category) === worker.category &&
                    (edits[worker.id]?.worker_type ?? worker.worker_type) === worker.worker_type)
                }
                className="mt-5 min-h-12 rounded-xl bg-brand-green px-4 text-sm font-black text-white disabled:bg-brand-green-line disabled:text-brand-muted-soft"
              >
                {saving === worker.id ? text("Saving…", "गर्दैछौँ…") : text("Save", "सच्याउने")}
              </button>
            </div>

            <button
              type="button"
              onClick={() => void saveWorker(worker.id, { status: worker.status === "active" ? "inactive" : "active" })}
              disabled={saving === worker.id}
              className={`mt-3 min-h-12 w-full rounded-xl border px-4 text-sm font-bold disabled:opacity-60 ${worker.status === "active" ? "border-brand-green-line text-brand-muted" : "border-brand-green font-black text-brand-green"}`}
            >
              {saving === worker.id
                ? text("Saving…", "गर्दैछौँ…")
                : worker.status === "active"
                  ? text(
                      "Close — remove from the work form",
                      "बन्द गर्ने — काम भर्ने फारमबाट हटाउने",
                    )
                  : text("Make active again", "फेरि चालु गर्ने")}
            </button>

            <div className="mt-4 flex flex-wrap gap-3 text-sm font-bold">
              <Link href={worker.worker_type === "piece_rate" ? `/admin/factory/ledger?workerId=${worker.id}` : `/admin/factory/salary?workerId=${worker.id}`} className="text-brand-green underline underline-offset-4">{worker.worker_type === "piece_rate" ? "Worker ledger" : "Salary ledger"}</Link>
            </div>
          </article>
        ))}
      </div>

      <p className="mt-5 text-xs leading-5 text-brand-muted">Only the Owner can create workers or change HR links. Linking does not delete or merge any historical record.</p>
    </section>
  );
}
