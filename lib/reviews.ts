/**
 * Product Reviews Management
 * Handles review submission, moderation, and statistics
 */

import { sql } from "@vercel/postgres";

export interface ProductReview {
  id: string;
  product_id: string;
  customer_name: string;
  customer_email?: string;
  rating: number;
  title?: string;
  comment: string;
  status: "pending" | "approved" | "rejected";
  verified_purchase: boolean;
  helpful_count: number;
  unhelpful_count: number;
  response_text?: string;
  response_date?: string;
  created_at: string;
  updated_at: string;
  approved_at?: string;
}

export interface ReviewStats {
  product_id: string;
  total_reviews: number;
  approved_reviews: number;
  average_rating: number;
  five_star_count: number;
  four_star_count: number;
  three_star_count: number;
  two_star_count: number;
  one_star_count: number;
  verified_purchases: number;
  latest_review_date?: string;
}

/**
 * Submit a new product review
 */
export async function submitProductReview(
  productId: string,
  review: {
    customer_name: string;
    customer_email?: string;
    rating: number;
    title?: string;
    comment: string;
    order_id?: string;
  }
) {
  try {
    const result = await sql`
      INSERT INTO product_reviews
      (product_id, customer_name, customer_email, rating, title, comment, order_id)
      VALUES (${productId}, ${review.customer_name}, ${review.customer_email || null}, ${review.rating}, ${review.title || null}, ${review.comment}, ${review.order_id || null})
      RETURNING *;
    `;
    return result.rows[0] as ProductReview;
  } catch (error) {
    console.error("Error submitting review:", error);
    throw error;
  }
}

/**
 * Get approved reviews for a product
 */
export async function getProductReviews(productId: string, limit = 10, offset = 0) {
  try {
    const result = await sql`
      SELECT *
      FROM product_reviews
      WHERE product_id = ${productId} AND status = 'approved'
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset};
    `;
    return result.rows as ProductReview[];
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return [];
  }
}

/**
 * Get review statistics for a product
 */
export async function getProductReviewStats(productId: string): Promise<ReviewStats | null> {
  try {
    const result = await sql`
      SELECT *
      FROM product_review_stats
      WHERE product_id = ${productId};
    `;
    return result.rows[0] as ReviewStats;
  } catch (error) {
    console.error("Error fetching review stats:", error);
    return null;
  }
}

/**
 * Get pending reviews for moderation
 */
export async function getPendingReviews(limit = 20, offset = 0) {
  try {
    const result = await sql`
      SELECT *
      FROM product_reviews
      WHERE status = 'pending'
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset};
    `;
    return result.rows as ProductReview[];
  } catch (error) {
    console.error("Error fetching pending reviews:", error);
    return [];
  }
}

/**
 * Approve a review
 */
export async function approveReview(reviewId: string, response?: string) {
  try {
    const result = await sql`
      UPDATE product_reviews
      SET status = 'approved',
          approved_at = CURRENT_TIMESTAMP,
          response_text = ${response || null},
          response_date = ${response ? "CURRENT_TIMESTAMP" : null}
      WHERE id = ${reviewId}
      RETURNING *;
    `;
    return result.rows[0] as ProductReview;
  } catch (error) {
    console.error("Error approving review:", error);
    throw error;
  }
}

/**
 * Reject a review
 */
export async function rejectReview(reviewId: string) {
  try {
    const result = await sql`
      UPDATE product_reviews
      SET status = 'rejected'
      WHERE id = ${reviewId}
      RETURNING *;
    `;
    return result.rows[0] as ProductReview;
  } catch (error) {
    console.error("Error rejecting review:", error);
    throw error;
  }
}

/**
 * Mark review as helpful
 */
export async function markReviewHelpful(reviewId: string, helpful: boolean) {
  try {
    const column = helpful ? "helpful_count" : "unhelpful_count";
    const result = await sql`
      UPDATE product_reviews
      SET ${sql(`${column}`)} = ${column}::INT + 1
      WHERE id = ${reviewId}
      RETURNING *;
    `;
    return result.rows[0] as ProductReview;
  } catch (error) {
    console.error("Error marking helpful:", error);
    throw error;
  }
}

/**
 * Get review moderation dashboard stats
 */
export async function getReviewModerationStats() {
  try {
    const result = await sql`
      SELECT
        COUNT(*) as total_reviews,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_reviews,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_reviews,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_reviews,
        ROUND(AVG(CASE WHEN status = 'approved' THEN rating END), 2) as avg_rating,
        COUNT(DISTINCT product_id) as products_with_reviews
      FROM product_reviews;
    `;
    return result.rows[0];
  } catch (error) {
    console.error("Error fetching moderation stats:", error);
    return null;
  }
}
