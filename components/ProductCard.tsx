import { productPath } from "@/lib/product-url";
import Link from "next/link";
import ProductText from "@/components/commerce/ProductText";
import { productImageAlt } from "@/lib/search-words";
import { isStandInPhoto, productReviewStats, type Product } from "@/lib/products";
import NoPhotoYet from "@/components/NoPhotoYet";
import { StarIcon } from "@/components/Icons";
import ProductCardActions, { WishlistHeart } from "@/components/ProductCardActions";
import SafeImage from "@/components/SafeImage";
import CardSizes from "@/components/CardSizes";
import { stockLevel } from "@/lib/stock-thresholds";
import T from "@/components/T";

type ProductCardProps = {
  product: Product;
  intent?: "shop" | "collection";
  eager?: boolean;
};

/**
 * A shoe in a grid (owner, 2026-10-02: "two to a row on a phone, but the photo
 * big, and less writing"). The photo is most of the card — tall, 4:5, filling
 * its frame — with the heart on it; under it only what decides a click: the
 * name on one line, the stars, the price and one button.
 *
 * The category and the description are on the shoe's own page. On a card they
 * cost two to four lines and, in a shop of ladies' sandals, said "Ladies
 * Sandals" on every one. The "Details" button went too: the photo, the name
 * and the card already open the shoe.
 */
export default function ProductCard({ product, eager = false }: ProductCardProps) {
  const href = productPath(product);
  const level = stockLevel(product.stock);
  const outOfStock = level === "out";
  const lowStock = level === "low";
  // The star comes from real published reviews, not the manual rating field.
  // No reviews yet means a "New" tag, never an invented score.
  const reviewStats = productReviewStats(product.reviews);

  return (
    <article
      id={product.id}
      className="krishoe-rise group relative flex h-full flex-col overflow-hidden rounded-2xl border border-brand-green-line bg-brand-paper shadow-[0_10px_30px_rgba(11,77,59,0.07)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(11,77,59,0.13)]"
    >
      <div className="relative">
        {/* Cream into the shop's own green behind the photo. Tall, 4:5: the
            shop's photos are taken standing, and a wide frame left grey bars
            either side of a small shoe. */}
        <Link href={href} className="relative block aspect-[4/5] overflow-hidden bg-[radial-gradient(120%_100%_at_30%_10%,#FBF4E6,#E8F2EC)]">
          {isStandInPhoto(product.image) ? (
            <NoPhotoYet name={product.name} />
          ) : (
            <SafeImage
              src={product.image}
              // The name alone leaves out what kind of shoe it is and where it
              // was made — the two things a Google Images search and a screen
              // reader both need.
              alt={productImageAlt(product)}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
              // Preloaded only for the cards already on screen when the page
              // opens — priority on everything is priority on nothing.
              priority={eager}
              loading={eager ? "eager" : "lazy"}
              className="object-cover transition duration-700 group-hover:scale-105"
            />
          )}
        </Link>

        {/* One corner each: a real badge or the stock word on the left, the
            heart on the right. Only a real badge — "limited", "new" — earns
            a corner; it no longer falls back to the category. */}
        <div className="pointer-events-none absolute left-2 top-2 grid justify-items-start gap-1">
          {product.badge?.trim() ? (
            <span className="rounded-full bg-brand-paper/95 px-2.5 py-0.5 text-[11px] font-bold text-brand-green shadow-sm">
              {product.badge}
            </span>
          ) : null}
          {outOfStock ? (
            /* Deep green, not red. Red is the colour this shop uses for a
               fault, and selling out is not one. */
            <span className="rounded-full bg-brand-green-ink/85 px-2.5 py-0.5 text-[11px] font-bold text-white">
              <T en="Sold out" ne="अहिले सकियो" />
            </span>
          ) : lowStock ? (
            <span className="rounded-full bg-brand-gold-dark px-2.5 py-0.5 text-[11px] font-bold text-white">
              <T en={`Only ${product.stock} left`} ne={`${product.stock} जोडी मात्र बाँकी`} />
            </span>
          ) : null}
        </div>
        <WishlistHeart product={product} />
      </div>

      <div className="flex flex-1 flex-col p-3 md:p-4">
        {/* The name and the stars are one link. On a phone every link is held
            to a 44px tap height; the name alone in one left a gap the height
            of another line under it (rechecked on an iPhone, 2026-10-02). */}
        <Link href={href} className="block min-w-0">
          {/* The display face, on one line: a name cut to "lose hill…" over
              two lines read as broken. */}
          <h3 className="truncate font-display text-[15px] font-semibold leading-snug tracking-tight text-brand-green-ink transition hover:text-brand-green md:text-lg">
            <ProductText en={product.name} ne={product.nameNe} />
          </h3>
        <span className="mt-0.5 flex items-center gap-1 text-xs text-brand-muted">
          {reviewStats.count > 0 ? (
            <>
              <StarIcon className="h-3.5 w-3.5 text-brand-gold" />
              <b className="font-bold text-brand-green-ink">{reviewStats.average.toFixed(1)}</b>
              <span>
                · <T en={`${reviewStats.count} review${reviewStats.count === 1 ? "" : "s"}`} ne={`${reviewStats.count} राय`} />
              </span>
            </>
          ) : (
            <span className="font-bold text-brand-green">
              <T en="New" ne="नयाँ" />
            </span>
          )}
        </span>
        </Link>
        {/* Which sizes there are, before opening the shoe (owner, 2026-10-07). */}
        {!outOfStock ? <CardSizes product={product} /> : null}

        <div className="mt-auto flex items-center justify-between gap-1.5 pt-2">
          {/* The price in the body face, bold and on one line. Set in the
              display face at 30px it broke into "Rs." over "950" on a phone.
              "Per pair" stays on a wider screen — this shop sells wholesale
              too — and steps aside on a phone. */}
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span className="whitespace-nowrap text-base font-extrabold tabular-nums text-brand-green-ink md:text-lg">{product.price}</span>
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted lg:inline">
              <T en="per pair" ne="प्रति जोडी" />
            </span>
          </span>
          <ProductCardActions product={product} compact />
        </div>
      </div>
    </article>
  );
}
