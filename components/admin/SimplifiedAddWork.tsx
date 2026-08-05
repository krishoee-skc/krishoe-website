"use client";

import { useState } from "react";
import { ChevronRightIcon, UserIcon, PackageIcon, CheckIcon } from "@/components/Icons";

interface Worker {
  id: string;
  name: string;
  category: string;
  lastItem?: string;
  todayPairs?: number;
}

interface Product {
  id: string;
  name: string;
  rate?: number;
}

interface WorkEntry {
  date: string;
  workerId: string;
  productId: string;
  pairs: number;
  status: "in-progress" | "completed" | "rework";
}

interface SimplifiedAddWorkProps {
  workers: Worker[];
  products: Product[];
  onSubmit: (entry: WorkEntry) => Promise<void>;
  onCancel: () => void;
}

type Step = 1 | 2 | 3;

export default function SimplifiedAddWork({
  workers,
  products,
  onSubmit,
  onCancel,
}: SimplifiedAddWorkProps) {
  const [step, setStep] = useState<Step>(1);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [pairs, setPairs] = useState("");
  const [status, setStatus] = useState<"completed" | "in-progress" | "rework">("completed");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkEntries, setBulkEntries] = useState<WorkEntry[]>([]);

  const today = new Date().toISOString().split("T")[0];

  // Group workers by category
  const groupedWorkers = {
    upper: workers.filter((w) => w.category === "Upper"),
    fibermen: workers.filter((w) => w.category === "Fibermen"),
  };

  // Top workers (highest today production)
  const topWorkers = [...workers]
    .sort((a, b) => (b.todayPairs || 0) - (a.todayPairs || 0))
    .slice(0, 3);

  // Recently used products
  const recentProducts = [...products]
    .filter((p) => selectedWorker?.lastItem === p.id || p.rate)
    .slice(0, 3);

  const calculateAmount = () => {
    if (!selectedProduct?.rate || !pairs) return 0;
    return parseInt(pairs) * selectedProduct.rate;
  };

  const handleWorkerClick = (worker: Worker) => {
    setSelectedWorker(worker);
    setStep(2);
  };

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setStep(3);
  };

  const handleAddToBulk = () => {
    if (!selectedWorker || !selectedProduct || !pairs) {
      setError("Please select worker, product, and enter pairs");
      return;
    }

    const entry: WorkEntry = {
      date: today,
      workerId: selectedWorker.id,
      productId: selectedProduct.id,
      pairs: parseInt(pairs),
      status,
    };

    setBulkEntries([...bulkEntries, entry]);
    setSelectedProduct(null);
    setPairs("");
    setStatus("completed");
    setError("");
  };

  const handleSubmitBulk = async () => {
    if (bulkEntries.length === 0) {
      setError("Add at least one work entry");
      return;
    }

    setSubmitting(true);
    try {
      for (const entry of bulkEntries) {
        await onSubmit(entry);
      }
      setBulkEntries([]);
      setSelectedWorker(null);
      setSelectedProduct(null);
      setPairs("");
      setStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitSingle = async () => {
    if (!selectedWorker || !selectedProduct || !pairs) {
      setError("Please complete all fields");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        date: today,
        workerId: selectedWorker.id,
        productId: selectedProduct.id,
        pairs: parseInt(pairs),
        status,
      });
      setSelectedWorker(null);
      setSelectedProduct(null);
      setPairs("");
      setStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-brand-green-ink">
          + काम भर्ने
        </h1>
        <p className="mt-2 text-sm text-gray-600">3-step simple work entry (30 seconds)</p>
      </div>

      {/* Progress Indicator */}
      <div className="mb-6 flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm ${
                step >= s
                  ? "bg-brand-green text-white"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              {s}
            </div>
            {s < 3 && (
              <div
                className={`h-1 w-8 ${
                  step > s ? "bg-brand-green" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* STEP 1: Worker Selection */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="rounded-lg border border-brand-green/20 bg-white p-4">
            <p className="text-sm font-bold text-brand-green-ink mb-3">
              👤 Step 1: कौन को काम?
            </p>

            {/* Top Workers Quick Buttons */}
            {topWorkers.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 mb-2">
                  आज को सितारा (Quick Select):
                </p>
                <div className="flex flex-wrap gap-2">
                  {topWorkers.map((worker) => (
                    <button
                      key={worker.id}
                      onClick={() => handleWorkerClick(worker)}
                      className="inline-flex items-center gap-2 rounded-lg bg-brand-green/10 px-3 py-2 text-sm font-bold text-brand-green-ink transition hover:bg-brand-green/20"
                    >
                      <UserIcon className="h-4 w-4" />
                      {worker.name}
                      <span className="text-xs opacity-70">({worker.todayPairs})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Worker Groups */}
            <div className="space-y-3">
              {/* Upper */}
              {groupedWorkers.upper.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">
                    UPPER WORKERS ({groupedWorkers.upper.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {groupedWorkers.upper.map((worker) => (
                      <button
                        key={worker.id}
                        onClick={() => handleWorkerClick(worker)}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-brand-green hover:bg-brand-green/5"
                      >
                        {worker.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Fibermen */}
              {groupedWorkers.fibermen.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">
                    FIBERMEN ({groupedWorkers.fibermen.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {groupedWorkers.fibermen.map((worker) => (
                      <button
                        key={worker.id}
                        onClick={() => handleWorkerClick(worker)}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-brand-green hover:bg-brand-green/5"
                      >
                        {worker.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={onCancel}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      )}

      {/* STEP 2: Product Selection */}
      {step === 2 && selectedWorker && (
        <div className="space-y-4">
          <div className="rounded-lg border border-brand-green/20 bg-white p-4">
            <p className="text-sm font-bold text-brand-green-ink mb-2">
              Selected: {selectedWorker.name}
            </p>
            <button
              onClick={() => setStep(1)}
              className="text-xs text-brand-green underline"
            >
              Change Worker
            </button>
          </div>

          <div className="rounded-lg border border-brand-green/20 bg-white p-4">
            <p className="text-sm font-bold text-brand-green-ink mb-3">
              🛞 Step 2: कुन product?
            </p>

            {/* Recent Products */}
            {recentProducts.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 mb-2">
                  हालै प्रयोग गरिएको:
                </p>
                <div className="flex flex-wrap gap-2">
                  {recentProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleProductClick(product)}
                      className="inline-flex items-center gap-2 rounded-lg bg-brand-green/10 px-3 py-2 text-sm font-bold text-brand-green-ink transition hover:bg-brand-green/20"
                    >
                      <PackageIcon className="h-4 w-4" />
                      {product.name}
                      {product.rate && (
                        <span className="text-xs opacity-70">
                          @Rs.{product.rate}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* All Products */}
            <div className="max-h-64 overflow-y-auto space-y-2">
              {products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleProductClick(product)}
                  className="w-full flex items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-brand-green hover:bg-brand-green/5"
                >
                  <span>{product.name}</span>
                  {product.rate && (
                    <span className="text-xs text-gray-500">Rs. {product.rate}/pair</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setStep(1)}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Back
          </button>
        </div>
      )}

      {/* STEP 3: Quantity & Review */}
      {step === 3 && selectedWorker && selectedProduct && (
        <div className="space-y-4">
          {/* Selected Info */}
          <div className="rounded-lg border border-brand-green/20 bg-white p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-600">Worker:</span>
                <span className="text-sm font-bold text-brand-green-ink">
                  {selectedWorker.name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-600">Product:</span>
                <span className="text-sm font-bold text-brand-green-ink">
                  {selectedProduct.name}
                </span>
              </div>
            </div>
          </div>

          {/* Quantity Input */}
          <div className="rounded-lg border border-brand-green/20 bg-white p-4">
            <label className="block text-sm font-bold text-brand-green-ink mb-3">
              🔢 Step 3: कति जोडी?
            </label>
            <input
              type="number"
              value={pairs}
              onChange={(e) => setPairs(e.target.value)}
              placeholder="Enter number of pairs"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg font-bold focus:border-brand-green focus:outline-none"
              autoFocus
              min="1"
            />
          </div>

          {/* Status Selection */}
          <div className="rounded-lg border border-brand-green/20 bg-white p-4">
            <p className="text-sm font-bold text-brand-green-ink mb-3">
              ✅ Status
            </p>
            <div className="space-y-2">
              {[
                { value: "completed" as const, label: "पूरा भयो (Completed)" },
                { value: "in-progress" as const, label: "आधा काम (In Progress)" },
                { value: "rework" as const, label: "फिर गर्न सक्छ (Rework)" },
              ].map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type="radio"
                    name="status"
                    value={option.value}
                    checked={status === option.value}
                    onChange={(e) =>
                      setStatus(e.target.value as typeof status)
                    }
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-semibold text-gray-700">
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Amount Display */}
          {selectedProduct.rate && pairs && (
            <div className="rounded-lg bg-brand-green/10 border border-brand-green/30 p-4">
              <p className="text-sm text-gray-600 mb-1">Auto-Calculated Amount:</p>
              <p className="text-3xl font-black text-brand-green-ink">
                Rs. {(calculateAmount()).toLocaleString()}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {pairs} pairs × Rs. {selectedProduct.rate} = Rs. {(calculateAmount()).toLocaleString()}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            <button
              onClick={handleSubmitSingle}
              disabled={submitting || !pairs}
              className="w-full bg-brand-green hover:bg-brand-green-ink disabled:bg-gray-300 text-white font-bold py-3 px-4 rounded-lg transition"
            >
              {submitting ? "Saving..." : "✅ Save & Add Next"}
            </button>
            <button
              onClick={() => setStep(2)}
              className="w-full border border-gray-300 bg-white text-gray-700 font-semibold py-3 px-4 rounded-lg transition hover:bg-gray-50"
            >
              Back to Product
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
