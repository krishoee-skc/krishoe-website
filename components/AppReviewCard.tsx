"use client";

import { useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * "How was the KRISHOE app?" — asked where the shopper is happiest.
 *
 * Posts to /api/feedback as a rating, the type that endpoint already accepts —
 * so this adds no new system, only a place to leave the review. It is open to
 * everyone (no sign-in), rate-limited on the server, and read by the owner in
 * the admin. Nothing here changes anything; it only sends the star and a line.
 *
 * The star routes the shopper afterwards, the way good shops ask: a happy rating
 * (4-5) is gently offered the public review links the owner has set, where a
 * kind word brings new customers; a low one is thanked and kept private, so an
 * unhappy shopper reaches the owner rather than a public page — a chance to make
 * it right. The owner sees every rating either way.
 */
export default function AppReviewCard({
  googleReviewUrl,
  facebookReviewUrl,
}: {
  googleReviewUrl?: string;
  facebookReviewUrl?: string;
}) {
  const { text } = useLanguage();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const happy = rating >= 4;
  const hasPublicLinks = Boolean(googleReviewUrl || facebookReviewUrl);

  async function submit() {
    if (rating < 1 || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "rating",
          rating,
          title: text("App rating", "App मूल्याङ्कन"),
          // The endpoint wants at least 10 characters of detail; a short star-
          // only rating still carries a clear line so it is never rejected.
          message:
            comment.trim().length >= 10
              ? comment.trim()
              : text(`Rated the app ${rating} of 5.`, `App लाई ५ मा ${rating} दिइयो।`),
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(
          data.error ||
            text("Couldn't send just now — please try again.", "अहिले पठाउन सकिएन — फेरि प्रयास गर्नुहोस्।"),
        );
        return;
      }
      setDone(true);
    } catch {
      setError(text("Couldn't send just now — please try again.", "अहिले पठाउन सकिएन — फेरि प्रयास गर्नुहोस्।"));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mt-5 rounded-lg border border-brand-green-line bg-brand-green-mist p-5">
        <h2 className="text-lg font-black text-brand-green-ink">
          {text("Thank you! 🙏", "धन्यवाद! 🙏")}
        </h2>
        {happy && hasPublicLinks ? (
          <>
            <p className="mt-2 text-sm leading-7 text-brand-green-ink">
              {text(
                "So glad you liked it! A quick public review helps other shoppers find KRISHOE.",
                "मन परेकोमा खुसी लाग्यो! सार्वजनिक review ले अरू ग्राहकलाई KRISHOE भेट्न सजिलो हुन्छ।",
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {googleReviewUrl ? (
                <a
                  href={googleReviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center rounded-full bg-brand-green px-5 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink"
                >
                  {text("Review on Google", "Google मा review")}
                </a>
              ) : null}
              {facebookReviewUrl ? (
                <a
                  href={facebookReviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center rounded-full border border-brand-green px-5 text-sm font-bold text-brand-green transition hover:bg-brand-paper"
                >
                  {text("Review on Facebook", "Facebook मा review")}
                </a>
              ) : null}
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm leading-7 text-brand-green-ink">
            {happy
              ? text("Your rating is with the KRISHOE team.", "तपाईंको मूल्याङ्कन KRISHOE टिमसँग पुग्यो।")
              : text(
                  "Thanks for telling us — the KRISHOE team will look at this and make it better.",
                  "बताउनुभएकोमा धन्यवाद — KRISHOE टिमले हेरेर सुधार्नेछ।",
                )}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-lg border border-brand-gold bg-brand-cream-soft p-5">
      <h2 className="text-lg font-black text-brand-green-ink">
        {text("How is the KRISHOE app?", "KRISHOE app कस्तो लाग्यो?")}
      </h2>
      <p className="mt-1 text-sm text-brand-muted">
        {text("Your rating helps us make it better.", "तपाईंको राय हामीलाई अझ राम्रो बनाउँछ।")}
      </p>

      <div className="mt-3 flex gap-1" role="radiogroup" aria-label={text("Rating", "मूल्याङ्कन")}>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            aria-label={`${value}`}
            onClick={() => setRating(value)}
            onMouseEnter={() => setHover(value)}
            onMouseLeave={() => setHover(0)}
            className="text-3xl leading-none transition active:scale-90"
          >
            <span className={value <= (hover || rating) ? "text-yellow-400" : "text-gray-300"}>★</span>
          </button>
        ))}
      </div>

      {rating > 0 ? (
        <>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={2}
            placeholder={text("Anything you'd like to add… (optional)", "केही भन्नु छ?… (वैकल्पिक)")}
            className="mt-3 w-full resize-none rounded-lg border border-black/10 bg-brand-paper px-3 py-2 text-sm text-brand-green-ink outline-none focus:border-brand-green"
          />
          {error ? <p className="mt-2 text-sm font-semibold text-brand-clay">{error}</p> : null}
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="mt-3 inline-flex min-h-11 items-center rounded-full bg-brand-green px-6 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink disabled:opacity-50"
          >
            {busy ? text("Sending…", "पठाइँदै…") : text("Send rating", "राय पठाउनुहोस्")}
          </button>
        </>
      ) : null}
    </div>
  );
}
