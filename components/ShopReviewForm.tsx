"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { submitReview, type FormState } from "@/app/actions";
import SubmitButton from "@/components/SubmitButton";
import { StarRatingInput } from "@/components/ProductReviews";
import { useLanguage } from "@/components/LanguageProvider";

const initialState: FormState = { ok: false, message: "" };

export type ReviewableProduct = {
  id: string;
  name: string;
};

/**
 * Leaving a review without first finding the shoe.
 *
 * The form on a product page has always worked and is open to everyone, but the
 * only door to it was inside a single shoe's page: a customer had to open the
 * shop, find the pair they bought, and scroll. Customers told the owner they
 * could not find where to leave a review, and they were right — there was no
 * link to it in the menu, the footer, the phone tab bar or the home page.
 *
 * So the shoe becomes a field in the form instead of a place you must already
 * be standing. Everything else is the existing path: the same server action,
 * the same rate limit, the same Verified-purchase rule, and the same moderation
 * queue — nothing reaches the shop until the owner publishes it.
 */
export default function ShopReviewForm({ products }: { products: ReviewableProduct[] }) {
  const { text } = useLanguage();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [rating, setRating] = useState(0);
  const [state, setState] = useState<FormState>(initialState);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setIsPending(true);

    try {
      const result = await submitReview(productId, state, new FormData(form));
      setState(result);

      if (result.ok) {
        form.reset();
        setRating(0);
        setProductId(products[0]?.id ?? "");
      }
    } finally {
      setIsPending(false);
    }
  }

  if (products.length === 0) {
    return (
      <p className="rounded-lg border border-brand-green-line bg-brand-paper p-5 text-sm font-semibold text-brand-muted">
        {text(
          "The shop has no shoes listed yet, so there is nothing to review. Please come back soon.",
          "पसलमा अहिले कुनै जुत्ता राखिएको छैन, त्यसैले राय दिन मिल्दैन। केही समयपछि आउनुहोस्।",
        )}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <input type="hidden" name="rating" value={rating} />

      <label className="grid gap-2 text-sm font-semibold text-brand-green-ink">
        {text("Which shoe?", "कुन जुत्ता?")}
        <select
          name="productId"
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
          required
          className="min-h-12 rounded-lg border border-black/10 bg-brand-paper px-4 py-3 font-normal outline-none focus:border-brand-green"
        >
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-2">
        <span className="text-sm font-semibold text-brand-green-ink">
          {text("Your rating", "तपाईंको मूल्याङ्कन")}
        </span>
        <StarRatingInput rating={rating} setRating={setRating} />
      </div>

      <label className="grid gap-2 text-sm font-semibold text-brand-green-ink">
        {text("Your name", "तपाईंको नाम")}{" "}
        <span className="font-normal text-brand-muted">
          {text("— you may leave this blank", "— नलेखे पनि हुन्छ")}
        </span>
        <input
          type="text"
          name="name"
          maxLength={80}
          className="min-h-12 rounded-lg border border-black/10 px-4 py-3 font-normal outline-none focus:border-brand-green"
          placeholder={text("e.g. Sita K.", "जस्तै — सीता के.")}
        />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-brand-green-ink">
        {text("Your review", "तपाईंको राय")}
        <textarea
          name="comment"
          required
          rows={5}
          className="rounded-lg border border-black/10 px-4 py-3 font-normal outline-none focus:border-brand-green"
          placeholder={text("What did you like or dislike?", "के मन पर्‍यो, के मन परेन?")}
        />
      </label>

      <div className="grid gap-3">
        <SubmitButton
          idleLabel={isPending ? text("Sending…", "पठाइँदै…") : text("Send my review", "राय पठाउने")}
          pendingLabel={text("Sending…", "पठाइँदै…")}
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
        {state.ok ? (
          <Link
            href="/shop"
            className="text-sm font-bold text-brand-green underline underline-offset-2 transition hover:text-brand-green-ink"
          >
            {text("Back to the shop", "पसलमा फर्कने")}
          </Link>
        ) : null}
      </div>
    </form>
  );
}
