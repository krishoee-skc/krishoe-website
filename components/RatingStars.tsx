"use client";

import { StarIcon } from "@/components/Icons";

interface RatingStarsProps {
  averageRating: number;
  totalReviews: number;
  distribution?: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

export default function RatingStars({
  averageRating,
  totalReviews,
  distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
}: RatingStarsProps) {
  if (totalReviews === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <p className="text-center text-sm text-gray-500">No reviews yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      {/* Average Rating */}
      <div className="flex items-center gap-4">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-black text-brand-green-ink">
              {averageRating.toFixed(1)}
            </span>
            <span className="text-sm text-gray-500">/5</span>
          </div>
          <p className="mt-1 text-sm text-gray-500">{totalReviews} reviews</p>
        </div>

        {/* Stars */}
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <StarIcon
              key={star}
              className={`h-5 w-5 ${
                star <= Math.round(averageRating)
                  ? "fill-brand-gold text-brand-gold"
                  : "fill-gray-200 text-gray-200"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Distribution */}
      <div className="mt-6 space-y-3">
        {[5, 4, 3, 2, 1].map((rating) => {
          const count = distribution[rating as keyof typeof distribution] || 0;
          const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;

          return (
            <div key={rating} className="flex items-center gap-3">
              <span className="w-12 text-sm font-semibold text-gray-600">{rating} ⭐</span>
              <div className="h-2 flex-1 rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-brand-gold transition-all"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="w-12 text-right text-sm text-gray-500">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
