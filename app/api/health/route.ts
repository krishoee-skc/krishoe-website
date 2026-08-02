import { getDataBackendConfig } from "@/lib/data-backend";
import { queryPostgres } from "@/lib/postgres/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getDataBackendConfig();
  let database: "ready" | "local" | "unavailable" =
    config.backend === "postgres" ? "unavailable" : "local";

  if (!config.isSupported || (config.backend === "postgres" && !config.hasDatabaseUrl)) {
    return Response.json(
      { app: "KRISHOE", ok: false, database: "unavailable", checkedAt: new Date().toISOString() },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (config.backend === "postgres") {
    try {
      const rows = await queryPostgres<{ ok: number }>("health check", "SELECT 1 AS ok");
      database = rows[0]?.ok === 1 ? "ready" : "unavailable";
    } catch {
      database = "unavailable";
    }
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
        "Cache-Control": "no-store",
      },
    },
  );
}
