import { NextRequest, NextResponse } from "next/server";
import {
  getErrorStats,
  getPerformanceStats,
  getUptimeEvidence,
  checkSystemHealth,
} from "@/lib/monitoring";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { describeMigrationState, getMigrationState } from "@/lib/pending-migrations";
import { getBranchIsolationStatus } from "@/lib/branch-isolation-status";

export async function GET(request: NextRequest) {
  try {
    const adminUser = await requireAdminPermission("security:read");
    if (!adminUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const section = searchParams.get("section");
    const hours = parseInt(searchParams.get("hours") || "24", 10);

    if (section === "errors") {
      const stats = await getErrorStats(hours);
      return NextResponse.json({ success: true, data: stats });
    }

    if (section === "performance") {
      const stats = await getPerformanceStats(hours);
      return NextResponse.json({ success: true, data: stats });
    }

    if (section === "uptime") {
      const uptime = await getUptimeEvidence();
      return NextResponse.json({ success: true, uptime });
    }

    if (section === "health") {
      const health = await checkSystemHealth();
      return NextResponse.json({ success: true, health });
    }

    // Return all stats
    const [errors, performance, uptime, health, migrations, branchIsolation] = await Promise.all([
      getErrorStats(hours),
      getPerformanceStats(hours),
      getUptimeEvidence(),
      checkSystemHealth(),
      // Nothing told anybody that migrations were pending, and two blocked ones
      // sat unapplied for weeks — until every work entry started failing over a
      // constraint a migration had already dropped. Asked here so the answer is
      // on a screen somebody opens.
      getMigrationState(),
      // Written on every branch table and enforced on none of them, because the
      // role the app connects as bypasses row-level security. Shown so nobody
      // relies on a wall that is drawn and not built.
      getBranchIsolationStatus(),
    ]);

    return NextResponse.json({
      success: true,
      monitoring: {
        errors,
        performance,
        uptime,
        health,
        migrations: { ...migrations, summary: describeMigrationState(migrations) },
        branchIsolation,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Monitoring fetch error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch monitoring data",
      },
      { status: 500 }
    );
  }
}
