import Link from "next/link";
import ProductText from "@/components/commerce/ProductText";
import { productImageAlt } from "@/lib/search-words";
import { productReviewStats, type Product } from "@/lib/products";
import { ArrowRightIcon, StarIcon } from "@/components/Icons";
import ProductCardActions from "@/components/ProductCardActions";
import SafeImage from "@/components/SafeImage";
import { stockLevel } from "@/lib/stock-thresholds";
import T from "@/components/T";

type ProductCardProps = {
  product: Product;
  intent?: "shop" | "collection";
  eager?: boolean;
};

export default function ProductCard({
  product,
  intent = "collection",
  eager = false,
}: ProductCardProps) {
  const href = `/product/${product.id}`;
  const level = stockLevel(product.stock);
  const outOfStock = level === "out";
  const lowStock = level === "low";
  // Shop-grid cards render two-up on phones, so they use a denser mobile
  // layout; collection cards (homepage) keep the full layout everywhere.
  const compact = intent === "shop";
  // The star comes from real published reviews, not the manual rating field.
  // No reviews yet means a "New" tag, never an invented score.
  const reviewStats = productReviewStats(product.reviews);

  return (
    <article
      id={product.id}
      className="krishoe-rise group flex h-full flex-col overflow-hidden rounded-lg border border-black/10 bg-brand-paper shadow-[0_18px_40px_rgba(11,77,59,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(11,77,59,0.14)]"
    >
      <Link href={href} className="relative block aspect-[4/3] shrink-0 overflow-hidden bg-gradient-to-br from-brand-silver-lt to-brand-mist">
        <SafeImage
          src={product.image}
          // The name alone leaves out what kind of shoe it is and where it
          // was made — the two things a Google Images search and a screen
          // reader both need.
          alt={productImageAlt(product)}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          loading={eager ? "eager" : "lazy"}
          className="object-cover transition duration-700 group-hover:scale-105"
        />
        <div className="absolute left-4 top-4 rounded-full bg-brand-paper px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-green shadow-sm">
          {product.badge ?? product.category}
        </div>
        {outOfStock ? (
          <div className="absolute right-4 top-4 rounded-full bg-brand-danger px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-white shadow-sm">
            <T en="Sold out" ne="बिक्री सकियो" />
          </div>
        ) : lowStock ? (
          <div className="absolute right-4 top-4 rounded-full bg-brand-gold-dark px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-white shadow-sm">
            <T
              en={`Only ${product.stock} left`}
              ne={`${product.stock} जोडी मात्र बाँकी`}
            />
          </div>
        ) : null}
      </Link>

      <div className={compact ? "flex flex-1 flex-col p-3 md:p-5" : "flex flex-1 flex-col p-5"}>
        <div className="flex min-h-[5.75rem] items-start justify-between gap-2 md:gap-4">
          <div className="min-w-0">
            <p className="line-clamp-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-gold-deep">
              {product.category}
            </p>
            <Link href={href}>
              <h3
                className={`mt-1 line-clamp-2 min-h-12 font-semibold leading-6 text-brand-green-ink transition hover:text-brand-green md:mt-2 md:min-h-14 md:leading-7 ${
                  compact ? "text-base md:text-xl" : "text-xl"
                }`}
              >
                <ProductText en={product.name} ne={product.nameNe} />
              </h3>
            </Link>
          </div>
          {reviewStats.count > 0 ? (
            <div className="flex shrink-0 items-center gap-1 rounded-full bg-brand-green-ink px-2.5 py-1 text-xs font-semibold text-white">
              <StarIcon className="h-3.5 w-3.5 text-brand-gold-bright" />
              {reviewStats.average.toFixed(1)}
              <span className="font-normal text-white/70">({reviewStats.count})</span>
            </div>
          ) : (
            <span className="shrink-0 rounded-full bg-brand-green-mist px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-green">
              <T en="New" ne="नयाँ" />
            </span>
          )}
        </div>

        <p className={`line-clamp-2 min-h-12 text-sm leading-6 text-brand-muted ${compact ? "hidden md:block" : "mt-4"}`}>
          {product.description}
        </p>

        <div
          className={`mt-auto flex items-center justify-between border-t border-black/10 ${
            compact ? "pt-2 md:pt-4" : "pt-4"
          }`}
        >
          <span className={`font-bold text-brand-green ${compact ? "text-lg md:text-2xl" : "text-2xl"}`}>
            {product.price}
          </span>
          <Link
            href={href}
            className={`h-11 items-center gap-2 rounded-full border border-black/10 px-4 text-sm font-semibold text-brand-green-ink transition hover:border-brand-green hover:text-brand-green ${
              compact ? "hidden md:inline-flex" : "inline-flex"
            }`}
          >
            {intent === "shop" ? <T en="Details" ne="हेर्नुहोस्" /> : <T en="View" ne="हेर्ने" />}
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
        <div className={compact ? "mt-3 md:mt-4" : "mt-4"}>
          <ProductCardActions product={product} />
        </div>
      </div>
    </article>
  );
}
