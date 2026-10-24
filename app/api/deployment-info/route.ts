import { currentDeploymentVersion } from "@/lib/deployment-version";
import { queryPostgres } from "@/lib/postgres/client";
import { NextResponse } from "next/server";
import { CACHE_30S, databaseAnswers } from "@/lib/database-answer-memo";

/**
 * Which build is serving, and whether it can reach the database.
 *
 * Open on purpose — it is what a deploy check asks, and asking it should not
 * need a login. But it used to answer with the factory's row counts as well:
 * how many workers KRISHOE employs, how many designs it makes, how much work
 * has been logged. Anyone at all could read those, watch them change week by
 * week, and learn the size of the business without ever visiting the shop.
 *
 * None of that is needed to know whether a deployment is healthy. The counts
 * are on /admin/monitoring, behind a login, where they belong.
 */

export const dynamic = "force-dynamic";

const STORE = "krishoe";

export async function GET() {
  const checkedAt = new Date().toISOString();
  const version = currentDeploymentVersion() || "local";

  // Whether the database answers, not what it holds — remembered for 30
  // seconds, so a loop of calls cannot keep it awake (lib/database-answer-memo.ts).
  const connected = await databaseAnswers(async () => {
    await queryPostgres(STORE, "SELECT 1", []);
    return true;
  });

  return connected
    ? NextResponse.json(
        { app: "KRISHOE", version, status: "ready", checkedAt, database: { connected: true } },
        { headers: { "Cache-Control": CACHE_30S } },
      )
    : NextResponse.json(
        { app: "KRISHOE", version, status: "degraded", checkedAt, database: { connected: false } },
        { headers: { "Cache-Control": CACHE_30S } },
      );
}
