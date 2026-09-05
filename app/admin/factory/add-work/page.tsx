"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReadyToPost from "@/app/admin/factory/add-work/ReadyToPost";
import { createIdempotencyKeyRegistry } from "@/app/admin/factory/_components/idempotency-key";
import { nepalDateKey } from "@/app/admin/factory/_components/nepal-date";
import NepaliDateField from "@/components/admin/NepaliDateField";

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
  production_item_id: string | null;
}

interface WorkOrder {
  id: string;
  work_order_number: string;
  item_id: string;
  item_name_snapshot: string;
  colour: string;
  size_breakdown: Record<string, number>;
  planned_pairs: number;
  current_stage: string;
  status: string;
  due_date: string | null;
}

export default function AddWorkPage() {
  const router = useRouter();
  const { text } = useLanguage();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    date: nepalDateKey(),
    worker_id: "",
    item_id: "",
    work_order_id: "",
    color: "",
    size: "",
    pairs_count: "",
    reject_pairs: "",
    status: "completed",
  });

  const [selectedRate, setSelectedRate] = useState<number | null>(null);
  const [selectedRateSource, setSelectedRateSource] = useState("");
  const [calculatedAmount, setCalculatedAmount] = useState<number>(0);
  // Bumped when a work entry saves, so the panel below recounts what is made
  // against what is on the shelf without the page being reloaded by hand.
  const [workSaved, setWorkSaved] = useState(0);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [showAddProduct, setShowAddProduct] = useState(false);
  // Which half of the screen is showing: the entry form, or the post-to-stock
  // list. Only one at a time, so the page is short. "entry" first — that is what
  // this screen is opened to do.
  const [view, setView] = useState<"entry" | "post">("entry");
  const [newProductName, setNewProductName] = useState("");
  const [showSetRate, setShowSetRate] = useState(false);
  const [newRate, setNewRate] = useState("");
  const [idempotencyKeys] = useState(() => createIdempotencyKeyRegistry());

  useEffect(() => {
    const loadData = async () => {
      try {
        const [workersRes, itemsRes] = await Promise.all([
          fetch("/api/factory/workers"),
          fetch("/api/factory/items"),
        ]);

        const workersData = await workersRes.json();
        const itemsData = await itemsRes.json();

        setWorkers(
          (workersData.workers || []).filter(
            (worker: Worker) => worker.worker_type === "piece_rate",
          ),
        );
        setItems(itemsData.items || []);
        setWorkOrders(itemsData.workOrders || []);
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
    setFormData((prev) => ({
      ...prev,
      item_id: itemId,
      work_order_id: "",
      color: "",
      size: "",
    }));
    setError("");

    // Fetch rate for this worker and item
    if (formData.worker_id && itemId) {
      const selectedWorker = workers.find((w) => w.id === formData.worker_id);
      if (selectedWorker) {
        try {
          const res = await fetch(
            `/api/factory/rates?itemId=${itemId}&workerCategory=${selectedWorker.category}&workerId=${selectedWorker.id}`
          );
          const data = await res.json();
          if (data.rates && data.rates.length > 0) {
            setSelectedRate(data.rates[0].rate_per_pair);
            setSelectedRateSource(data.rates[0].rate_source || "Factory rate");
            setShowSetRate(false);
          } else {
            setSelectedRate(null);
            setSelectedRateSource("");
            setShowSetRate(true);
            setSuccess("⚙️ Rate not found! Click 'Set Rate Now' to add it.");
          }
        } catch (err) {
          setError("Failed to fetch rate");
          console.error(err);
        }
      }
    }
  };

  const handleWorkOrderChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const workOrderId = event.target.value;
    const order = workOrders.find((row) => row.id === workOrderId);
    setFormData((current) => ({
      ...current,
      work_order_id: workOrderId,
      color: order?.colour || "",
      size: "",
    }));
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

  const handleAddProduct = async () => {
    if (!newProductName.trim()) {
      setError("Product name is required");
      return;
    }

    try {
      const res = await fetch("/api/factory/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProductName }),
      });

      if (!res.ok) throw new Error("Failed to add product");

      const data = await res.json();
      setItems([
        ...items,
        { id: data.id, name: data.name, code: "", production_item_id: null },
      ]);
      setFormData((prev) => ({ ...prev, item_id: data.id }));
      setNewProductName("");
      setShowAddProduct(false);
      setSuccess("✅ Product added! Now set the rate.");
      setShowSetRate(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add product");
    }
  };

  const handleSetRate = async () => {
    if (!newRate || !formData.item_id) {
      setError("Rate is required");
      return;
    }

    const selectedWorker = workers.find((w) => w.id === formData.worker_id);
    if (!selectedWorker) {
      setError("Please select a worker first");
      return;
    }

    try {
      const res = await fetch("/api/factory/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: formData.item_id,
          worker_category: selectedWorker.category,
          rate_per_pair: parseFloat(newRate),
        }),
      });

      if (!res.ok) throw new Error("Failed to set rate");

      setSelectedRate(parseFloat(newRate));
      setSelectedRateSource("Production stage synchronized");
      setNewRate("");
      setShowSetRate(false);
      setSuccess("✅ Rate set! Amount will calculate now.");

      if (formData.pairs_count) {
        setCalculatedAmount(parseFloat(formData.pairs_count) * parseFloat(newRate));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set rate");
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
      const keyScope = `work:${JSON.stringify(formData)}`;
      const res = await fetch("/api/factory/work", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKeys.get(keyScope),
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to save work entry");
      }

      const result = await res.json();
      idempotencyKeys.rotate(keyScope);
      setWorkSaved((count) => count + 1);
      setSuccess(
        result.production_synced
          ? "Work and wage saved. Production history synchronized."
          : `Work and wage saved. ${
              result.production_sync_reason ||
              "Link the Worker and Item Master to synchronize production history."
            }`,
      );
      setFormData({
        date: nepalDateKey(),
        worker_id: "",
        item_id: "",
        work_order_id: "",
        color: "",
        size: "",
        pairs_count: "",
        reject_pairs: "",
        status: "completed",
      });
      setSelectedRate(null);
      setSelectedRateSource("");
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

  const selectedItem = items.find((item) => item.id === formData.item_id);
  const availableWorkOrders = workOrders.filter(
    (order) => order.item_id === selectedItem?.production_item_id,
  );
  const selectedWorkOrder = workOrders.find(
    (order) => order.id === formData.work_order_id,
  );
  const plannedSizes = selectedWorkOrder
    ? Object.entries(selectedWorkOrder.size_breakdown).filter(([, pairs]) => Number(pairs) > 0)
    : [];

  if (loading) {
    return (
      <div className="p-4 sm:p-6 text-center">
        <div className="animate-pulse text-brand-muted">{text("Loading…", "खुल्दैछ…")}</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      {/* A small factory-crest header, the same monogram the shop signs itself
          with, so the busiest screen in the building reads as KRISHOE's own. */}
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-gradient-to-br from-brand-green to-brand-green-ink font-display text-lg font-black text-brand-gold-bright shadow-sm"
        >
          K
        </span>
        <div>
          <h1 className="font-display text-2xl font-black leading-tight text-brand-green-ink sm:text-3xl">
            {text("Add work", "काम टिप्ने")}
          </h1>
          <p className="text-sm text-brand-muted">
            {text("A worker, a product, the pairs — and the total.", "कामदार, सामान, जोडी — अनि जम्मा।")}
          </p>
        </div>
      </div>

      {/* Two views, one at a time, so the page stays short: entering work, and
          posting what was made to stock. Entering is the default because that
          is what this screen is for; posting is one tap away when the pairs are
          counted in the godown. */}
      <div className="mt-5 flex gap-1.5 rounded-xl bg-brand-mist p-1">
        <button
          type="button"
          onClick={() => setView("entry")}
          className={`flex-1 min-h-11 rounded-lg px-3 text-sm font-black transition ${
            view === "entry" ? "bg-brand-green-ink text-white shadow-sm" : "text-brand-muted"
          }`}
        >
          📝 {text("Add work", "काम टिप्ने")}
        </button>
        <button
          type="button"
          onClick={() => setView("post")}
          className={`flex-1 min-h-11 rounded-lg px-3 text-sm font-black transition ${
            view === "post" ? "bg-brand-green-ink text-white shadow-sm" : "text-brand-muted"
          }`}
        >
          📦 {text("Post to stock", "माल चढाउने")}
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        hidden={view !== "entry"}
        className="mt-5 bg-brand-paper rounded-lg border border-brand-green-line p-4 sm:p-6 space-y-4 sm:space-y-6"
      >
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

        {/* Date — picked in Bikram Sambat, stored as AD. The field shows the BS
            date big and the AD date small, so both are on screen. */}
        <div>
          <label className="block text-sm font-medium text-brand-green-ink mb-2">📅 {text("Date", "मिति")}</label>
          <NepaliDateField
            value={formData.date}
            onChange={(adValue) => setFormData((prev) => ({ ...prev, date: adValue }))}
            required
          />
        </div>

        {/* Worker + Product on one row on wider phones and up, so the two most
            important choices sit together and the form is shorter to scroll. On
            a narrow phone they stack, one per line, as before. */}
        <div className="grid gap-4 sm:grid-cols-2">
        {/* Worker */}
        <div>
          <label className="block text-sm font-medium text-brand-green-ink mb-2">👤 {text("Worker", "कामदार")}</label>
          <select
            value={formData.worker_id}
            onChange={handleWorkerChange}
            className="w-full min-h-12 px-3 py-2 border border-brand-green-line rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent"
            required
          >
            <option value="">{text("Select a worker…", "कामदार छान्नुहोस्…")}</option>
            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.name} ({worker.category})
              </option>
            ))}
          </select>
        </div>

        {/* Item/Product */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-brand-green-ink">🛞 {text("Product", "कुन जुत्ता")}</label>
            <div className="flex gap-2">
              <Link
                href="/admin/factory/items"
                className="rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-200"
              >
                Item Master
              </Link>
              <button
                type="button"
                onClick={() => setShowAddProduct(true)}
                className="text-xs bg-brand-green-wash text-brand-green hover:bg-brand-green-tint px-2 py-1 rounded"
              >
                ➕ Add New
              </button>
              {showSetRate && (
                <button
                  type="button"
                  onClick={() => setShowSetRate(true)}
                  className="text-xs bg-orange-100 text-orange-700 hover:bg-orange-200 px-2 py-1 rounded font-semibold"
                >
                  ⚙️ Set Rate
                </button>
              )}
            </div>
          </div>
          <select
            value={formData.item_id}
            onChange={handleItemChange}
            className="w-full min-h-12 px-3 py-2 border border-brand-green-line rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent"
            required
          >
            <option value="">{text("Select a product…", "जुत्ता छान्नुहोस्…")}</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        </div>

        {/* Work Order / Lot */}
        {selectedItem?.production_item_id && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 sm:p-4">
            <label className="block text-sm font-bold text-emerald-950 mb-2">
              Work Order / Lot
            </label>
            <select
              value={formData.work_order_id}
              onChange={handleWorkOrderChange}
              className="w-full min-h-12 rounded-lg border border-emerald-300 bg-brand-paper px-3 py-2"
            >
              <option value="">
                {text("No work order — wage history only", "Work Order बिना — ज्यालाको हिसाब मात्र")}
              </option>
              {availableWorkOrders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.work_order_number} · {order.current_stage} · {order.planned_pairs} pairs
                </option>
              ))}
            </select>
            {selectedWorkOrder ? (
              <p className="mt-2 text-xs leading-5 text-emerald-800">
                {selectedWorkOrder.item_name_snapshot} · {selectedWorkOrder.colour} · Current stage {selectedWorkOrder.current_stage}
                {selectedWorkOrder.due_date ? ` · Due ${selectedWorkOrder.due_date}` : ""}
              </p>
            ) : (
              <p className="mt-2 text-xs leading-5 text-emerald-800">
                Select a lot to preserve its stage, size and progress history. You can continue without one for legacy wage-only work.
              </p>
            )}
          </div>
        )}

        {/* Colour, Size and Pairs on one row from small screens up — three short
            fields that belong together, so the form does not run down the page.
            They stack on a narrow phone. */}
        <div className="grid gap-4 sm:grid-cols-3">
        {/* Color */}
        <div>
          <label className="block text-sm font-medium text-brand-green-ink mb-2">
            🎨 {text("Colour (optional)", "रङ — नलेखे पनि हुन्छ")}
          </label>
          <input
            type="text"
            value={formData.color}
            onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
            readOnly={Boolean(selectedWorkOrder)}
            placeholder={text("e.g. Black, Blue, Red", "जस्तै: कालो, निलो, रातो")}
            className="w-full min-h-12 px-3 py-2 border border-brand-green-line rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent"
          />
        </div>

        {/* Size */}
        <div>
          <label className="block text-sm font-medium text-brand-green-ink mb-2">
            📏 {text("Size (optional)", "साइज — नलेखे पनि हुन्छ")}
          </label>
          {selectedWorkOrder ? (
            <select
              value={formData.size}
              onChange={(e) => setFormData((prev) => ({ ...prev, size: e.target.value }))}
              className="w-full min-h-12 px-3 py-2 border border-brand-green-line rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent"
              required
            >
              <option value="">{text("Select a planned size…", "तय भएको साइज छान्नुहोस्…")}</option>
              {plannedSizes.map(([size, pairs]) => (
                <option key={size} value={size}>{size} · planned {pairs} pairs</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={formData.size}
              onChange={(e) => setFormData((prev) => ({ ...prev, size: e.target.value }))}
              placeholder={text("e.g. 7, 8, 9", "जस्तै: ७, ८, ९")}
              className="w-full min-h-12 px-3 py-2 border border-brand-green-line rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent"
            />
          )}
        </div>

        {/* Pairs */}
        <div>
          <label className="block text-sm font-medium text-brand-green-ink mb-2">
            🔢 {text("Number of pairs", "कति जोडी")}
          </label>
          <input
            type="number"
            value={formData.pairs_count}
            onChange={handlePairsChange}
            placeholder={text("Enter number of pairs", "कति जोडी बनायो")}
            min="1"
            className="w-full min-h-12 px-3 py-2 border border-brand-green-line rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent"
            required
          />
        </div>
        </div>

        {/* QC — how many of those pairs were rejects (bad). Optional; 0 means all good. */}
        <div>
          <label className="block text-sm font-medium text-brand-green-ink mb-2">
            ❌ {text("Rejected pairs (QC)", "खराब जोडी (QC)")}
          </label>
          <input
            type="number"
            value={formData.reject_pairs}
            onChange={(e) => setFormData((prev) => ({ ...prev, reject_pairs: e.target.value }))}
            placeholder={text("0 — leave blank if all good", "० — सबै राम्रो भए खाली")}
            min="0"
            className="w-full min-h-12 px-3 py-2 border border-brand-green-line rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent"
          />
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          ✅ Save here only after the worker has completed and handed over the work.
          Rejected work should be corrected first.
        </div>

        {/* The live total — the one figure the owner is really entering this
            work for. Shown big and gold the moment a worker, product and pair
            count are chosen, with the rate and where it came from beside it, so
            there is nothing to scroll for and nothing to add up by hand. */}
        {selectedRate !== null && (
          <div className="overflow-hidden rounded-2xl border-2 border-brand-gold bg-gradient-to-br from-brand-gold/10 to-transparent">
            <div className="flex items-center justify-between gap-3 border-b border-brand-green-line/60 px-4 py-2.5">
              <p className="text-sm font-semibold text-brand-green-ink">
                {text("Rate", "दर")}: <span className="font-black">Rs. {selectedRate}</span>{" "}
                <span className="text-xs font-normal text-brand-muted">{text("/ pair", "/ जोडी")}</span>
              </p>
              {selectedRateSource ? (
                <span className="shrink-0 rounded-full bg-brand-green-mist px-2.5 py-1 text-[11px] font-black text-brand-green">
                  ✓ {selectedRateSource}
                </span>
              ) : null}
            </div>
            <div className="flex items-baseline justify-between gap-3 px-4 py-3">
              <span className="text-sm text-brand-muted">
                {formData.pairs_count || 0} {text("pairs", "जोडी")} × Rs. {selectedRate}
              </span>
              <span className="font-display text-3xl font-black leading-none tabular-nums text-brand-green-ink">
                Rs. {calculatedAmount.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-brand-green hover:bg-brand-green-ink disabled:bg-brand-muted-soft text-white font-semibold py-3 px-4 rounded-lg transition-colors min-h-12 flex items-center justify-center"
          >
            {submitting ? "Saving..." : "✅ Save Work Entry"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/factory")}
            className="flex-1 bg-brand-green-line hover:bg-brand-muted-soft text-brand-green-ink font-semibold py-3 px-4 rounded-lg transition-colors min-h-12 flex items-center justify-center"
          >
            Cancel
          </button>
        </div>
      </form>

      <div hidden={view !== "post"} className="mt-5">
        <ReadyToPost refreshKey={workSaved} />
      </div>

      {/* Add Product Modal */}
      {showAddProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-brand-paper rounded-lg p-6 max-w-md w-full shadow-xl">
            <h2 className="text-xl font-bold text-brand-green-ink mb-4">➕ Add New Product</h2>
            <input
              type="text"
              value={newProductName}
              onChange={(e) => setNewProductName(e.target.value)}
              placeholder={text("Product name (e.g. Flatpatta, Sendil)", "जुत्ताको नाम (जस्तै: फ्ल्याटपट्टा, सेन्डिल)")}
              className="w-full min-h-12 px-3 py-2 border border-brand-green-line rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent mb-4"
              onKeyPress={(e) => e.key === "Enter" && handleAddProduct()}
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddProduct}
                className="flex-1 bg-brand-green hover:bg-brand-green-ink text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                ✅ Add Product
              </button>
              <button
                onClick={() => {
                  setShowAddProduct(false);
                  setNewProductName("");
                }}
                className="flex-1 bg-brand-green-line hover:bg-brand-muted-soft text-brand-green-ink font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Rate Modal */}
      {showSetRate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-brand-paper rounded-lg p-6 max-w-md w-full shadow-xl">
            <h2 className="text-xl font-bold text-brand-green-ink mb-2">⚙️ Set Rate</h2>
            <p className="text-sm text-brand-muted mb-4">
              Rate not found for this product. Please enter the rate per pair.
            </p>
            <input
              type="number"
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
              placeholder={text("Rate per pair (e.g. 10, 12, 15)", "प्रति जोडी दर (जस्तै: १०, १२, १५)")}
              className="w-full min-h-12 px-3 py-2 border border-brand-green-line rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent mb-4"
              onKeyPress={(e) => e.key === "Enter" && handleSetRate()}
            />
            <p className="text-xs text-brand-muted mb-4">
              Category: <strong>{workers.find((w) => w.id === formData.worker_id)?.category}</strong>
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleSetRate}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                ✅ Set Rate
              </button>
              <button
                onClick={() => {
                  setShowSetRate(false);
                  setNewRate("");
                }}
                className="flex-1 bg-brand-green-line hover:bg-brand-muted-soft text-brand-green-ink font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
