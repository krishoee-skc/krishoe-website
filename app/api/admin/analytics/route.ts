import { NextRequest, NextResponse } from "next/server";
import {
  getSalesTrend,
  getProductionTrend,
  getRevenueTrend,
  getKeyMetrics,
  getProductionForecast,
  getRevenueForecast,
  getGoalTrackers,
  getWorkerPerformanceMetrics,
  getInventoryTrend,
  getCustomerAnalytics,
} from "@/lib/analytics-engine";
import { requireAdminPermission } from "@/lib/admin-permissions";

export async function GET(request: NextRequest) {
  try {
    // Check admin permission
    const adminUser = await requireAdminPermission("dashboard:read");
    if (!adminUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const section = searchParams.get("section");

    // Return all analytics if no specific section requested
    if (!section) {
      const [
        salesTrend,
        productionTrend,
        revenueTrend,
        keyMetrics,
        goals,
        customerAnalytics,
      ] = await Promise.all([
        getSalesTrend(),
        getProductionTrend(),
        getRevenueTrend(),
        getKeyMetrics(),
        getGoalTrackers(),
        getCustomerAnalytics(),
      ]);

      return NextResponse.json({
        success: true,
        analytics: {
          salesTrend,
          productionTrend,
          revenueTrend,
          keyMetrics,
          goals,
          customerAnalytics,
        },
      });
    }

    // Return specific section
    let data;
    switch (section) {
      case "sales":
        data = await getSalesTrend();
        break;
      case "production":
        data = await getProductionTrend();
        break;
      case "revenue":
        data = await getRevenueTrend();
        break;
      case "metrics":
        data = await getKeyMetrics();
        break;
      case "production_forecast":
        data = await getProductionForecast();
        break;
      case "revenue_forecast":
        data = await getRevenueForecast();
        break;
      case "goals":
        data = await getGoalTrackers();
        break;
      case "workers":
        data = await getWorkerPerformanceMetrics();
        break;
      case "inventory":
        data = await getInventoryTrend();
        break;
      case "customers":
        data = await getCustomerAnalytics();
        break;
      default:
        return NextResponse.json(
          { error: "Unknown section" },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      section,
      data,
    });
  } catch (error) {
    console.error("Analytics fetch error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch analytics",
      },
      { status: 500 }
    );
  }
}
