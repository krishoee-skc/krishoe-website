"use client";

import { StarIcon } from "@/components/Icons";
import { formatAdminDate } from "@/lib/format-date";

interface ReviewCardProps {
  id: string;
  customerName: string;
  rating: number;
  title?: string;
  comment: string;
  createdAt: string;
  verifiedPurchase?: boolean;
  responseText?: string;
  helpfulCount?: number;
  onMarkHelpful?: (id: string, helpful: boolean) => void;
}

export default function ReviewCard({
  id,
  customerName,
  rating,
  title,
  comment,
  createdAt,
  verifiedPurchase,
  responseText,
  helpfulCount = 0,
  onMarkHelpful,
}: ReviewCardProps) {
  return (
    <div className="border-b border-gray-100 py-6 last:border-b-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-bold text-brand-green-ink">{customerName}</p>
            {verifiedPurchase && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-black text-emerald-700">
                ✓ Verified Purchase
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500">{formatAdminDate(createdAt)}</p>
        </div>

        {/* Rating */}
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <StarIcon
              key={star}
              className={`h-4 w-4 ${
                star <= rating
                  ? "fill-brand-gold text-brand-gold"
                  : "fill-gray-200 text-gray-200"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Title */}
      {title && <h4 className="mt-3 font-bold text-brand-green-ink">{title}</h4>}

      {/* Comment */}
      <p className="mt-2 text-sm text-gray-600 leading-relaxed">{comment}</p>

      {/* Response */}
      {responseText && (
        <div className="mt-4 rounded-lg bg-brand-mist p-3">
          <p className="text-xs font-black uppercase tracking-[0.08em] text-brand-green">
            Seller Response
          </p>
          <p className="mt-1 text-sm text-gray-600">{responseText}</p>
        </div>
      )}

      {/* Helpful Buttons */}
      <div className="mt-4 flex items-center gap-3">
        <p className="text-xs text-gray-500">Was this helpful?</p>
        <button
          onClick={() => onMarkHelpful?.(id, true)}
          className="text-xs font-semibold text-brand-green transition hover:text-brand-gold"
        >
          👍 Yes ({helpfulCount})
        </button>
        <button
          onClick={() => onMarkHelpful?.(id, false)}
          className="text-xs font-semibold text-gray-500 transition hover:text-gray-700"
        >
          👎 No
        </button>
      </div>
    </div>
  );
}
