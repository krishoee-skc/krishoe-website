import { NextRequest, NextResponse } from "next/server";
import { updateFeedbackStatus } from "@/lib/feedback";
import { requireAdminPermission } from "@/lib/admin-permissions";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminUser = await requireAdminPermission();
    if (!adminUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { status } = await request.json();

    if (!status || !["new", "acknowledged", "in_progress", "resolved"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    await updateFeedbackStatus(params.id, status);

    return NextResponse.json({
      success: true,
      message: "Feedback status updated",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update feedback" },
      { status: 500 }
    );
  }
}
