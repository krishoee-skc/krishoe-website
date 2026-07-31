"use client";

import { useEffect, useState } from "react";

interface DailyStats {
  totalPairs: number;
  totalAmount: number;
  workersActive: number;
  completedEntries: number;
  inProgressEntries: number;
  reworkEntries: number;
}

interface TopWorker {
  name: string;
  pairs: number;
  amount: number;
}

interface ProductCount {
  name: string;
  pairs: number;
}

interface WorkEntry {
  id: string;
  date: string;
  worker_id: string;
  worker_name: string;
  item_id: string;
  item_name: string;
  pairs_count: number;
  amount_earned: number;
  status: string;
}

export default function FactoryDashboard() {
  const [stats, setStats] = useState<DailyStats>({
    totalPairs: 0,
    totalAmount: 0,
    workersActive: 0,
    completedEntries: 0,
    inProgressEntries: 0,
    reworkEntries: 0,
  });
  const [topWorkers, setTopWorkers] = useState<TopWorker[]>([]);
  const [products, setProducts] = useState<ProductCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setError(null);
        // Get today's date
        const today = new Date().toISOString().split("T")[0];

        // Fetch today's work entries
        const workRes = await fetch(`/api/factory/work?date=${today}`);
        const workData = await workRes.json();

        // Check if API returned an error message
        if (workData.error) {
          setError(`API Error: ${workData.error}`);
          setLoading(false);
          return;
        }

        const works: WorkEntry[] = workData.works || [];

        // Calculate stats
        const totalPairs = works.reduce((sum: number, w: WorkEntry) => sum + (w.pairs_count || 0), 0);
        const totalAmount = works.reduce((sum: number, w: WorkEntry) => sum + (w.amount_earned || 0), 0);
        const completedEntries = works.filter((w: WorkEntry) => w.status === "completed").length;
        const inProgressEntries = works.filter((w: WorkEntry) => w.status === "in_progress").length;
        const reworkEntries = works.filter((w: WorkEntry) => w.status === "rework").length;

        // Get unique workers
        const uniqueWorkers = new Set(works.map((w: WorkEntry) => w.worker_id)).size;

        // Group by worker for top workers
        const workerStats: Record<string, TopWorker> = {};
        works.forEach((w: WorkEntry) => {
          if (w && w.worker_id && w.worker_name) {
            if (!workerStats[w.worker_id]) {
              workerStats[w.worker_id] = { name: w.worker_name || 'Unknown', pairs: 0, amount: 0 };
            }
            workerStats[w.worker_id].pairs += w.pairs_count || 0;
            workerStats[w.worker_id].amount += w.amount_earned || 0;
          }
        });

        const topWorkersArray = Object.values(workerStats)
          .sort((a: TopWorker, b: TopWorker) => b.pairs - a.pairs)
          .slice(0, 5) as TopWorker[];

        // Group by product
        const productStats: Record<string, ProductCount> = {};
        works.forEach((w: WorkEntry) => {
          if (w && w.item_id && w.item_name) {
            if (!productStats[w.item_id]) {
              productStats[w.item_id] = { name: w.item_name || 'Unknown', pairs: 0 };
            }
            productStats[w.item_id].pairs += w.pairs_count || 0;
          }
        });

        const productsArray = Object.values(productStats)
          .sort((a: ProductCount, b: ProductCount) => b.pairs - a.pairs)
          .slice(0, 5) as ProductCount[];

        setStats({
          totalPairs,
          totalAmount,
          workersActive: uniqueWorkers,
          completedEntries,
          inProgressEntries,
          reworkEntries,
        });
        setTopWorkers(topWorkersArray);
        setProducts(productsArray);
      } catch (error) {
        console.error("Error loading dashboard:", error);
        setError(`Failed to load dashboard: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 text-center">
        <div className="animate-pulse text-slate-500">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-3 space-y-2 sm:space-y-3 min-h-screen flex flex-col">
      <div className="mb-1">
        <h1 className="text-lg sm:text-xl font-bold text-slate-900">KRISHOE Factory</h1>
        <p className="text-slate-600 text-xs sm:text-sm">
          {new Date().toLocaleDateString("en-US", {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-2 text-xs">
          <p className="text-red-800 font-medium">⚠️ Dashboard Error</p>
          <p className="text-red-700 text-xs mt-0.5">{error}</p>
        </div>
      )}

      {/* Today's Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 sm:gap-2">
        <div className="bg-white rounded p-2 sm:p-3 border border-slate-200">
          <div className="text-xs text-slate-600 font-medium">Total Pairs</div>
          <div className="text-xl sm:text-2xl font-bold text-blue-600 mt-1">{stats.totalPairs}</div>
          <div className="text-xs text-slate-500 mt-0.5">Today</div>
        </div>

        <div className="bg-white rounded p-2 sm:p-3 border border-slate-200">
          <div className="text-xs text-slate-600 font-medium">Total Amount</div>
          <div className="text-xl sm:text-2xl font-bold text-green-600 mt-1">
            Rs. {stats.totalAmount.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Today</div>
        </div>

        <div className="bg-white rounded p-2 sm:p-3 border border-slate-200">
          <div className="text-xs text-slate-600 font-medium">Workers Active</div>
          <div className="text-xl sm:text-2xl font-bold text-purple-600 mt-1">
            {stats.workersActive}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Today</div>
        </div>

        <div className="bg-white rounded p-2 sm:p-3 border border-slate-200">
          <div className="text-xs text-slate-600 font-medium">Success Rate</div>
          <div className="text-xl sm:text-2xl font-bold text-amber-600 mt-1">
            {stats.completedEntries + stats.inProgressEntries + stats.reworkEntries > 0
              ? Math.round(
                  (stats.completedEntries /
                    (stats.completedEntries + stats.inProgressEntries + stats.reworkEntries)) *
                    100
                )
              : 0}
            %
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Completed</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3 flex-1">
        {/* Top Workers */}
        <div className="bg-white rounded border border-slate-200 p-2 sm:p-3 flex flex-col">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 mb-2">Top Workers</h2>
          <div className="space-y-1 overflow-y-auto">
            {topWorkers.length > 0 ? (
              topWorkers.map((worker, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded text-xs sm:text-sm">
                  <div>
                    <div className="font-medium text-slate-900">{worker.name}</div>
                    <div className="text-xs text-slate-600">{worker.pairs} pairs</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900">Rs. {worker.amount.toLocaleString()}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-2 text-slate-500 text-xs">No entries yet</div>
            )}
          </div>
        </div>

        {/* Products Today */}
        <div className="bg-white rounded border border-slate-200 p-2 sm:p-3 flex flex-col">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 mb-2">Products Today</h2>
          <div className="space-y-1 overflow-y-auto">
            {products.length > 0 ? (
              products.map((product, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded text-xs sm:text-sm">
                  <div className="font-medium text-slate-900">{product.name}</div>
                  <div className="font-semibold text-slate-900">{product.pairs} pairs</div>
                </div>
              ))
            ) : (
              <div className="text-center py-2 text-slate-500 text-xs">No entries yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Quality Status */}
      <div className="bg-white rounded border border-slate-200 p-2 sm:p-3">
        <h2 className="text-sm sm:text-base font-bold text-slate-900 mb-2">Quality Status</h2>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          <div className="text-center p-2 sm:p-2.5 bg-green-50 rounded">
            <div className="text-lg sm:text-xl font-bold text-green-600">{stats.completedEntries}</div>
            <div className="text-xs text-green-700 mt-0.5">Completed ✅</div>
          </div>
          <div className="text-center p-2 sm:p-2.5 bg-yellow-50 rounded">
            <div className="text-lg sm:text-xl font-bold text-yellow-600">
              {stats.inProgressEntries}
            </div>
            <div className="text-xs text-yellow-700 mt-0.5">In Progress ⏳</div>
          </div>
          <div className="text-center p-2 sm:p-2.5 bg-red-50 rounded">
            <div className="text-lg sm:text-xl font-bold text-red-600">{stats.reworkEntries}</div>
            <div className="text-xs text-red-700 mt-0.5">Rework 🔄</div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-1.5 mt-1">
        <a
          href="/admin/factory/add-work"
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 rounded transition-colors text-center text-xs sm:text-sm"
        >
          ➕ Add Work Entry
        </a>
        <a
          href="/admin/factory/reports"
          className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-semibold py-2 px-3 rounded transition-colors text-center text-xs sm:text-sm"
        >
          📊 View Reports
        </a>
      </div>
    </div>
  );
}
