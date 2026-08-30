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

function ReviewForm({
  productId,
  verifiedBuyer,
}: {
  productId: string;
  verifiedBuyer: boolean;
}) {
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
        {verifiedBuyer ? (
          <p className="rounded-lg bg-brand-green-mist p-3 text-sm font-semibold text-brand-green">
            {text(
              "Verified purchase — your account name will be shown with this review.",
              "किनेको पुष्टि भएको — तपाईंको खाताको नाम समीक्षासँगै देखिनेछ।",
            )}
          </p>
        ) : (
          <label className="grid gap-2 text-sm font-semibold text-brand-green-ink">
            {text("Your name", "तपाईंको नाम")}{" "}
            <span className="font-normal text-brand-muted">
              {text("— you may leave this blank", "— नलेखे पनि हुन्छ")}
            </span>
            <input
              type="text"
              name="name"
              maxLength={80}
              className="rounded-lg border border-black/10 px-4 py-3 font-normal outline-none focus:border-brand-green"
              placeholder={text("e.g. Sita K.", "जस्तै — सीता के.")}
            />
          </label>
        )}
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
        <p className="text-xs leading-5 text-brand-muted">
          {text(
            "KRISHOE reads every review before it appears in the shop.",
            "तपाईंको राय KRISHOE ले हेरेर मात्र पसलमा देखाइन्छ।",
          )}
        </p>
        {state.message ? (
          <p
            aria-live="polite"
            className={`rounded-lg p-3 text-sm font-semibold ${
              state.ok ? "bg-brand-green-mist text-brand-green" : "bg-brand-clay-tint text-brand-clay"
            }`}
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

/** One published review, shaped by the page from the shop's inbox. */
export type PublishedReview = {
  id: string;
  name: string;
  comment: string;
  rating: number;
  createdAt: string;
  verifiedPurchase: boolean;
};

type ReviewAccess = {
  canReview: boolean;
  isLoggedIn: boolean;
  reason: { en: string; ne: string };
};

export default function ProductReviews({
  product,
  reviews,
  reviewAccess,
}: {
  product: Product;
  reviews: PublishedReview[];
  reviewAccess: ReviewAccess;
}) {
  const { text, language } = useLanguage();
  const totalReviews = reviews.length;

  const averageRating =
    totalReviews > 0
      ? reviews.reduce((acc, review) => acc + review.rating, 0) / totalReviews
      : 0;

  return (
    // The id is the scroll target for the "review your pairs" invitation on a
    // closed order — without it the customer lands at the top of a long product
    // page and has to hunt for the form.
    <section id="reviews" className="scroll-mt-24 bg-brand-paper py-20">
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
            reviews.map((review) => (
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
                  <h5 className="font-bold text-brand-green-ink">
                    {review.name || text("Customer", "ग्राहक")}
                  </h5>
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
      timeZone: "Asia/Kathmandu",
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

        {/* The form is open to everyone: a shopper reading reviews before they
            buy is exactly who a review is for, and nothing appears in the shop
            until KRISHOE publishes it. A signed-in buyer whose order arrived
            gets the Verified-purchase badge; anyone else may still write, and
            is gently offered sign-in to earn the badge. */}
        <div className="mt-12 border-t border-black/10 pt-12">
          <ReviewForm productId={product.id} verifiedBuyer={reviewAccess.canReview} />
          {!reviewAccess.isLoggedIn ? (
            <p className="mt-4 max-w-lg text-sm leading-6 text-brand-muted">
              {text(
                "Bought this pair? ",
                "यो जोडी किन्नुभयो? ",
              )}
              <Link
                href={`/account/login?next=${encodeURIComponent(`/product/${product.id}`)}`}
                className="font-bold text-brand-green underline"
              >
                {text("Sign in", "साइन इन")}
              </Link>
              {text(
                " to add a Verified-purchase badge to your review.",
                " गरे समीक्षामा “किनेको पुष्टि” छाप थपिन्छ।",
              )}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
