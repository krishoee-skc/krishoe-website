import { NextRequest, NextResponse } from "next/server";
import {
  getUnreadAlerts,
  getUnreadAlertCount,
  getAllAlerts,
  getAlertsByType,
  getAlertStats,
  markAlertAsRead,
  markAllAlertsAsRead,
  deleteAlert,
} from "@/lib/admin-alerts";
import { requireAdminPermission } from "@/lib/admin-permissions";

export async function GET(request: NextRequest) {
  try {
    // Check admin permission
    const adminUser = await requireAdminPermission("dashboard:read");
    if (!adminUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get("action");
    const type = searchParams.get("type");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    if (action === "count") {
      const count = await getUnreadAlertCount();
      return NextResponse.json({ success: true, unread_count: count });
    }

    if (action === "stats") {
      const stats = await getAlertStats();
      return NextResponse.json({ success: true, stats });
    }

    if (action === "unread") {
      const alerts = await getUnreadAlerts();
      return NextResponse.json({
        success: true,
        count: alerts.length,
        alerts,
      });
    }

    if (type) {
      const alerts = await getAlertsByType(type as any, limit);
      return NextResponse.json({
        success: true,
        count: alerts.length,
        alerts,
      });
    }

    const alerts = await getAllAlerts(limit, offset);
    return NextResponse.json({
      success: true,
      count: alerts.length,
      offset,
      limit,
      alerts,
    });
  } catch (error) {
    console.error("Alerts fetch error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch alerts",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireAdminPermission("dashboard:read");
    if (!adminUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, alertId } = body;

    if (action === "mark_read") {
      if (!alertId) {
        return NextResponse.json(
          { error: "alertId required" },
          { status: 400 }
        );
      }
      await markAlertAsRead(alertId);
      return NextResponse.json({ success: true, alertId });
    }

    if (action === "mark_all_read") {
      await markAllAlertsAsRead();
      return NextResponse.json({ success: true, message: "All alerts marked as read" });
    }

    if (action === "delete") {
      if (!alertId) {
        return NextResponse.json(
          { error: "alertId required" },
          { status: 400 }
        );
      }
      await deleteAlert(alertId);
      return NextResponse.json({ success: true, alertId });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Alert action error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to process action",
      },
      { status: 500 }
    );
  }
}
