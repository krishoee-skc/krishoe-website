"use client";

import { useEffect, useState } from "react";
import ReviewCard from "./ReviewCard";

interface Review {
  id: string;
  customer_name: string;
  rating: number;
  title?: string;
  comment: string;
  created_at: string;
  verified_purchase: boolean;
  response_text?: string;
  helpful_count: number;
}

interface ReviewListProps {
  productId: string;
  limit?: number;
}

export default function ReviewList({ productId, limit = 10 }: ReviewListProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"latest" | "helpful" | "rating">("latest");

  useEffect(() => {
    async function fetchReviews() {
      try {
        const response = await fetch(
          `/api/reviews?product_id=${productId}&limit=${limit}`
        );
        const data = await response.json();

        if (data.ok) {
          setReviews(data.reviews);
        }
      } catch (error) {
        console.error("Error fetching reviews:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchReviews();
  }, [productId, limit]);

  const sortedReviews = [...reviews].sort((a, b) => {
    if (sortBy === "latest") {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    } else if (sortBy === "helpful") {
      return b.helpful_count - a.helpful_count;
    } else {
      return b.rating - a.rating;
    }
  });

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-lg bg-gray-200" />
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
        <p className="text-gray-500">No reviews yet. Be the first to review!</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h3 className="font-black text-brand-green-ink">Customer Reviews ({reviews.length})</h3>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-green"
        >
          <option value="latest">Latest</option>
          <option value="helpful">Most Helpful</option>
          <option value="rating">Highest Rating</option>
        </select>
      </div>

      <div>
        {sortedReviews.map((review) => (
          <ReviewCard
            key={review.id}
            id={review.id}
            customerName={review.customer_name}
            rating={review.rating}
            title={review.title}
            comment={review.comment}
            createdAt={review.created_at}
            verifiedPurchase={review.verified_purchase}
            responseText={review.response_text}
            helpfulCount={review.helpful_count}
          />
        ))}
      </div>
    </div>
  );
}
