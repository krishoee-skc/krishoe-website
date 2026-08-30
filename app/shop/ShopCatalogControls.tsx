"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import ProductCard from "@/components/ProductCard";
import { SearchIcon, XIcon } from "@/components/Icons";
import { categories, productReviewStats, type Category, type Product } from "@/lib/products";
import { stockLevel } from "@/lib/stock-thresholds";
import { useLanguage } from "@/components/LanguageProvider";

/**
  * Reads the URL after mounting, never during render.
  *
  * useSearchParams() is what made this whole grid disappear from the page.
  * Calling it opts the component out of prerendering, so what Next baked into
  * /shop was the Suspense fallback — an empty 60vh box — and every product
  * photograph was fetched only after the JavaScript arrived, parsed and
  * hydrated. The browser's preload scanner never saw a single image, and one
  * shopper's LCP came in at 5.5 seconds.
  *
  * The URL is still read; it is read where reading it costs nothing. On the
  * server this is undefined and the state starts empty, which is exactly what
  * the prerendered HTML shows — so the markup matches, the grid ships in the
  * page, and a shopper arriving from the search box has their query applied
  * before the browser paints.
  */
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

type AvailabilityFilter = "all" | "ready" | "low";
type SortMode = "featured" | "new" | "price-asc" | "price-desc" | "rating-desc";

type ShopCatalogControlsProps = {
  products: Product[];
  activeCategory?: Category;
};

