import { NextRequest, NextResponse } from "next/server";
import { getWorkerDashboardSummary } from "@/lib/worker-portal";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const workerId = searchParams.get("workerId");

    if (!workerId) {
      return NextResponse.json(
        { error: "workerId is required" },
        { status: 400 }
      );
    }

    const data = await getWorkerDashboardSummary(workerId);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Worker dashboard fetch error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch dashboard",
      },
      { status: 500 }
    );
  }
}
