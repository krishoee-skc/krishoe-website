import { submitProductReview, getProductReviews, getProductReviewStats } from "@/lib/reviews";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/reviews
 * Submit a new product review
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { product_id, customer_name, customer_email, rating, title, comment, order_id } = body;

    // Validation
    if (!product_id || !customer_name || !rating || !comment) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 }
      );
    }

    if (comment.length < 10) {
      return NextResponse.json(
        { error: "Comment must be at least 10 characters" },
        { status: 400 }
      );
    }

    const review = await submitProductReview(product_id, {
      customer_name,
      customer_email,
      rating,
      title,
      comment,
      order_id,
    });

    return NextResponse.json(
      {
        ok: true,
        message: "Review submitted for moderation",
        review,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error submitting review:", error);
    return NextResponse.json(
      { error: "Failed to submit review" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reviews?product_id=xxx&limit=10&offset=0
 * Get approved reviews for a product
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const product_id = searchParams.get("product_id");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!product_id) {
      return NextResponse.json(
        { error: "product_id is required" },
        { status: 400 }
      );
    }

    const [reviews, stats] = await Promise.all([
      getProductReviews(product_id, limit, offset),
      getProductReviewStats(product_id),
    ]);

    return NextResponse.json({
      ok: true,
      reviews,
      stats,
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}
