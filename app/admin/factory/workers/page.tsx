"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Worker = {
  id: string;
  name: string;
  worker_type: string;
  category: string;
  monthly_salary: number | null;
  weekly_advance: number | null;
  status: string;
  hr_employee_id: string | null;
  hr_employee_name: string | null;
};

type HrEmployee = {
  id: string;
  name: string;
  phone: string;
  department: string;
  salary_type: string;
};

const categories = [
  "Upper",
  "Fiber Preparation",
  "Fiber Silai",
  "Bottom Final",
  "Packing / QC",
  "Staff",
] as const;

const inputClass = "min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900";

function factoryTypeForSalary(salaryType: string) {
  if (salaryType === "Piece Rate") return "piece_rate";
  if (salaryType === "Daily") return "daily_staff";
  return "monthly_staff";
}

function factoryCategoryForDepartment(department: string) {
  if (department === "Upper") return "Upper";
  if (department === "Fiber Preparation") return "Fiber Preparation";
  if (department === "Fiber Silai") return "Fiber Silai";
  if (department === "Bottom Final") return "Bottom Final";
  if (department === "Packing" || department === "QC") return "Packing / QC";
  return "Staff";
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [hrEmployees, setHrEmployees] = useState<HrEmployee[]>([]);
  const [linkDrafts, setLinkDrafts] = useState<Record<string, string>>({});
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
    hr_employee_id: "",
  });

  const loadWorkers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/factory/workers", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Workers could not be loaded.");
      const nextWorkers = (data.workers || []) as Worker[];
      setWorkers(nextWorkers);
      setHrEmployees((data.hrEmployees || []) as HrEmployee[]);
      setLinkDrafts(Object.fromEntries(nextWorkers.map((worker) => [worker.id, worker.hr_employee_id || ""])));
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

  const linkedEmployeeIds = useMemo(
    () => new Set(workers.map((worker) => worker.hr_employee_id).filter(Boolean)),
    [workers],
  );

  function chooseHrEmployee(id: string) {
    const employee = hrEmployees.find((item) => item.id === id);
    setFormData((current) => ({
      ...current,
      hr_employee_id: id,
      name: employee?.name || current.name,
      worker_type: employee ? factoryTypeForSalary(employee.salary_type) : current.worker_type,
      category: employee ? factoryCategoryForDepartment(employee.department) : current.category,
    }));
  }

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
      setFormData({ name: "", worker_type: "piece_rate", category: "Upper", monthly_salary: "", weekly_advance: "", hr_employee_id: "" });
      setShowForm(false);
      setMessage("Worker created and HR link saved.");
      await loadWorkers();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Worker could not be created.");
    } finally {
      setSaving("");
    }
  }

  async function saveHrLink(workerId: string) {
    setSaving(workerId);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/factory/workers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worker_id: workerId, hr_employee_id: linkDrafts[workerId] || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "HR link could not be saved.");
      setMessage("Factory worker and HR employee are now linked.");
      await loadWorkers();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "HR link could not be saved.");
    } finally {
      setSaving("");
    }
  }

  return (
    <section className="p-4 pb-28 sm:p-6 sm:pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green">Factory people</p>
          <h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">Workers and HR linkage</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Link each factory worker to one permanent HR Employee ID. Factory wages, attendance and payroll then belong to the same person even if their name changes.
          </p>
        </div>
        <button type="button" onClick={() => setShowForm((value) => !value)} className="min-h-11 rounded-full bg-brand-green px-5 text-sm font-black text-white">
          {showForm ? "Close form" : "+ Add worker"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
        <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-900">{workers.filter((worker) => worker.hr_employee_id).length} linked</span>
        <span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-900">{workers.filter((worker) => !worker.hr_employee_id).length} need linking</span>
        <Link href="/admin/hr" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-brand-green underline">Open HR employees</Link>
      </div>

      {message ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-900">{message}</p> : null}
      {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-900">{error}</p> : null}

      {showForm ? (
        <form onSubmit={createWorker} className="mt-6 grid max-w-3xl gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-bold">Existing HR employee (recommended)</label>
            <select value={formData.hr_employee_id} onChange={(event) => chooseHrEmployee(event.target.value)} className={inputClass}>
              <option value="">Create without HR link</option>
              {hrEmployees.filter((employee) => !linkedEmployeeIds.has(employee.id)).map((employee) => (
                <option key={employee.id} value={employee.id}>{employee.name} · {employee.department} · {employee.phone || "No phone"}</option>
              ))}
            </select>
          </div>
          <label className="text-sm font-bold">Name<input value={formData.name} onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))} className={`${inputClass} mt-2`} required /></label>
          <label className="text-sm font-bold">Worker type<select value={formData.worker_type} onChange={(event) => setFormData((current) => ({ ...current, worker_type: event.target.value }))} className={`${inputClass} mt-2`}><option value="piece_rate">Piece rate</option><option value="daily_staff">Daily staff</option><option value="monthly_staff">Monthly staff</option></select></label>
          <label className="text-sm font-bold">Factory stage<select value={formData.category} onChange={(event) => setFormData((current) => ({ ...current, category: event.target.value }))} className={`${inputClass} mt-2`}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label className="text-sm font-bold">Monthly salary<input type="number" min="0" step="0.01" value={formData.monthly_salary} onChange={(event) => setFormData((current) => ({ ...current, monthly_salary: event.target.value }))} className={`${inputClass} mt-2`} /></label>
          <label className="text-sm font-bold">Usual Saturday kharcha<input type="number" min="0" step="0.01" value={formData.weekly_advance} onChange={(event) => setFormData((current) => ({ ...current, weekly_advance: event.target.value }))} className={`${inputClass} mt-2`} /></label>
          <button disabled={saving === "new"} className="min-h-12 rounded-xl bg-brand-green px-5 font-black text-white disabled:opacity-60 sm:col-span-2">{saving === "new" ? "Saving..." : "Save worker"}</button>
        </form>
      ) : null}

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {loading ? <p className="text-sm text-slate-500">Loading workers...</p> : null}
        {!loading && workers.length === 0 ? <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">No factory workers yet.</p> : null}
        {workers.map((worker) => (
          <article key={worker.id} className={`rounded-3xl border bg-white p-5 shadow-sm ${worker.hr_employee_id ? "border-emerald-200" : "border-amber-200"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-950">{worker.name}</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">{worker.category} · {worker.worker_type.replaceAll("_", " ")}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${worker.hr_employee_id ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>{worker.hr_employee_id ? "HR linked" : "Link needed"}</span>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
              <select value={linkDrafts[worker.id] || ""} onChange={(event) => setLinkDrafts((current) => ({ ...current, [worker.id]: event.target.value }))} className={inputClass} aria-label={`HR employee for ${worker.name}`}>
                <option value="">Not linked</option>
                {hrEmployees.filter((employee) => !linkedEmployeeIds.has(employee.id) || employee.id === worker.hr_employee_id).map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.name} · {employee.department}</option>
                ))}
              </select>
              <button type="button" onClick={() => void saveHrLink(worker.id)} disabled={saving === worker.id || (linkDrafts[worker.id] || "") === (worker.hr_employee_id || "")} className="min-h-12 rounded-xl border border-brand-green px-4 text-sm font-black text-brand-green disabled:border-slate-200 disabled:text-slate-400">{saving === worker.id ? "Saving..." : "Save HR link"}</button>
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-sm font-bold">
              <Link href={worker.worker_type === "piece_rate" ? `/admin/factory/ledger?workerId=${worker.id}` : `/admin/factory/salary?workerId=${worker.id}`} className="text-brand-green underline underline-offset-4">{worker.worker_type === "piece_rate" ? "Worker ledger" : "Salary ledger"}</Link>
              {worker.hr_employee_id ? <Link href={`/admin/hr/employee/${worker.hr_employee_id}`} className="text-slate-600 underline underline-offset-4">HR profile</Link> : null}
            </div>
          </article>
        ))}
      </div>

      <p className="mt-5 text-xs leading-5 text-slate-500">Only the Owner can create workers or change HR links. Linking does not delete or merge any historical record.</p>
    </section>
  );
}
