"use client";

import Link from "next/link";
import { useState } from "react";
import { formatAdminDate } from "@/lib/format-date";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import ConfirmDeleteButton from "@/components/admin/ConfirmDeleteButton";
import {
  deleteReviewAction,
  updateReviewStatusAction,
  rejectReviewAction,
  flagReviewAsSpamAction,
} from "@/app/admin/reviews/actions";
import type { Review } from "@/lib/products";

type ReviewRow = {
  productId: string;
  productName: string;
  productSku: string;
  review: Review;
};

function formatDate(value: string) {
  return formatAdminDate(value, { time: true });
}

function statusClass(status: Review["status"]) {
  if (status === "approved") return "bg-brand-green-tint text-brand-green";
  if (status === "rejected") return "bg-brand-clay-tint text-brand-clay";
  return "bg-brand-cream-soft text-brand-gold-ink";
}

export default function ReviewCard({ row }: { row: ReviewRow }) {
  const [showRejectionForm, setShowRejectionForm] = useState(false);
  const review = row.review as any;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div>
              <Link href={`/product/${row.productId}`} className="font-bold text-brand-green-ink hover:text-brand-green">
                {row.productName}
              </Link>
              <p className="mt-0.5 font-mono text-xs text-gray-400">{row.productSku}</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-brand-green-ink">{row.review.name}</span>
            <span className="text-sm font-black text-brand-gold-ink">{row.review.rating}★</span>
            <span className="text-xs text-gray-500">{formatDate(row.review.createdAt)}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(row.review.status)}`}>
              {row.review.status}
            </span>
            {review.flaggedAsSpam && (
              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                🚩 SPAM
              </span>
            )}
          </div>

          <p className="mt-3 leading-6 text-gray-700">{row.review.comment}</p>

          {review.rejectionReason && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-bold text-red-700">❌ Rejection Reason</p>
              <p className="mt-1 text-sm text-red-600">{review.rejectionReason}</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {row.review.status !== "approved" && (
          <form action={updateReviewStatusAction} className="inline">
            <input type="hidden" name="productId" value={row.productId} />
            <input type="hidden" name="reviewId" value={row.review.id} />
            <input type="hidden" name="status" value="approved" />
            <FormSubmitButton className="inline-flex h-9 items-center rounded-full bg-brand-green px-3 text-xs font-bold text-white transition hover:bg-brand-green/90">
              ✓ Approve
            </FormSubmitButton>
          </form>
        )}

        {row.review.status !== "rejected" && (
          <>
            <button
              type="button"
              onClick={() => setShowRejectionForm(!showRejectionForm)}
              className="inline-flex h-9 items-center rounded-full border border-red-200 px-3 text-xs font-bold text-red-700 transition hover:bg-red-50"
            >
              ✕ Reject
            </button>
            <form action={flagReviewAsSpamAction} className="inline">
              <input type="hidden" name="productId" value={row.productId} />
              <input type="hidden" name="reviewId" value={row.review.id} />
              <FormSubmitButton className="inline-flex h-9 items-center rounded-full border border-orange-200 px-3 text-xs font-bold text-orange-700 transition hover:bg-orange-50">
                🚩 Flag Spam
              </FormSubmitButton>
            </form>
          </>
        )}

        {row.review.status !== "pending" && (
          <form action={updateReviewStatusAction} className="inline">
            <input type="hidden" name="productId" value={row.productId} />
            <input type="hidden" name="reviewId" value={row.review.id} />
            <input type="hidden" name="status" value="pending" />
            <FormSubmitButton className="inline-flex h-9 items-center rounded-full border border-gray-200 px-3 text-xs font-bold text-gray-600 transition hover:border-gray-300">
              ⟲ Pending
            </FormSubmitButton>
          </form>
        )}

        <form action={deleteReviewAction} className="inline">
          <input type="hidden" name="productId" value={row.productId} />
          <input type="hidden" name="reviewId" value={row.review.id} />
          <ConfirmDeleteButton
            message={`Delete review by ${row.review.name}?`}
            className="inline-flex h-9 items-center rounded-full border border-red-300 px-3 text-xs font-bold text-red-600 transition hover:bg-red-50"
          />
        </form>
      </div>

      {showRejectionForm && (
        <form action={rejectReviewAction} className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <input type="hidden" name="productId" value={row.productId} />
          <input type="hidden" name="reviewId" value={row.review.id} />
          <label className="block text-sm font-bold text-red-700">
            Rejection Reason (optional)
          </label>
          <textarea
            name="rejectionReason"
            placeholder="e.g., Too short, not specific, promotional content, offensive language, spam..."
            className="mt-2 block w-full rounded-lg border border-red-300 px-3 py-2 text-sm"
            rows={3}
          />
          <div className="mt-3 flex gap-2">
            <FormSubmitButton className="inline-flex h-9 items-center rounded-full bg-red-600 px-3 text-xs font-bold text-white transition hover:bg-red-700">
              ✓ Reject with Reason
            </FormSubmitButton>
            <button
              type="button"
              onClick={() => setShowRejectionForm(false)}
              className="inline-flex h-9 items-center rounded-full border border-gray-300 px-3 text-xs font-bold text-gray-600 transition hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
