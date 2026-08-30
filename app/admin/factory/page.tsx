"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { nepalDateKey } from "@/app/admin/factory/_components/nepal-date";
import { formatAdminDate } from "@/lib/format-date";

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

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
  const [owed, setOwed] = useState<{ totalOwed: number; workersOwed: number }>({ totalOwed: 0, workersOwed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setError(null);
        // Get today's date
        const today = nepalDateKey();

        // Fetch today's work entries
        const workRes = await fetch(`/api/factory/work?date=${today}`);
        const workData = await workRes.json();

        // Check if API returned an error message
        if (workData.error) {
          setError(`API Error: ${workData.error}`);
          setLoading(false);
          return;
        }

        const works: WorkEntry[] = (workData.works || []).map((work: WorkEntry) => ({
          ...work,
          pairs_count: Number(work.pairs_count) || 0,
          amount_earned: Number(work.amount_earned) || 0,
        }));

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

        // Owed-to-workers glance — its own fetch so a summary hiccup never
        // blanks the rest of the board.
        try {
          const owedRes = await fetch("/api/factory/summary");
          const owedData = await owedRes.json();
          if (!owedData.error) {
            setOwed({
              totalOwed: Number(owedData.totalOwed) || 0,
              workersOwed: Number(owedData.workersOwed) || 0,
            });
          }
        } catch {
          // Leave owed at its default; the rest of the board still renders.
        }
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
        <div className="animate-pulse text-brand-muted">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col space-y-3 p-3 sm:p-5 lg:p-6">
      <div className="mb-1">
        <h1 className="font-display text-xl sm:text-2xl font-black text-brand-green-ink">Factory Today</h1>
        <p className="text-brand-muted text-xs sm:text-sm">
          {formatAdminDate(new Date())}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-2 text-xs">
          <p className="text-red-800 font-medium">Dashboard error</p>
          <p className="text-red-700 text-xs mt-0.5">{error}</p>
        </div>
      )}

      {/* Today's Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 sm:gap-2">
        <div className="rounded-2xl border border-brand-green-line bg-brand-paper p-3 shadow-[0_10px_30px_rgba(16,35,29,0.05)] sm:p-4">
          <div className="text-xs text-brand-muted font-medium">Total Pairs</div>
          <div className="text-xl sm:text-2xl font-bold text-brand-green mt-1">{stats.totalPairs}</div>
          <div className="text-xs text-brand-muted mt-0.5">Today</div>
        </div>

        <div className="rounded-2xl border border-brand-green-line bg-brand-paper p-3 shadow-[0_10px_30px_rgba(16,35,29,0.05)] sm:p-4">
          <div className="text-xs text-brand-muted font-medium">Piece Wage Earned</div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-600 mt-1">
            Rs. {moneyFormatter.format(stats.totalAmount)}
          </div>
          <div className="text-xs text-brand-muted mt-0.5">Today</div>
        </div>

        <div className="rounded-2xl border border-brand-green-line bg-brand-paper p-3 shadow-[0_10px_30px_rgba(16,35,29,0.05)] sm:p-4">
          <div className="text-xs text-brand-muted font-medium">Workers Active</div>
          <div className="text-xl sm:text-2xl font-bold text-brand-gold-deep mt-1">
            {stats.workersActive}
          </div>
          <div className="text-xs text-brand-muted mt-0.5">Today</div>
        </div>

        <div className="rounded-2xl border border-brand-green-line bg-brand-paper p-3 shadow-[0_10px_30px_rgba(16,35,29,0.05)] sm:p-4">
          <div className="text-xs text-brand-muted font-medium">Success Rate</div>
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
          <div className="text-xs text-brand-muted mt-0.5">Completed</div>
        </div>
      </div>

      {/* Owed to workers — the "how much is still to pay" glance the counter
          asked for, so wages are never paid twice or missed. */}
      <Link
        href="/admin/factory/salary"
        className="flex items-center justify-between rounded-2xl border border-brand-gold/40 bg-brand-gold/10 p-3 shadow-[0_10px_30px_rgba(16,35,29,0.05)] transition hover:border-brand-gold sm:p-4"
      >
        <div>
          <div className="text-xs font-medium text-brand-muted">Owed to workers</div>
          <div className="mt-1 text-xl font-black text-brand-green-ink sm:text-2xl">
            Rs. {moneyFormatter.format(owed.totalOwed)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-black text-brand-green-ink">{owed.workersOwed}</div>
          <div className="text-xs font-semibold text-brand-gold-deep">workers to pay →</div>
        </div>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3 flex-1">
        {/* Top Workers */}
        <div className="flex flex-col rounded-2xl border border-brand-green-line bg-brand-paper p-3 shadow-[0_10px_30px_rgba(16,35,29,0.05)] sm:p-4">
          <h2 className="text-sm sm:text-base font-bold text-brand-green-ink mb-2">Top Workers</h2>
          <div className="space-y-1 overflow-y-auto">
            {topWorkers.length > 0 ? (
              topWorkers.map((worker, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-brand-paper-deep rounded text-xs sm:text-sm">
                  <div>
                    <div className="font-medium text-brand-green-ink">{worker.name}</div>
                    <div className="text-xs text-brand-muted">{worker.pairs} pairs</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-brand-green-ink">Rs. {moneyFormatter.format(worker.amount)}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-2 text-brand-muted text-xs">No entries yet</div>
            )}
          </div>
        </div>

        {/* Products Today */}
        <div className="flex flex-col rounded-2xl border border-brand-green-line bg-brand-paper p-3 shadow-[0_10px_30px_rgba(16,35,29,0.05)] sm:p-4">
          <h2 className="text-sm sm:text-base font-bold text-brand-green-ink mb-2">Products Today</h2>
          <div className="space-y-1 overflow-y-auto">
            {products.length > 0 ? (
              products.map((product, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-brand-paper-deep rounded text-xs sm:text-sm">
                  <div className="font-medium text-brand-green-ink">{product.name}</div>
                  <div className="font-semibold text-brand-green-ink">{product.pairs} pairs</div>
                </div>
              ))
            ) : (
              <div className="text-center py-2 text-brand-muted text-xs">No entries yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Quality Status */}
      <div className="rounded-2xl border border-brand-green-line bg-brand-paper p-3 shadow-[0_10px_30px_rgba(16,35,29,0.05)] sm:p-4">
        <h2 className="text-sm sm:text-base font-bold text-brand-green-ink mb-2">Quality Status</h2>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          <div className="text-center p-2 sm:p-2.5 bg-emerald-50 rounded">
            <div className="text-lg sm:text-xl font-bold text-emerald-600">{stats.completedEntries}</div>
            <div className="text-xs text-emerald-700 mt-0.5">Completed</div>
          </div>
          <div className="text-center p-2 sm:p-2.5 bg-amber-50 rounded">
            <div className="text-lg sm:text-xl font-bold text-amber-600">
              {stats.inProgressEntries}
            </div>
            <div className="text-xs text-amber-700 mt-0.5">In progress</div>
          </div>
          <div className="text-center p-2 sm:p-2.5 bg-red-50 rounded">
            <div className="text-lg sm:text-xl font-bold text-red-600">{stats.reworkEntries}</div>
            <div className="text-xs text-red-700 mt-0.5">Rework</div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-1.5 mt-1">
        <Link
          href="/admin/factory/add-work"
          className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-brand-green px-3 py-2 text-center text-xs font-black text-white shadow-[0_8px_20px_rgba(11,77,59,0.18)] transition hover:-translate-y-0.5 hover:bg-brand-green-ink sm:text-sm"
        >
          Add work entry
        </Link>
        <Link
          href="/admin/factory/reports"
          className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-brand-green/25 bg-brand-paper px-3 py-2 text-center text-xs font-black text-brand-green transition hover:-translate-y-0.5 hover:border-brand-green hover:bg-brand-green-wash sm:text-sm"
        >
          View reports
        </Link>
      </div>
    </div>
  );
}
