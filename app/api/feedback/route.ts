import { NextRequest, NextResponse } from "next/server";
import { getCurrentCustomer } from "@/lib/customer-auth";
import {
  getAllFeedback,
  getFeedbackStats,
  submitFeedback,
  type FeedbackStatus,
  type FeedbackType,
} from "@/lib/feedback";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { checkAndRecordSubmissionLimit } from "@/lib/submission-rate-limit";

const feedbackTypes: FeedbackType[] = ["bug", "feature", "improvement", "rating"];
const feedbackStatuses: FeedbackStatus[] = ["new", "acknowledged", "in_progress", "resolved"];

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isFeedbackType(value: string): value is FeedbackType {
  return feedbackTypes.includes(value as FeedbackType);
}

function isFeedbackStatus(value: string): value is FeedbackStatus {
  return feedbackStatuses.includes(value as FeedbackStatus);
}

function noStore(status = 200) {
  return { status, headers: { "Cache-Control": "no-store" } };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const typeValue = cleanText(body.type, 32);
    const submittedName = cleanText(body.userName, 100);
    const submittedEmail = cleanText(body.userEmail, 160).toLowerCase();
    const submittedPhone = cleanText(body.userPhone, 32);
    const title = cleanText(body.title, 160);
    const message = cleanText(body.message, 3000);
    const rating = Math.round(Number(body.rating) || 0);
    const customer = await getCurrentCustomer();
    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const rateLimit = await checkAndRecordSubmissionLimit({
      bucket: "feedback",
      key: customer?.id || forwardedFor || request.headers.get("x-real-ip") || "local",
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
    });

    if (rateLimit.limited) {
      return NextResponse.json(
        { error: "Too many feedback submissions. Please wait and try again." },
        {
          ...noStore(429),
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }

    if (!isFeedbackType(typeValue) || !title || !message || !(customer?.name || submittedName)) {
      return NextResponse.json({ error: "Please complete all required fields." }, noStore(400));
    }

    if (title.length < 3 || message.length < 10) {
      return NextResponse.json(
        { error: "Please provide a clear title and at least 10 characters of detail." },
        noStore(400),
      );
    }

    if (typeValue === "rating" && (rating < 1 || rating > 5)) {
      return NextResponse.json({ error: "Rating must be between 1 and 5." }, noStore(400));
    }

    const id = await submitFeedback({
      type: typeValue,
      userType: "customer",
      userName: customer?.name || submittedName,
      userEmail: customer?.email || submittedEmail || undefined,
      userPhone: customer?.phone || submittedPhone || undefined,
      title,
      message,
      rating: typeValue === "rating" ? rating : undefined,
    });

    return NextResponse.json(
      { success: true, id, message: "Thank you for your feedback!" },
      noStore(201),
    );
  } catch (error) {
    console.error("Feedback submission failed:", error);
    return NextResponse.json({ error: "Failed to submit feedback." }, noStore(500));
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminPermission("feedback:read");
    const action = request.nextUrl.searchParams.get("action");

    if (action === "stats") {
      return NextResponse.json(
        { success: true, stats: await getFeedbackStats() },
        noStore(),
      );
    }

    const statusValue = request.nextUrl.searchParams.get("status") || "";
    const typeValue = request.nextUrl.searchParams.get("type") || "";
    const status = isFeedbackStatus(statusValue) ? statusValue : undefined;
    const type = isFeedbackType(typeValue) ? typeValue : undefined;
    const feedback = await getAllFeedback(status, type);

    return NextResponse.json(
      { success: true, count: feedback.length, feedback },
      noStore(),
    );
  } catch (error) {
    console.error("Feedback admin read failed:", error);
    return NextResponse.json({ error: "Admin access is required." }, noStore(403));
  }
}
