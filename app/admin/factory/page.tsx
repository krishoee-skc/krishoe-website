import type { Metadata } from "next";
import FactoryBoard from "@/app/admin/factory/FactoryBoard";
import LoadFailure from "@/components/admin/LoadFailure";
import { nepalDateKey } from "@/app/admin/factory/_components/nepal-date";
import { stageTotals, topProducts, topWorkers } from "@/lib/factory-board";
import {
  getFactoryDayStockPairs,
  getFactoryDayTotals,
  getFactoryOwed,
  getFactoryWorkForDate,
} from "@/lib/factory-board-data";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";
import { workerInboxCounts } from "@/lib/worker-portal";

export const metadata: Metadata = {
  title: "Factory today | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

/**
 * The day's work is what the board is for, so a failure to read it is a failure
 * to show the board. The owed figure is softer — it has its own panel and its
 * own table — so a hiccup there leaves it at zero rather than taking the whole
 * screen down with it.
 */
async function loadBoard(date: string) {
  try {
    // The headline figures are counted in the database, so they stay right at
    // any size. The entry list is only for the two short "who and what led the
    // day" panels, and is capped.
    const [stats, works, stockPairs] = await Promise.all([
      getFactoryDayTotals(date),
      getFactoryWorkForDate(date),
      // Pairs made is pairs into stock — the work entries are per stage.
      getFactoryDayStockPairs(date),
    ]);
    const owed = await getFactoryOwed().catch(() => ({ totalOwed: 0, workersOwed: 0 }));

    return { stats, works, stockPairs, owed, error: "" };
  } catch (error) {
    reportError("load the factory board", error);
    return {
      stats: null,
      works: null,
      stockPairs: 0,
      owed: null,
      error: saveFailureMessage(error, "Could not load the factory board."),
    };
  }
}

export default async function FactoryDashboardPage() {
  // Nepal's day, not the server's — a board opened at 6am in the workshop must
  // show that morning's work, whatever timezone the machine runs in.
  const [loaded, inbox] = await Promise.all([
    loadBoard(nepalDateKey()),
    workerInboxCounts().catch(() => ({ photos: 0, requests: 0 })),
  ]);

  if (!loaded.stats || !loaded.works || !loaded.owed) {
    return (
      <LoadFailure what="the factory board" message={loaded.error} retryHref="/admin/factory" />
    );
  }

  return (
    <FactoryBoard
      stats={loaded.stats}
      stockPairs={loaded.stockPairs}
      topWorkers={topWorkers(loaded.works)}
      products={topProducts(loaded.works)}
      stages={stageTotals(loaded.works)}
      owed={loaded.owed}
      inbox={inbox}
    />
  );
}
