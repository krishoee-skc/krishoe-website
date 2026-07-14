"use client";

import { FormEvent, useState } from "react";
import type { Product } from "@/lib/products";
import { StarIcon } from "@/components/Icons";
import { submitReview, type FormState } from "@/app/actions";
import SubmitButton from "@/components/SubmitButton";

const initialState: FormState = {
  ok: false,
  message: "",
};

function StarRatingInput({ rating, setRating }: { rating: number; setRating: (r: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[...Array(5)].map((_, index) => {
        const ratingValue = index + 1;
        return (
          <button
            type="button"
            key={ratingValue}
            onClick={() => setRating(ratingValue)}
            onMouseEnter={() => setHover(ratingValue)}
            onMouseLeave={() => setHover(0)}
            className="text-2xl"
          >
            <StarIcon
              className={`h-7 w-7 transition-colors ${
                ratingValue <= (hover || rating) ? "text-yellow-400" : "text-gray-300"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

function ReviewForm({ productId }: { productId: string }) {
  const [rating, setRating] = useState(0);
  const [state, setState] = useState<FormState>(initialState);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);

    try {
      const result = await submitReview(productId, state, new FormData(event.currentTarget));
      setState(result);

      if (result.ok) {
        event.currentTarget.reset();
        setRating(0);
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 max-w-lg">
      <h4 className="text-lg font-bold text-[#10231D]">Write a Review</h4>
      <div className="mt-4 grid gap-4">
        <input type="hidden" name="rating" value={rating} />
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-[#10231D]">Your Rating</label>
          <StarRatingInput rating={rating} setRating={setRating} />
        </div>
        <label className="grid gap-2 text-sm font-semibold text-[#10231D]">
          Your Name
          <input
            name="name"
            required
            className="h-11 rounded-lg border border-black/10 px-4 font-normal outline-none focus:border-[#0B4D3B]"
            placeholder="e.g., Ram P."
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-[#10231D]">
          Your Review
          <textarea
            name="comment"
            required
            rows={4}
            className="rounded-lg border border-black/10 px-4 py-3 font-normal outline-none focus:border-[#0B4D3B]"
            placeholder="What did you like or dislike?"
          />
        </label>
      </div>
      <div className="mt-6 grid gap-3">
        <SubmitButton
          idleLabel={isPending ? "Submitting..." : "Submit Review"}
          pendingLabel="Submitting..."
          disabled={isPending}
        />
        {state.message ? (
          <p
            aria-live="polite"
            className={`rounded-lg p-3 text-sm font-semibold ${
              state.ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

export default function ProductReviews({ product }: { product: Product }) {
  const approvedReviews = product.reviews.filter((r) => r.status === "approved");
  const totalReviews = approvedReviews.length;

  const averageRating =
    totalReviews > 0
      ? approvedReviews.reduce((acc, review) => acc + review.rating, 0) / totalReviews
      : 0;

  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-4xl px-5 md:px-8">
        <h3 className="text-2xl font-bold text-[#10231D]">Customer Reviews</h3>

        {totalReviews > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <StarIcon
                  key={i}
                  className={`h-5 w-5 ${i < Math.round(averageRating) ? "text-yellow-400" : "text-gray-300"}`}
                />
              ))}
            </div>
            <p className="text-sm text-gray-600">
              {averageRating.toFixed(1)} out of 5 ({totalReviews} review{totalReviews > 1 ? "s" : ""})
            </p>
          </div>
        )}

        <div className="mt-10 space-y-8 border-t border-black/10 pt-10">
          {totalReviews > 0 ? (
            approvedReviews.map((review) => (
              <article key={review.id}>
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <StarIcon
                        key={i}
                        className={`h-4 w-4 ${i < review.rating ? "text-yellow-400" : "text-gray-300"}`}
                      />
                    ))}
                  </div>
                  <h5 className="font-bold text-[#10231D]">{review.name}</h5>
                </div>
                <p className="mt-2 text-base leading-7 text-[#5F6B66]">{review.comment}</p>
                <p className="mt-2 text-xs text-gray-400">
                  Reviewed on {new Date(review.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </p>
              </article>
            ))
          ) : (
            <p className="text-gray-500">No reviews yet. Be the first to write a review!</p>
          )}
        </div>

        <div className="mt-12 border-t border-black/10 pt-12">
          <ReviewForm productId={product.id} />
        </div>
      </div>
    </section>
  );
}
