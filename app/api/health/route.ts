import type { NextRequest } from "next/server";
import { getDataBackendConfig } from "@/lib/data-backend";
import { queryPostgres } from "@/lib/postgres/client";
import { CACHE_30S, databaseAnswers } from "@/lib/database-answer-memo";

export const dynamic = "force-dynamic";

/**
 * Whether the shop answers — and, only when asked, whether its database does.
 *
 * Every check used to run `SELECT 1`. The outside checker asks forty-four times
 * a day, and Neon puts an idle database to sleep and bills every wake-up for at
 * least five minutes of compute: the checker alone kept the database awake for
 * hours a day, and the old database ran out of its quota. A check that proves
 * the site answers does not need to wake the database to do it.
 *
 * `?deep=1` still asks the database. The checker does that a few times a day
 * (see scripts/uptime-probe.mjs), so a dead database is still caught before the
 * shop opens.
 */
export async function GET(request: NextRequest) {
  const config = getDataBackendConfig();
  const deep = request.nextUrl.searchParams.get("deep") === "1";
  let database: "ready" | "local" | "unavailable" | "not-checked" =
    config.backend === "postgres" ? "not-checked" : "local";

  if (!config.isSupported || (config.backend === "postgres" && !config.hasDatabaseUrl)) {
    return Response.json(
      { app: "KRISHOE", ok: false, database: "unavailable", checkedAt: new Date().toISOString() },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (deep && config.backend === "postgres") {
    // Remembered for 30 seconds: the check is open, and a loop of deep calls
    // would otherwise keep the database awake (lib/database-answer-memo.ts).
    const answers = await databaseAnswers(async () => {
      const rows = await queryPostgres<{ ok: number }>("health check", "SELECT 1 AS ok");
      return rows[0]?.ok === 1;
    });
    database = answers ? "ready" : "unavailable";
  }

  const ok = database !== "unavailable";

  return Response.json(
    {
      app: "KRISHOE",
      ok,
      database,
      checkedAt: new Date().toISOString(),
    },
    {
      status: ok ? 200 : 503,
      headers: {
        // A deep answer may be kept at the edge for the same 30 seconds.
        "Cache-Control": deep ? CACHE_30S : "no-store",
      },
    },
  );
}
