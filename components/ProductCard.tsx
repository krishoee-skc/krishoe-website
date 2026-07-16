import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/products";
import { ArrowRightIcon, StarIcon } from "@/components/Icons";
import ProductCardActions from "@/components/ProductCardActions";

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
  const outOfStock = product.stock <= 0;
  const lowStock = product.stock > 0 && product.stock <= 5;
  // Shop-grid cards render two-up on phones, so they use a denser mobile
  // layout; collection cards (homepage) keep the full layout everywhere.
  const compact = intent === "shop";

  return (
    <article
      id={product.id}
      className="group overflow-hidden rounded-lg border border-black/10 bg-white shadow-[0_18px_40px_rgba(11,77,59,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(11,77,59,0.14)]"
    >
      <Link href={href} className="relative block aspect-[4/3] overflow-hidden bg-brand-mist">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          loading={eager ? "eager" : "lazy"}
          className="object-cover transition duration-700 group-hover:scale-105"
        />
        <div className="absolute left-4 top-4 rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-green shadow-sm">
          {product.badge ?? product.category}
        </div>
        {outOfStock ? (
          <div className="absolute right-4 top-4 rounded-full bg-brand-danger px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-white shadow-sm">
            Sold out
          </div>
        ) : lowStock ? (
          <div className="absolute right-4 top-4 rounded-full bg-brand-gold-dark px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-white shadow-sm">
            Only {product.stock} left
          </div>
        ) : null}
      </Link>

      <div className={compact ? "space-y-2 p-3 md:space-y-4 md:p-5" : "space-y-4 p-5"}>
        <div className="flex items-start justify-between gap-2 md:gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-gold-deep">
              {product.category}
            </p>
            <Link href={href}>
              <h3
                className={`mt-1 font-semibold text-brand-green-ink transition hover:text-brand-green md:mt-2 ${
                  compact ? "text-base md:text-xl" : "text-xl"
                }`}
              >
                {product.name}
              </h3>
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-brand-green-ink px-2.5 py-1 text-xs font-semibold text-white">
            <StarIcon className="h-3.5 w-3.5 text-brand-gold-bright" />
            {product.rating}
          </div>
        </div>

        <p className={`min-h-12 text-sm leading-6 text-brand-muted ${compact ? "hidden md:block" : ""}`}>
          {product.description}
        </p>

        <div
          className={`flex items-center justify-between border-t border-black/10 ${
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
            {intent === "shop" ? "Details" : "View"}
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
        <ProductCardActions product={product} />
      </div>
    </article>
  );
}
