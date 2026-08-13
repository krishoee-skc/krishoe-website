import { NextRequest, NextResponse } from "next/server";
import {
  getErrorStats,
  getPerformanceStats,
  getUptimePercentage,
  checkSystemHealth,
} from "@/lib/monitoring";
import { requireAdminPermission } from "@/lib/admin-permissions";

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
      const uptime = await getUptimePercentage(30);
      return NextResponse.json({ success: true, uptime });
    }

    if (section === "health") {
      const health = await checkSystemHealth();
      return NextResponse.json({ success: true, health });
    }

    // Return all stats
    const [errors, performance, uptime, health] = await Promise.all([
      getErrorStats(hours),
      getPerformanceStats(hours),
      getUptimePercentage(30),
      checkSystemHealth(),
    ]);

    return NextResponse.json({
      success: true,
      monitoring: {
        errors,
        performance,
        uptime,
        health,
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
