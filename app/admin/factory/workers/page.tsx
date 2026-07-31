"use client";

import { useCallback, useEffect, useState } from "react";

interface Worker {
  id: string;
  name: string;
  worker_type: string;
  category: string;
  monthly_salary: number;
  weekly_advance: number;
  status: string;
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    worker_type: "piece_rate",
    category: "Upper",
    monthly_salary: "",
    weekly_advance: "",
  });

  const loadWorkers = useCallback(async () => {
    try {
      const res = await fetch("/api/factory/workers");
      const data = await res.json();
      setWorkers(data.workers || []);
    } catch (error) {
      console.error("Error loading workers:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/factory/workers", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        setWorkers(data.workers || []);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.error("Error loading workers:", error);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/factory/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          worker_type: formData.worker_type,
          category: formData.category,
          monthly_salary: formData.monthly_salary ? parseInt(formData.monthly_salary) : null,
          weekly_advance: formData.weekly_advance ? parseInt(formData.weekly_advance) : null,
        }),
      });

      if (res.ok) {
        setFormData({
          name: "",
          worker_type: "piece_rate",
          category: "Upper",
          monthly_salary: "",
          weekly_advance: "",
        });
        setShowForm(false);
        loadWorkers();
      }
    } catch (error) {
      alert("Error creating worker: " + error);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">👥 Workers</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          {showForm ? "Cancel" : "➕ Add Worker"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Add New Worker</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full min-h-12 px-3 py-2 border border-slate-300 rounded-lg"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">Type</label>
                <select
                  value={formData.worker_type}
                  onChange={(e) => setFormData((prev) => ({ ...prev, worker_type: e.target.value }))}
                  className="w-full min-h-12 px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="piece_rate">Piece Rate</option>
                  <option value="monthly_staff">Monthly Staff</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full min-h-12 px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="Upper">Upper</option>
                  <option value="Fibermen">Fibermen</option>
                  <option value="Staff">Staff</option>
                </select>
              </div>
            </div>

            {formData.worker_type === "monthly_staff" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Monthly Salary
                  </label>
                  <input
                    type="number"
                    value={formData.monthly_salary}
                    onChange={(e) => setFormData((prev) => ({ ...prev, monthly_salary: e.target.value }))}
                    className="w-full min-h-12 px-3 py-2 border border-slate-300 rounded-lg"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Weekly Advance
                  </label>
                  <input
                    type="number"
                    value={formData.weekly_advance}
                    onChange={(e) => setFormData((prev) => ({ ...prev, weekly_advance: e.target.value }))}
                    className="w-full min-h-12 px-3 py-2 border border-slate-300 rounded-lg"
                    min="0"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors min-h-12"
            >
              Create Worker
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center text-slate-500">Loading workers...</div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr className="text-xs sm:text-sm text-slate-600 font-semibold">
                <th className="text-left py-3 px-2 sm:px-4">Name</th>
                <th className="text-left py-3 px-2 sm:px-4">Type</th>
                <th className="text-left py-3 px-2 sm:px-4">Category</th>
                <th className="text-center py-3 px-2 sm:px-4">Salary/Advance</th>
                <th className="text-center py-3 px-2 sm:px-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {workers.length > 0 ? (
                workers.map((worker) => (
                  <tr key={worker.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-2 sm:px-4 font-medium text-slate-900">
                      {worker.name}
                    </td>
                    <td className="py-3 px-2 sm:px-4 text-slate-600">
                      <span className="text-xs bg-slate-100 px-2 py-1 rounded capitalize">
                        {worker.worker_type.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3 px-2 sm:px-4 text-slate-600">
                      {worker.category}
                    </td>
                    <td className="py-3 px-2 sm:px-4 text-center text-slate-900">
                      {worker.worker_type === "monthly_staff" && worker.monthly_salary ? (
                        <div>
                          <div className="text-xs text-slate-600">Rs. {worker.monthly_salary}</div>
                          <div className="text-xs text-slate-600">
                            Advance: Rs. {worker.weekly_advance}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="py-3 px-2 sm:px-4 text-center">
                      <a
                        href={`/admin/factory/ledger?workerId=${worker.id}`}
                        className="text-blue-600 hover:text-blue-700 font-medium text-xs sm:text-sm"
                      >
                        View Ledger
                      </a>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No workers yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
