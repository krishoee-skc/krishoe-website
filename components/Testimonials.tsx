import T from "@/components/T";
import type { Product, Review } from "@/lib/products";

/**
 * What customers actually said.
 *
 * This section used to show three invented reviews under invented Nepali names,
 * each with a 5/5 rating, while the shop had no reviews at all. That is a claim
 * about people who did not say these things, and it is the kind of thing a
 * shopper eventually discovers. It was also about to be translated into Nepali,
 * which would only have made invented praise more persuasive in the reader's
 * own language. (The three names are listed in tests/testimonials.test.ts, so
 * that restoring them fails the build; they are deliberately not repeated here,
 * because that test reads this file.)
 *
 * So it reads from the reviews the shop really has, and shows nothing until
 * there are some. An empty space is honest; a full one built from fiction is
 * not — and the fix is not to write better fake reviews but to ask real
 * customers, which the shop can now do.
 *
 * Only approved reviews appear: `pending` has not been read by anyone yet, and
 * the moderation queue exists precisely so that what reaches the storefront has
 * been looked at.
 */

const MAX_SHOWN = 3;

/**
 * The reviews this section is willing to show, in the order it shows them.
 *
 * Exported so it can be tested as plain logic: this project's test setup runs
 * in Node and leaves rendering to end-to-end checks, and every rule worth
 * guarding here — what is withheld, what ranks first, how many — lives in this
 * function rather than in the markup.
 */
export function approvedReviews(products: Product[]): Review[] {
  return products
    .flatMap((product) => product.reviews)
    .filter((review) => review.status === "approved" && review.comment.trim().length > 0)
    .sort((first, second) => {
      // A verified buyer's word outranks an unverified one; after that, newest.
      if (first.verifiedPurchase !== second.verifiedPurchase) {
        return first.verifiedPurchase ? -1 : 1;
      }
      return second.createdAt.localeCompare(first.createdAt);
    })
    .slice(0, MAX_SHOWN);
}

/**
 * The real rating, summed from real approved reviews — never a made-up 4.8.
 *
 * The showcase design asks for a big score over a bar breakdown, and this
 * gives it honestly: the average and the star distribution are computed from
 * the same approved reviews the cards below are drawn from, so it can only ever
 * say what customers actually rated. Null when there are none, so the summary
 * appears exactly when the review cards do.
 */
export function reviewSummary(products: Product[]) {
  const approved = products
    .flatMap((product) => product.reviews)
    .filter((review) => review.status === "approved");
  const count = approved.length;
  if (count === 0) return null;

  const average = approved.reduce((sum, review) => sum + review.rating, 0) / count;
  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: approved.filter((review) => Math.round(review.rating) === star).length,
  }));
  return { count, average, distribution };
}

export default function Testimonials({ products = [] }: { products?: Product[] }) {
  const reviews = approvedReviews(products);
  const summary = reviewSummary(products);

  // Nothing to show yet. The section removes itself rather than standing empty
  // with a heading over a blank row.
  if (reviews.length === 0) return null;

  return (
    <section className="bg-brand-paper py-20">
      <div className="mx-auto max-w-7xl px-6">
        <h2 className="text-center font-display text-4xl font-bold text-brand-green">
          <T en="What Our Customers Say" ne="ग्राहकहरूले के भन्नुहुन्छ" />
        </h2>

        <p className="mb-10 mt-3 text-center text-brand-muted">
          <T
            en="Trusted by customers who want comfort and clean styling."
            ne="किनेर लगाउनुभएकाहरूकै भनाइ।"
          />
        </p>

        {summary ? (
          <div className="mx-auto mb-10 flex max-w-2xl flex-col items-center gap-6 rounded-2xl border border-brand-green-line bg-brand-mist p-6 shadow-sm sm:flex-row">
            <div className="text-center">
              <p className="font-display text-5xl font-black leading-none text-brand-green">
                {summary.average.toFixed(1)}
              </p>
              <p className="mt-1 text-lg tracking-[0.2em] text-brand-gold" aria-hidden>
                {"★".repeat(Math.round(summary.average))}
                {"☆".repeat(5 - Math.round(summary.average))}
              </p>
              <p className="mt-1 text-xs text-brand-muted">
                <T en={`${summary.count} reviews`} ne={`${summary.count} राय`} />
              </p>
            </div>
            <div className="w-full flex-1">
              {summary.distribution.map((row) => (
                <div key={row.star} className="flex items-center gap-2 py-0.5 text-xs text-brand-muted">
                  <span className="w-3 tabular-nums">{row.star}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-green-line">
                    <span
                      className="block h-full rounded-full bg-brand-gold"
                      style={{ width: `${summary.count ? (row.count / summary.count) * 100 : 0}%` }}
                    />
                  </span>
                  <span className="w-6 text-right tabular-nums">{row.count}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-8 md:grid-cols-3">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="rounded-lg bg-brand-mist p-8 shadow-lg duration-300 hover:shadow-2xl"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-black tracking-[0.2em] text-brand-gold">
                  {review.rating} / 5
                </div>
                {review.verifiedPurchase ? (
                  <span className="rounded-full bg-brand-green-mist px-2.5 py-1 text-xs font-bold text-brand-green">
                    <T en="Verified buyer" ne="किनेको पक्का" />
                  </span>
                ) : null}
              </div>

              <p className="mt-5 italic text-gray-600">&ldquo;{review.comment}&rdquo;</p>

              <h3 className="mt-6 font-bold text-brand-green">{review.name}</h3>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
