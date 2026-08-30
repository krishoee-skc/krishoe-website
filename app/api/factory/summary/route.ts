import { authorizeFactoryApi } from "@/lib/factory-api-access";
import { queryPostgres } from "@/lib/postgres/client";
import { NextResponse } from "next/server";

const STORE = "krishoe";

/**
 * A read-only glance for the Factory Today screen: how much wage is still owed
 * to workers, and how many workers are carrying a balance.
 *
 * Owed is computed from the ledger as earned minus paid per worker, then summed,
 * rather than trusting a stored running-balance column — the same net figure the
 * salary screen settles against, so the dashboard and the payout never disagree.
 */
export async function GET() {
  const denied = await authorizeFactoryApi("/api/factory/summary", "GET");
  if (denied) return denied;

  try {
    const rows = await queryPostgres<{ total_owed: string | number; workers_owed: string | number }>(
      STORE,
      `SELECT
         COALESCE(SUM(bal), 0) AS total_owed,
         COUNT(*) FILTER (WHERE bal > 0) AS workers_owed
       FROM (
         SELECT worker_id, SUM(amount_earned) - SUM(payment_given) AS bal
         FROM factory_worker_ledger
         GROUP BY worker_id
       ) per_worker`,
    );

    const row = rows[0] ?? { total_owed: 0, workers_owed: 0 };
    return NextResponse.json({
      totalOwed: Math.max(0, Math.round(Number(row.total_owed) || 0)),
      workersOwed: Number(row.workers_owed) || 0,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load factory summary" },
      { status: 500 },
    );
  }
}