function searchText(product: Product) {
  return [
    product.name,
    product.sku,
    product.category,
    product.badge,
    product.description,
    product.colors.join(" "),
    product.sizes.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function ratingValue(product: Product) {
  // Sort by the rating real reviews give, matching the star on the card — not
  // the manual field. A product with no reviews sorts as 0, below any that have
  // earned a score.
  return productReviewStats(product.reviews).average;
}

function sortProducts(products: Product[], sortMode: SortMode) {
  return [...products].sort((left, right) => {
    if (sortMode === "price-asc") return left.priceValue - right.priceValue;
    if (sortMode === "price-desc") return right.priceValue - left.priceValue;
    if (sortMode === "rating-desc") return ratingValue(right) - ratingValue(left);
    if (sortMode === "new") {
      return Number(right.newArrival) - Number(left.newArrival) || right.priceValue - left.priceValue;
    }

    return (
      Number(right.featured) - Number(left.featured) ||
      Number(right.bestSeller) - Number(left.bestSeller) ||
      Number(right.newArrival) - Number(left.newArrival) ||
      left.name.localeCompare(right.name)
    );
  });
}

function availabilityLabel(filter: AvailabilityFilter, products: Product[]) {
  if (filter === "ready") return `${products.filter((product) => product.stock > 0).length} ready`;
  if (filter === "low") return `${products.filter((product) => stockLevel(product.stock) === "low").length} low`;
  return `${products.length} products`;
}

/**
 * Reads the search term from the URL here rather than being handed it by the
 * server.
 *
 * `/shop?query=…` is what the site-wide search box navigates to. Having the
 * page read that on the server made every visit to /shop build a fresh page —
 * over two seconds, against well under one for the prerendered category pages.
 * This component owns the search box, so it is the natural place to read it,
 * and doing it in the browser lets the page itself be built once.
 *
 * useState seeds from the URL only on first render, which is what is wanted: a
 * shopper who then edits the box is not fighting the address bar.
 */
export default function ShopCatalogControls({
  products,
  activeCategory,
}: ShopCatalogControlsProps) {
  const { text } = useLanguage();
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState<AvailabilityFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("featured");

  // Once, on arrival. A shopper who then edits the box is not fighting the
  // address bar, which is what the previous seed-from-URL was protecting.
  useIsomorphicLayoutEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("query");
    if (fromUrl) setQuery(fromUrl);
  }, []);

  const cleanQuery = query.trim().toLowerCase();
  const visibleProducts = useMemo(() => {
    const filtered = products.filter((product) => {
      const level = stockLevel(product.stock);
      const matchesQuery = !cleanQuery || searchText(product).includes(cleanQuery);
      const matchesAvailability =
        availability === "all" ||
        (availability === "ready" && level !== "out") ||
        (availability === "low" && level === "low");

      return matchesQuery && matchesAvailability;
    });

    return sortProducts(filtered, sortMode);
  }, [availability, cleanQuery, products, sortMode]);
  const hasLocalFilters = Boolean(cleanQuery || availability !== "all" || sortMode !== "featured");

  function clearFilters() {
    setQuery("");
    setAvailability("all");
    setSortMode("featured");
  }

  return (
    <>
      <section className="mb-8 rounded-lg border border-black/10 bg-brand-paper p-4 shadow-sm md:p-5">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden">
          <Link
            href="/shop"
            className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-bold transition ${
              !activeCategory
                ? "border-brand-green bg-brand-green text-white"
                : "border-black/10 bg-brand-paper text-brand-green-ink hover:border-brand-green"
            }`}
          >
            All
          </Link>
          {categories.map((item) => (
            <Link
              key={item.slug}
              href={`/shop/${item.slug}`}
              className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-bold transition ${
                activeCategory?.slug === item.slug
                  ? "border-brand-green bg-brand-green text-white"
                  : "border-black/10 bg-brand-paper text-brand-green-ink hover:border-brand-green"
              }`}
            >
              {item.title}
            </Link>
          ))}
        </div>

        <div className="grid gap-3 border-t border-black/10 pt-4 lg:grid-cols-[1fr_180px_auto]">
          {/* Called filtering, not searching, and deliberately.
              This box and the palette in the header looked like the same
              control in two places, and a shopper could not tell which one to
              use. They do different jobs: the palette finds a pair anywhere in
              the shop, this one narrows the pairs already on screen. Naming
              them differently is most of the fix. */}
          <label className="relative block">
            <span className="sr-only">{text("Filter the pairs shown below", "तलका जुत्ता छान्ने")}</span>
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={text("Narrow these — name, colour, SKU", "यीमध्ये छान्नुहोस् — नाम, रङ, SKU")}
              className="min-h-12 w-full rounded-full border border-black/10 bg-brand-mist/60 py-2 pl-12 pr-4 text-sm font-semibold text-brand-green-ink outline-none transition focus:border-brand-green focus:bg-brand-paper"
            />
          </label>

          <label>
            <span className="sr-only">{text("Sort products", "क्रम मिलाउने")}</span>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="min-h-12 w-full rounded-full border border-black/10 bg-brand-paper px-4 text-sm font-bold text-brand-green-ink outline-none transition focus:border-brand-green"
            >
              <option value="featured">{text("Featured first", "छानिएका पहिले")}</option>
              <option value="new">{text("New arrivals", "नयाँ आएका")}</option>
              <option value="price-asc">{text("Price low to high", "सस्तोदेखि महँगो")}</option>
              <option value="price-desc">{text("Price high to low", "महँगोदेखि सस्तो")}</option>
              <option value="rating-desc">{text("Top rated", "उत्तम राय भएका")}</option>
            </select>
          </label>

          <div className="flex flex-wrap gap-2">
            {(["all", "ready", "low"] as AvailabilityFilter[]).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setAvailability(filter)}
                className={`min-h-12 rounded-full border px-4 text-sm font-bold capitalize transition ${
                  availability === filter
                    ? "border-brand-green bg-brand-green text-white"
                    : "border-black/10 bg-brand-paper text-brand-green-ink hover:border-brand-green"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="font-bold text-brand-green-ink">
            {visibleProducts.length} shown
            <span className="font-semibold text-brand-muted"> / {availabilityLabel(availability, products)}</span>
          </p>
          {hasLocalFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex min-h-9 items-center gap-2 rounded-full border border-black/10 px-3 text-xs font-black text-brand-green-ink transition hover:border-brand-green hover:text-brand-green"
            >
              <XIcon className="h-4 w-4" />
              Clear
            </button>
          ) : null}
        </div>
      </section>

      {visibleProducts.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-6 lg:grid-cols-4">
          {visibleProducts.map((product, index) => (
            <ProductCard key={product.id} product={product} intent="shop" eager={index < 4} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-brand-green/20 bg-brand-paper p-8 text-center shadow-sm md:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">{text("No match", "भेटिएन")}</p>
          <h2 className="mt-3 text-2xl font-black text-brand-green-ink">{text("No products found.", "कुनै जुत्ता भेटिएन।")}</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-brand-muted">
            {text(
              "Try a different name, color, category, or stock filter.",
              "अर्को नाम, रङ, वा किसिम राखेर हेर्नुहोस्।",
            )}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex min-h-11 items-center rounded-full bg-brand-green px-5 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink"
            >
              {text("Clear filters", "छनोट हटाउने")}
            </button>
            <Link
              href="/shop"
              className="inline-flex min-h-11 items-center rounded-full border border-brand-green px-5 text-sm font-bold text-brand-green transition hover:bg-brand-mist"
            >
              {text("Browse all", "सबै हेर्ने")}
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
