import { NextRequest, NextResponse } from "next/server";
import { getSMSHistory, getSMSStats } from "@/lib/sms-gateway";
import { requireAdminPermission } from "@/lib/admin-permissions";

export async function GET(request: NextRequest) {
  try {
    // Check admin permission
    const adminUser = await requireAdminPermission("notifications:read");
    if (!adminUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const phoneNumber = searchParams.get("phone");
    const orderId = searchParams.get("orderId");
    const workerId = searchParams.get("workerId");
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const stats = searchParams.get("stats") === "true";

    if (stats) {
      const days = parseInt(searchParams.get("days") || "7", 10);
      const statsData = await getSMSStats(days);
      return NextResponse.json({
        success: true,
        stats: statsData,
        period: `last ${days} days`,
      });
    }

    const messages = await getSMSHistory(
      phoneNumber || undefined,
      orderId || undefined,
      workerId || undefined,
      limit
    );

    return NextResponse.json({
      success: true,
      count: messages.length,
      messages,
    });
  } catch (error) {
    console.error("SMS logs fetch error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch SMS logs",
      },
      { status: 500 }
    );
  }
}
