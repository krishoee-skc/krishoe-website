import { authorizeFactoryApi } from "@/lib/factory-api-access";
import { submitCustomerFeedback, getCustomerFeedback } from "@/lib/customer-engagement-gateway";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customer_id, order_id, feedback_type, rating, title, message, product_mentioned } = body;

    if (!customer_id || !feedback_type || !message) {
      return NextResponse.json(
        { error: "customer_id, feedback_type, and message are required" },
        { status: 400 }
      );
    }

    const feedback = await submitCustomerFeedback({
      customer_id,
      order_id: order_id || undefined,
      feedback_type,
      rating: rating ? parseInt(rating) : undefined,
      title: title || undefined,
      message,
      product_mentioned: product_mentioned || undefined,
    });

    return NextResponse.json(feedback, { status: 201 });
  } catch (error) {
    console.error("Error submitting feedback:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit feedback" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const denied = await authorizeFactoryApi("/api/customers/feedback", "GET");
  if (denied) return denied;

  try {
    const customerId = request.nextUrl.searchParams.get("customer_id");

    if (!customerId) {
      return NextResponse.json(
        { error: "customer_id is required" },
        { status: 400 }
      );
    }

    const feedback = await getCustomerFeedback(customerId);

    return NextResponse.json({ feedback });
  } catch (error) {
    console.error("Error fetching feedback:", error);
    return NextResponse.json(
      { error: "Failed to fetch feedback" },
      { status: 500 }
    );
  }
}
