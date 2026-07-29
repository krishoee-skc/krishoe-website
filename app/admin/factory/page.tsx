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

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        // Get today's date
        const today = new Date().toISOString().split("T")[0];

        // Fetch today's work entries
        const workRes = await fetch(`/api/factory/work?date=${today}`);
        const workData = await workRes.json();
        const works = workData.works || [];

        // Calculate stats
        const totalPairs = works.reduce((sum, w) => sum + (w.pairs_count || 0), 0);
        const totalAmount = works.reduce((sum, w) => sum + (w.amount_earned || 0), 0);
        const completedEntries = works.filter((w) => w.status === "completed").length;
        const inProgressEntries = works.filter((w) => w.status === "in_progress").length;
        const reworkEntries = works.filter((w) => w.status === "rework").length;

        // Get unique workers
        const uniqueWorkers = new Set(works.map((w) => w.worker_id)).size;

        // Group by worker for top workers
        const workerStats = {};
        works.forEach((w) => {
          if (!workerStats[w.worker_id]) {
            workerStats[w.worker_id] = { name: w.worker_name, pairs: 0, amount: 0 };
          }
          workerStats[w.worker_id].pairs += w.pairs_count || 0;
          workerStats[w.worker_id].amount += w.amount_earned || 0;
        });

        const topWorkersArray = Object.values(workerStats)
          .sort((a: any, b: any) => b.pairs - a.pairs)
          .slice(0, 5) as TopWorker[];

        // Group by product
        const productStats = {};
        works.forEach((w) => {
          if (!productStats[w.item_id]) {
            productStats[w.item_id] = { name: w.item_name, pairs: 0 };
          }
          productStats[w.item_id].pairs += w.pairs_count || 0;
        });

        const productsArray = Object.values(productStats)
          .sort((a: any, b: any) => b.pairs - a.pairs)
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
    <div className="p-4 sm:p-6 space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">KRISHOE Factory</h1>
        <p className="text-slate-600 text-sm sm:text-base">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Today's Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-lg p-4 sm:p-6 border border-slate-200">
          <div className="text-xs sm:text-sm text-slate-600 font-medium">Total Pairs</div>
          <div className="text-2xl sm:text-3xl font-bold text-blue-600 mt-2">{stats.totalPairs}</div>
          <div className="text-xs text-slate-500 mt-2">Today</div>
        </div>

        <div className="bg-white rounded-lg p-4 sm:p-6 border border-slate-200">
          <div className="text-xs sm:text-sm text-slate-600 font-medium">Total Amount</div>
          <div className="text-2xl sm:text-3xl font-bold text-green-600 mt-2">
            Rs. {stats.totalAmount.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-2">Today</div>
        </div>

        <div className="bg-white rounded-lg p-4 sm:p-6 border border-slate-200">
          <div className="text-xs sm:text-sm text-slate-600 font-medium">Workers Active</div>
          <div className="text-2xl sm:text-3xl font-bold text-purple-600 mt-2">
            {stats.workersActive}
          </div>
          <div className="text-xs text-slate-500 mt-2">Today</div>
        </div>

        <div className="bg-white rounded-lg p-4 sm:p-6 border border-slate-200">
          <div className="text-xs sm:text-sm text-slate-600 font-medium">Success Rate</div>
          <div className="text-2xl sm:text-3xl font-bold text-amber-600 mt-2">
            {stats.completedEntries + stats.inProgressEntries + stats.reworkEntries > 0
              ? Math.round(
                  (stats.completedEntries /
                    (stats.completedEntries + stats.inProgressEntries + stats.reworkEntries)) *
                    100
                )
              : 0}
            %
          </div>
          <div className="text-xs text-slate-500 mt-2">Completed</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Top Workers */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-4">Top Workers Today</h2>
          <div className="space-y-3">
            {topWorkers.length > 0 ? (
              topWorkers.map((worker, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <div className="font-medium text-slate-900 text-sm sm:text-base">{worker.name}</div>
                    <div className="text-xs sm:text-sm text-slate-600">{worker.pairs} pairs</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900 text-sm sm:text-base">Rs. {worker.amount.toLocaleString()}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-slate-500 text-sm">No work entries yet</div>
            )}
          </div>
        </div>

        {/* Products Today */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-4">Products Today</h2>
          <div className="space-y-3">
            {products.length > 0 ? (
              products.map((product, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="font-medium text-slate-900 text-sm sm:text-base">{product.name}</div>
                  <div className="font-semibold text-slate-900 text-sm sm:text-base">{product.pairs} pairs</div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-slate-500 text-sm">No work entries yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Quality Status */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-4">Quality Status</h2>
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <div className="text-center p-3 sm:p-4 bg-green-50 rounded-lg">
            <div className="text-2xl sm:text-3xl font-bold text-green-600">{stats.completedEntries}</div>
            <div className="text-xs sm:text-sm text-green-700 mt-1">Completed ✅</div>
          </div>
          <div className="text-center p-3 sm:p-4 bg-yellow-50 rounded-lg">
            <div className="text-2xl sm:text-3xl font-bold text-yellow-600">
              {stats.inProgressEntries}
            </div>
            <div className="text-xs sm:text-sm text-yellow-700 mt-1">In Progress ⏳</div>
          </div>
          <div className="text-center p-3 sm:p-4 bg-red-50 rounded-lg">
            <div className="text-2xl sm:text-3xl font-bold text-red-600">{stats.reworkEntries}</div>
            <div className="text-xs sm:text-sm text-red-700 mt-1">Rework 🔄</div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4">
        <a
          href="/admin/factory/add-work"
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-center text-sm sm:text-base"
        >
          ➕ Add Work Entry
        </a>
        <a
          href="/admin/factory/reports"
          className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-center text-sm sm:text-base"
        >
          📊 View Reports
        </a>
      </div>
    </div>
  );
}
