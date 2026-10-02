import Link from "next/link";
import AutoScrollRow from "@/components/AutoScrollRow";
import ReviewFilter, { type ReviewChip } from "@/components/ReviewFilter";
import T from "@/components/T";
import { StoreIcon } from "@/components/Icons";
import type { Product, Review } from "@/lib/products";
import { initialOf, wallReviews, wallShoes, wallSummary, type ShopReview } from "@/lib/review-wall";

// Twelve, not six, now that the shoe buttons sort them: a button for a shoe
// whose reviews were cut off would show nothing.
const MAX_ON_HOME = 12;

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

/**
 * The home page wall (owner, 2026-10-01): the shoes' published reviews and the
 * shop's own together — see lib/review-wall.ts — six at most, with the shoe each
 * is about.
 */
export default function Testimonials({ products = [], shopReviews = [] }: { products?: Product[]; shopReviews?: ShopReview[] }) {
  const wall = wallReviews(products, shopReviews);
  const reviews = wall.slice(0, MAX_ON_HOME);
  const summary = wallSummary(wall);

  // Nothing published yet. The section used to remove itself entirely — which
  // meant that on the day the shop most needs reviews, the home page offered no
  // way to leave one. So it stays, as an invitation rather than an empty row of
  // quotes: no invented praise, just the door.
  if (reviews.length === 0) {
    return (
      <section className="bg-brand-paper py-8 md:py-20">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="font-display text-3xl font-black tracking-tight text-brand-green-ink md:text-5xl">
            <T en="Be the first to write one" ne="पहिलो राय तपाईंकै होस्" />
          </h2>
          <p className="mt-3 text-brand-muted">
            <T
              en="Nobody has left a review yet. If you have worn a KRISHOE pair, two lines would help the next person choose."
              ne="अहिलेसम्म कसैले राय दिनुभएको छैन। तपाईंले KRISHOE जुत्ता लगाउनुभएको छ भने, दुई हरफले अर्को ग्राहकलाई छान्न सजिलो हुन्छ।"
            />
          </p>
          <Link
            href="/review"
            className="mt-7 inline-flex min-h-12 items-center justify-center rounded-full bg-brand-green px-7 font-bold text-white transition hover:bg-brand-green-ink"
          >
            <T en="★ Leave a review" ne="★ राय दिनुहोस्" />
          </Link>
        </div>
      </section>
    );
  }

  const shoeCount = wallShoes(wall).shoes.length;
  // The buttons count what is on this page, so a number never promises cards
  // that were left off.
  const onHome = wallShoes(reviews);
  const chips: ReviewChip[] = [
    { key: "all", en: `All ${reviews.length}`, ne: `सबै ${reviews.length}` },
    ...onHome.shoes.map(({ shoe, count }) => ({ key: shoe.id, en: `${shoe.name} ${count}`, ne: `${shoe.name} ${count}` })),
    ...(onHome.shop > 0 ? [{ key: "shop", en: `The shop ${onHome.shop}`, ne: `पसल ${onHome.shop}` }] : []),
  ];
  return (
    <section className="bg-brand-paper py-10 md:py-20" data-review-wall>
      <div className="mx-auto max-w-7xl px-5 md:px-6">
        <h2 className="text-center font-display text-2xl font-black tracking-tight text-brand-green-ink md:text-4xl">
          <T en="What our customers say" ne="ग्राहकहरूले के भन्नुहुन्छ" />
        </h2>

        {/* The reviews page's own box (owner, 2026-10-02): the real average,
            and how the stars fall, from the same reviews as the cards. Side by
            side even on a phone, so it stays one short block. */}
        {summary ? (
          <div className="mx-auto mt-5 grid max-w-3xl grid-cols-[auto_minmax(0,1fr)] items-center gap-4 rounded-2xl border border-brand-green-line bg-brand-mist p-4 shadow-sm sm:gap-7 sm:p-6">
            <div className="text-center">
              <p className="font-display text-4xl font-black leading-none text-brand-green sm:text-5xl">{summary.average.toFixed(1)}</p>
              <p className="mt-1 text-sm tracking-[0.12em] text-brand-gold sm:text-xl" aria-hidden>
                {"★".repeat(Math.round(summary.average))}
                {"☆".repeat(5 - Math.round(summary.average))}
              </p>
              <p className="mt-0.5 text-xs text-brand-muted sm:text-base">
                <T en={`${summary.count} reviews`} ne={`${summary.count} राय`} />
              </p>
            </div>
            <div className="grid gap-1 sm:gap-1.5">
              {summary.distribution.map((row) => (
                <div key={row.star} className="flex items-center gap-2 text-xs text-brand-muted sm:gap-3 sm:text-sm">
                  <span className="w-6 tabular-nums sm:w-8">{row.star}★</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-brand-green-line sm:h-2.5">
                    <span className="block h-full rounded-full bg-brand-gold" style={{ width: `${(row.count / summary.count) * 100}%` }} />
                  </span>
                  <span className="w-5 text-right tabular-nums sm:w-8">{row.count}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* One row that moves on every screen; the shoe buttons above it keep
            only that shoe's reviews in it. */}
        <ReviewFilter chips={chips}>
        <AutoScrollRow className="mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {reviews.map((review) => (
            <article
              key={review.id}
              data-review-shoe={review.shoe?.id ?? "shop"}
              className="flex w-[82%] shrink-0 snap-start flex-col gap-3 rounded-2xl border border-brand-green-line bg-brand-mist p-5 shadow-sm sm:w-[46%] md:w-[31.5%] lg:w-[23.5%]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-lg tracking-[0.12em] text-brand-gold" aria-label={`${review.rating} / 5`}>
                  {"★".repeat(Math.max(0, Math.min(5, review.rating)))}
                </span>
                {review.verified ? (
                  <span className="rounded-full bg-brand-green-mist px-2.5 py-1 text-xs font-bold text-brand-green">
                    <T en="✓ Bought here" ne="✓ यहीँ किनेको" />
                  </span>
                ) : null}
              </div>
              <p className="text-lg font-semibold leading-7 text-brand-green-ink">&ldquo;{review.comment}&rdquo;</p>
              <p className="flex items-center gap-2 text-base text-brand-muted">
                <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-brand-green-wash font-black text-brand-green">
                  {initialOf(review.name)}
                </span>
                <b className="text-brand-green-ink">{review.name}</b>
              </p>
              {review.shoe ? (
                <Link
                  href={review.shoe.href}
                  className="mt-auto flex items-center gap-3 border-t border-brand-green-line pt-3 text-base font-bold text-brand-green hover:text-brand-green-ink"
                >
                  {review.shoe.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={review.shoe.image} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                  ) : null}
                  <span className="min-w-0">
                    {review.shoe.name}
                    {review.shoe.price ? <span className="font-normal text-brand-muted"> · {review.shoe.price}</span> : null} →
                  </span>
                </Link>
              ) : (
                <p className="mt-auto border-t border-brand-green-line pt-3 text-base font-bold text-brand-muted">
                  <StoreIcon className="mr-1.5 inline h-5 w-5 align-[-4px] text-brand-green" />
                  <T en="About the shop" ne="पसलबारे" />
                </p>
              )}
            </article>
          ))}
        </AutoScrollRow>
        </ReviewFilter>

        {/* The doors, directly under the reviews — where a reader just
            persuaded by other customers is most likely to add their own. */}
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            href="/review"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand-green px-7 text-base font-bold text-white transition hover:bg-brand-green-ink"
          >
            <T en="★ Leave a review" ne="★ राय दिनुहोस्" />
          </Link>
          <Link
            href="/reviews"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-brand-green px-7 text-base font-bold text-brand-green transition hover:bg-brand-green-wash"
          >
            <T
              en={`See all ${summary?.count ?? reviews.length} reviews${shoeCount > 1 ? ` · ${shoeCount} shoes` : ""}`}
              ne={`सबै ${summary?.count ?? reviews.length} राय हेर्ने`}
            />
          </Link>
        </div>
      </div>
    </section>
  );
}
