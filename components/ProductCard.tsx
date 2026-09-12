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
      {/* Cream into the shop's own green, not the blue-grey this used to be.
          Every other colour in the shop sits at 37-43° on the wheel; silver-lt
          is 216°, and it was the only cool note — the eye cannot name that but
          reads it as cheap. */}
      <Link href={href} className="relative block aspect-[4/3] shrink-0 overflow-hidden bg-[radial-gradient(120%_100%_at_30%_10%,#FBF4E6,#E8F2EC)]">
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
        {/* Only a real badge — "limited", "new" — earns a corner. It used to
            fall back to the category, which is already printed in gold under
            the photo, so two of the shop's three shoes said "Ladies Sandals"
            twice on one card. A label repeated is a label unread. */}
        {product.badge?.trim() ? (
          <div className="absolute left-4 top-4 rounded-full bg-brand-paper/95 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-green shadow-sm backdrop-blur-sm">
            {product.badge}
          </div>
        ) : null}
        {outOfStock ? (
          /* Deep green, not red. Red is the colour this shop uses for a
             fault, and selling out is not one — it is the opposite. The pair
             below it offers a way to ask when it returns. */
          <div className="absolute right-3 top-3 rounded-full bg-brand-green-ink/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-white backdrop-blur-sm">
            <T en="Sold out" ne="अहिले सकियो" />
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
        {/* No reserved block. This row held 5.75rem so cards in a row kept one
            baseline, but a two-word name left most of it empty — 376px of card
            on a 360px phone, of which only 116px was the photo. The grid keeps
            the cards even now; the card itself no longer pays for it. */}
        <div className="flex items-start justify-between gap-2 md:gap-4">
          <div className="min-w-0">
            <p className="line-clamp-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-gold-deep">
              {product.category}
            </p>
            <Link href={href}>
              {/* The display face, which the shop already loads and had never
                  used on a product. Nothing new is downloaded. */}
              <h3
                className={`mt-1 line-clamp-2 font-display font-semibold leading-snug tracking-tight text-brand-green-ink transition hover:text-brand-green md:mt-1.5 ${
                  compact ? "text-[15px] md:text-lg" : "text-lg md:text-xl"
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

        {/* The height is reserved so cards in a row keep one baseline — but
            only when there is something to hold. "bag open" has no description
            yet, and an empty reserved band under its name read as a broken
            card rather than a quiet one. */}
        {/* Shown when there is one, and taking no room when there is not. The
            reserved band used to be drawn either way, which on a phone spent
            48px per card to hold nothing. */}
        {product.description?.trim() ? (
          <p className={`line-clamp-2 text-sm leading-6 text-brand-muted ${compact ? "mt-2 hidden md:block" : "mt-3"}`}>
            {product.description}
          </p>
        ) : null}

        <div
          className={`mt-auto flex items-center justify-between border-t border-black/10 ${
            compact ? "pt-2 md:pt-4" : "pt-4"
          }`}
        >
          {/* The figure a shopper looks for first, set in the display face. It
              used to be smaller than the shoe's own name. "प्रति जोडी" is here
              because this shop also sells wholesale, where the unit matters. */}
          <span className="flex items-baseline gap-1.5">
            <span className={`font-display font-black tracking-tight text-brand-green-ink ${compact ? "text-xl md:text-2xl" : "text-2xl md:text-3xl"}`}>
              {product.price}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-muted">
              <T en="per pair" ne="प्रति जोडी" />
            </span>
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
