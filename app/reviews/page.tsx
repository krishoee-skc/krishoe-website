import type { Metadata } from "next";
import Link from "next/link";
import T from "@/components/T";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { DateDisplayRoman } from "@/components/DateDisplay";
import { getPublishedShopReviews } from "@/lib/customer-voice";
import { getProducts } from "@/lib/product-store";
import { reportError } from "@/lib/report-error";
import { initialOf, wallReviews, wallShoes, wallSummary, type ShopReview } from "@/lib/review-wall";
import { createPageMetadata } from "@/lib/seo";
import type { Product } from "@/lib/products";

export const metadata: Metadata = createPageMetadata({
  title: "Customer reviews | KRISHOE",
  description: "Real reviews from KRISHOE customers, shoe by shoe — and what they say about the shop.",
  path: "/reviews",
});

/**
 * Every review the shop has published, in one place (owner, 2026-10-01): the
 * real average and how the stars fall, a chip per shoe, and each review with
 * the shoe it is about. Only what the Owner published appears; nothing is
 * invented, and an empty page says so and asks for the first.
 */
export default async function ReviewsPage({ searchParams }: { searchParams?: Promise<{ shoe?: string }> }) {
  const chosen = ((await searchParams) ?? {}).shoe ?? "";
  let products: Product[] = [];
  let shopReviews: ShopReview[] = [];
  try {
    [products, shopReviews] = await Promise.all([getProducts(), getPublishedShopReviews()]);
  } catch (error) {
    reportError("load the reviews page", error);
  }

  const wall = wallReviews(products, shopReviews);
  const summary = wallSummary(wall);
  const { shoes, shop } = wallShoes(wall);
  const shown = chosen === "shop" ? wall.filter((review) => !review.shoe) : chosen ? wall.filter((review) => review.shoe?.id === chosen) : wall;

  const chip = (href: string, label: React.ReactNode, on: boolean) => (
    <Link
      key={href}
      href={href}
      scroll={false}
      className={`inline-flex min-h-11 items-center rounded-full px-4 text-base font-bold ${
        on ? "bg-brand-green-ink text-white" : "border border-brand-green-line bg-brand-paper text-brand-green-ink hover:border-brand-green"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <main className="bg-brand-mist">
      <Navbar />
      <section className="mx-auto max-w-4xl px-5 py-8 md:px-8 md:py-14">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
          <T en="Customer reviews" ne="ग्राहकको राय" />
        </p>
        <h1 className="mt-3 font-display text-3xl font-black tracking-tight text-brand-green-ink md:text-5xl">
          <T en="What our customers say" ne="ग्राहकहरूले के भन्नुहुन्छ" />
        </h1>

        {summary ? (
          <div className="mt-6 grid gap-5 rounded-2xl border border-brand-green-line bg-brand-paper p-5 shadow-sm sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="text-center">
              <p className="font-display text-5xl font-black leading-none text-brand-green">{summary.average.toFixed(1)}</p>
              <p className="mt-1 text-xl tracking-[0.15em] text-brand-gold" aria-hidden>
                {"★".repeat(Math.round(summary.average))}
                {"☆".repeat(5 - Math.round(summary.average))}
              </p>
              <p className="mt-1 text-base text-brand-muted">
                <T en={`${summary.count} reviews`} ne={`${summary.count} राय`} />
              </p>
            </div>
            <div className="grid gap-1">
              {summary.distribution.map((row) => (
                <div key={row.star} className="flex items-center gap-3 text-base text-brand-muted">
                  <span className="w-8 tabular-nums">{row.star}★</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-brand-green-line">
                    <span className="block h-full rounded-full bg-brand-gold" style={{ width: `${(row.count / summary.count) * 100}%` }} />
                  </span>
                  <span className="w-8 text-right tabular-nums">{row.count}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {wall.length > 0 ? (
          <nav className="mt-6 flex flex-wrap gap-2" aria-label="Shoes">
            {chip("/reviews", <T en={`All ${wall.length}`} ne={`सबै ${wall.length}`} />, !chosen)}
            {shoes.map(({ shoe, count }) => chip(`/reviews?shoe=${shoe.id}`, `${shoe.name} ${count}`, chosen === shoe.id))}
            {shop > 0 ? chip("/reviews?shoe=shop", <T en={`The shop ${shop}`} ne={`पसल ${shop}`} />, chosen === "shop") : null}
          </nav>
        ) : null}

        <div className="mt-6 grid gap-4">
          {shown.length === 0 ? (
            <p className="rounded-2xl border border-brand-green-line bg-brand-paper px-5 py-10 text-center text-lg text-brand-muted">
              <T en="No review here yet." ne="यहाँ अहिलेसम्म राय छैन।" />
            </p>
          ) : (
            shown.map((review) => (
              <article key={review.id} className="grid gap-3 rounded-2xl border border-brand-green-line bg-brand-paper p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-3">
                    <span aria-hidden className="grid h-10 w-10 place-items-center rounded-full bg-brand-green-wash text-lg font-black text-brand-green">
                      {initialOf(review.name)}
                    </span>
                    <b className="text-lg text-brand-green-ink">{review.name}</b>
                    {review.verified ? (
                      <span className="rounded-full bg-brand-green-mist px-2.5 py-1 text-xs font-bold text-brand-green">
                        <T en="✓ Bought here" ne="✓ यहीँ किनेको" />
                      </span>
                    ) : null}
                  </p>
                  <DateDisplayRoman date={review.createdAt} className="text-sm text-brand-muted" />
                </div>
                <p className="text-lg tracking-[0.12em] text-brand-gold" aria-label={`${review.rating} / 5`}>
                  {"★".repeat(Math.max(0, Math.min(5, review.rating)))}
                </p>
                <p className="text-lg leading-8 text-brand-green-ink">{review.comment}</p>
                {review.shoe ? (
                  <Link href={review.shoe.href} className="flex w-fit items-center gap-3 text-base font-bold text-brand-green hover:text-brand-green-ink">
                    {review.shoe.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={review.shoe.image} alt="" loading="lazy" className="h-11 w-11 rounded-lg object-cover" />
                    ) : null}
                    <span>
                      <T en="on" ne="जुत्ता:" /> {review.shoe.name}
                      {review.shoe.price ? <span className="font-normal text-brand-muted"> · {review.shoe.price}</span> : null} →
                    </span>
                  </Link>
                ) : (
                  <p className="text-base font-bold text-brand-muted">
                    🏪 <T en="About the shop" ne="पसलबारे" />
                  </p>
                )}
              </article>
            ))
          )}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/review"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand-green px-7 text-base font-bold text-white transition hover:bg-brand-green-ink"
          >
            <T en="★ Leave a review" ne="★ राय दिनुहोस्" />
          </Link>
        </div>
      </section>
      <Footer />
    </main>
  );
}
