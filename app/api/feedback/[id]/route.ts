import { NextRequest, NextResponse } from "next/server";
import { updateFeedbackStatus } from "@/lib/feedback";
import { requireAdminPermission } from "@/lib/admin-permissions";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminPermission("feedback:write");
  } catch {
    return NextResponse.json(
      { error: "Feedback write access is required." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const { id } = await params;
    const { status } = await request.json();

    if (!status || !["new", "acknowledged", "in_progress", "resolved"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    await updateFeedbackStatus(id, status);

    return NextResponse.json({
      success: true,
      message: "Feedback status updated",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Feedback status update failed:", error);
    return NextResponse.json(
      { error: "Failed to update feedback" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
