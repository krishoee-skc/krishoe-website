import { queryPostgres } from "@/lib/postgres/client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const STORE = "krishoe";

type CountRow = { count: number | string };
type FactoryTable = "factory_workers" | "factory_items" | "factory_daily_work";

async function countRows(table: FactoryTable): Promise<number> {
  const rows = await queryPostgres<CountRow>(
    STORE,
    `SELECT COUNT(*)::int AS count FROM ${table}`,
  );

  return Number(rows[0]?.count ?? 0);
}

export async function GET() {
  const checkedAt = new Date().toISOString();
  const version = process.env.VERCEL_GIT_COMMIT_SHA ?? "local";

  try {
    const [workers, items, workEntries] = await Promise.all([
      countRows("factory_workers"),
      countRows("factory_items"),
      countRows("factory_daily_work"),
    ]);

    return NextResponse.json(
      {
        app: "KRISHOE",
        version,
        status: "ready",
        checkedAt,
        database: {
          connected: true,
          workers,
          items,
          work_entries: workEntries,
        },
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch {
    return NextResponse.json(
      {
        app: "KRISHOE",
        version,
        status: "degraded",
        checkedAt,
        database: {
          connected: false,
          workers: 0,
          items: 0,
          work_entries: 0,
        },
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
