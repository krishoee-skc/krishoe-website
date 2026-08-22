"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import type { Product } from "@/lib/products";
import { StarIcon } from "@/components/Icons";
import { submitReview, type FormState } from "@/app/actions";
import SubmitButton from "@/components/SubmitButton";
import { useLanguage } from "@/components/LanguageProvider";
import { toBikramSambatNepali } from "@/lib/bikram-sambat";

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
  const { text } = useLanguage();
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
      <h4 className="text-lg font-bold text-brand-green-ink">
        {text("Write a Review", "समीक्षा लेख्नुहोस्")}
      </h4>
      <div className="mt-4 grid gap-4">
        <input type="hidden" name="rating" value={rating} />
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-brand-green-ink">
            {text("Your Rating", "तपाईंको मूल्याङ्कन")}
          </label>
          <StarRatingInput rating={rating} setRating={setRating} />
        </div>
        <p className="rounded-lg bg-brand-green-mist p-3 text-sm font-semibold text-brand-green">
          {text(
            "Verified purchase — your account name will be shown with this review.",
            "किनेको पुष्टि भएको — तपाईंको खाताको नाम समीक्षासँगै देखिनेछ।",
          )}
        </p>
        <label className="grid gap-2 text-sm font-semibold text-brand-green-ink">
          {text("Your Review", "तपाईंको समीक्षा")}
          <textarea
            name="comment"
            required
            rows={4}
            className="rounded-lg border border-black/10 px-4 py-3 font-normal outline-none focus:border-brand-green"
            placeholder={text("What did you like or dislike?", "के मन पर्‍यो, के मन परेन?")}
          />
        </label>
      </div>
      <div className="mt-6 grid gap-3">
        <SubmitButton
          idleLabel={
            isPending
              ? text("Submitting...", "पठाइँदै...")
              : text("Submit Review", "समीक्षा पठाउनुहोस्")
          }
          pendingLabel={text("Submitting...", "पठाइँदै...")}
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

type ReviewAccess = {
  canReview: boolean;
  isLoggedIn: boolean;
  reason: { en: string; ne: string };
};

export default function ProductReviews({
  product,
  reviewAccess,
}: {
  product: Product;
  reviewAccess: ReviewAccess;
}) {
  const { text, language } = useLanguage();
  const approvedReviews = product.reviews.filter((r) => r.status === "approved");
  const totalReviews = approvedReviews.length;

  const averageRating =
    totalReviews > 0
      ? approvedReviews.reduce((acc, review) => acc + review.rating, 0) / totalReviews
      : 0;

  return (
    // The id is the scroll target for the "review your pairs" invitation on a
    // closed order — without it the customer lands at the top of a long product
    // page and has to hunt for the form.
    <section id="reviews" className="scroll-mt-24 bg-white py-20">
      <div className="mx-auto max-w-4xl px-5 md:px-8">
        <h3 className="text-2xl font-bold text-brand-green-ink">
          {text("Customer Reviews", "ग्राहकका समीक्षा")}
        </h3>

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
              {text(
                `${averageRating.toFixed(1)} out of 5 (${totalReviews} review${totalReviews > 1 ? "s" : ""})`,
                `५ मा ${averageRating.toFixed(1)} (${totalReviews} समीक्षा)`,
              )}
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
                  <h5 className="font-bold text-brand-green-ink">{review.name}</h5>
                  {review.verifiedPurchase ? (
                    <span className="rounded-full bg-brand-green-mist px-2 py-1 text-[10px] font-black uppercase tracking-wide text-brand-green">
                      {text("Verified purchase", "किनेको पुष्टि")}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-base leading-7 text-brand-muted">{review.comment}</p>
                <p className="mt-2 text-xs text-gray-400">
                  {text("Reviewed on", "समीक्षा मिति")}{" "}
                  {/* Bikram Sambat for a Nepali reader, the English date
                      for everyone else — not the English calendar rendered in
                      Nepali numerals, which is what ne-NP gave and which names
                      a month no Nepali shopper counts by. */}
                  {language === "ne"
                    ? toBikramSambatNepali(review.createdAt)
                    : new Date(review.createdAt).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                </p>
              </article>
            ))
          ) : (
            <p className="text-gray-500">
              {text(
                "No reviews yet. Be the first to write a review!",
                "अझै कुनै समीक्षा छैन। पहिलो समीक्षा तपाईंले लेख्नुहोस्!",
              )}
            </p>
          )}
        </div>

        <div className="mt-12 border-t border-black/10 pt-12">
          {reviewAccess.canReview ? (
            <ReviewForm productId={product.id} />
          ) : (
            <div className="rounded-lg bg-brand-mist p-5">
              <h4 className="text-lg font-black text-brand-green-ink">
                {text("Write a review", "समीक्षा लेख्नुहोस्")}
              </h4>
              <p className="mt-2 text-sm leading-6 text-brand-muted">
                {text(reviewAccess.reason.en, reviewAccess.reason.ne)}
              </p>
              {!reviewAccess.isLoggedIn ? (
                <Link
                  href={`/account/login?next=${encodeURIComponent(`/product/${product.id}`)}`}
                  className="mt-4 inline-flex h-11 items-center rounded-full bg-brand-green px-5 text-sm font-bold text-white"
                >
                  {text("Sign in", "साइन इन")}
                </Link>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
