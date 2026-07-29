"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Worker {
  id: string;
  name: string;
  category: string;
  worker_type: string;
}

interface Item {
  id: string;
  name: string;
  code: string;
}

export default function AddWorkPage() {
  const router = useRouter();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    worker_id: "",
    item_id: "",
    color: "",
    size: "",
    pairs_count: "",
    status: "completed",
  });

  const [selectedRate, setSelectedRate] = useState<number | null>(null);
  const [calculatedAmount, setCalculatedAmount] = useState<number>(0);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [workersRes, itemsRes] = await Promise.all([
          fetch("/api/factory/workers"),
          fetch("/api/factory/items"),
        ]);

        const workersData = await workersRes.json();
        const itemsData = await itemsRes.json();

        setWorkers(workersData.workers || []);
        setItems(itemsData.items || []);
      } catch (err) {
        setError("Failed to load workers and items");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleWorkerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const workerId = e.target.value;
    setFormData((prev) => ({ ...prev, worker_id: workerId }));
  };

  const handleItemChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const itemId = e.target.value;
    setFormData((prev) => ({ ...prev, item_id: itemId }));

    // Fetch rate for this worker and item
    if (formData.worker_id && itemId) {
      const selectedWorker = workers.find((w) => w.id === formData.worker_id);
      if (selectedWorker) {
        try {
          const res = await fetch(
            `/api/factory/rates?itemId=${itemId}&workerCategory=${selectedWorker.category}`
          );
          const data = await res.json();
          if (data.rates && data.rates.length > 0) {
            setSelectedRate(data.rates[0].rate_per_pair);
          } else {
            setSelectedRate(null);
            setError(`No rate found for ${selectedWorker.category} on this product`);
          }
        } catch (err) {
          setError("Failed to fetch rate");
          console.error(err);
        }
      }
    }
  };

  const handlePairsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pairs = parseInt(e.target.value) || 0;
    setFormData((prev) => ({ ...prev, pairs_count: e.target.value }));

    if (selectedRate && pairs > 0) {
      setCalculatedAmount(pairs * selectedRate);
    } else {
      setCalculatedAmount(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    if (!formData.worker_id || !formData.item_id || !formData.pairs_count) {
      setError("Please fill in all required fields");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/factory/work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to save work entry");
      }

      setSuccess("✅ Work entry saved successfully!");
      setFormData({
        date: new Date().toISOString().split("T")[0],
        worker_id: "",
        item_id: "",
        color: "",
        size: "",
        pairs_count: "",
        status: "completed",
      });
      setSelectedRate(null);
      setCalculatedAmount(0);

      // Redirect back to dashboard after 1.5 seconds
      setTimeout(() => {
        router.push("/admin/factory");
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save work entry");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 text-center">
        <div className="animate-pulse text-slate-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6">➕ Add Daily Work Entry</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-slate-200 p-4 sm:p-6 space-y-4 sm:space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
            {success}
          </div>
        )}

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-slate-900 mb-2">📅 Date</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
            className="w-full min-h-12 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        {/* Worker */}
        <div>
          <label className="block text-sm font-medium text-slate-900 mb-2">👤 Worker</label>
          <select
            value={formData.worker_id}
            onChange={handleWorkerChange}
            className="w-full min-h-12 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Select a worker...</option>
            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.name} ({worker.category})
              </option>
            ))}
          </select>
        </div>

        {/* Item/Product */}
        <div>
          <label className="block text-sm font-medium text-slate-900 mb-2">🛞 Product</label>
          <select
            value={formData.item_id}
            onChange={handleItemChange}
            className="w-full min-h-12 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Select a product...</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        {/* Color */}
        <div>
          <label className="block text-sm font-medium text-slate-900 mb-2">🎨 Color (Optional)</label>
          <input
            type="text"
            value={formData.color}
            onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
            placeholder="e.g., Black, Blue, Red"
            className="w-full min-h-12 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Size */}
        <div>
          <label className="block text-sm font-medium text-slate-900 mb-2">📏 Size (Optional)</label>
          <input
            type="text"
            value={formData.size}
            onChange={(e) => setFormData((prev) => ({ ...prev, size: e.target.value }))}
            placeholder="e.g., 7, 8, 9"
            className="w-full min-h-12 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Pairs */}
        <div>
          <label className="block text-sm font-medium text-slate-900 mb-2">🔢 Number of Pairs</label>
          <input
            type="number"
            value={formData.pairs_count}
            onChange={handlePairsChange}
            placeholder="Enter number of pairs"
            min="1"
            className="w-full min-h-12 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-slate-900 mb-2">✅ Status</label>
          <div className="space-y-2">
            {[
              { value: "completed", label: "✅ Completed" },
              { value: "in_progress", label: "⏳ In Progress" },
              { value: "rework", label: "🔄 Rework" },
            ].map((option) => (
              <label key={option.value} className="flex items-center">
                <input
                  type="radio"
                  name="status"
                  value={option.value}
                  checked={formData.status === option.value}
                  onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="ml-2 text-sm text-slate-700">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Rate Display */}
        {selectedRate !== null && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm text-blue-900">
              <strong>💰 Rate:</strong> Rs. {selectedRate} per pair
            </div>
            <div className="text-sm text-blue-900 mt-2">
              <strong>💵 Total Amount:</strong> {formData.pairs_count} pairs × Rs. {selectedRate} = <span className="text-lg font-bold">Rs. {calculatedAmount.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors min-h-12 flex items-center justify-center"
          >
            {submitting ? "Saving..." : "✅ Save Work Entry"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/factory")}
            className="flex-1 bg-slate-300 hover:bg-slate-400 text-slate-900 font-semibold py-3 px-4 rounded-lg transition-colors min-h-12 flex items-center justify-center"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
