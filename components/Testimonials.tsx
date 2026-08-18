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

export default function Testimonials({ products = [] }: { products?: Product[] }) {
  const reviews = approvedReviews(products);

  // Nothing to show yet. The section removes itself rather than standing empty
  // with a heading over a blank row.
  if (reviews.length === 0) return null;

  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-6">
        <h2 className="text-center text-4xl font-bold text-brand-green">
          <T en="What Our Customers Say" ne="ग्राहकहरूले के भन्नुहुन्छ" />
        </h2>

        <p className="mb-12 mt-3 text-center text-gray-500">
          <T
            en="Trusted by customers who want comfort and clean styling."
            ne="किनेर लगाउनुभएकाहरूकै भनाइ।"
          />
        </p>

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
