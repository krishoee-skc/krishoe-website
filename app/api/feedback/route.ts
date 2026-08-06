import { NextRequest, NextResponse } from "next/server";
import { submitFeedback, getFeedbackStats, getAllFeedback } from "@/lib/feedback";
import { requireAdminPermission } from "@/lib/admin-permissions";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, userType, userName, userEmail, userPhone, title, message, rating, url } = body;

    if (!type || !userType || !userName || !title || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const id = await submitFeedback({
      type,
      userType,
      userName,
      userEmail,
      userPhone,
      title,
      message,
      rating: rating ? parseInt(rating) : undefined,
      url,
    });

    return NextResponse.json({
      success: true,
      id,
      message: "Thank you for your feedback!",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit feedback" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminPermission("dashboard:read");

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get("action");

    if (action === "stats") {
      const stats = await getFeedbackStats();
      return NextResponse.json({ success: true, stats });
    }

    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const feedback = await getAllFeedback(status as any, type as any);

    return NextResponse.json({
      success: true,
      count: feedback.length,
      feedback,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch feedback" },
      { status: 500 }
    );
  }
}
