import BestSellerTabs from "@/components/BestSellerTabs";
import Link from "next/link";
import T from "@/components/T";
import { getProducts } from "@/lib/product-store";
import type { Product } from "@/lib/products";

type BestSellerProps = {
  products?: Product[];
};

export default async function BestSeller({ products }: BestSellerProps = {}) {
  const all = products ?? (await getProducts());

  /**
   * The shelf a shop falls back to when nothing is tagged.
   *
   * These three rows pick their shoes by a flag the owner sets per product,
   * and on a shop where nobody has ticked those boxes every row comes back
   * empty — a heading and a row of tabs over nothing, which is what the
   * owner's screenshots showed. The tabs already fall back to `best`, but on
   * such a shop `best` is empty too, so that fallback resolves to nothing.
   *
   * So the fallback reaches past it, to the products the shop actually has.
   * Not a sample and not a placeholder: real shoes a customer can buy.
   */
  const shelf = all.slice(0, 8);

  const tagged = {
    best: all.filter((product) => product.bestSeller),
    trending: all.filter((product) => product.featured),
    newArrivals: all.filter((product) => product.newArrival),
  };

  const best = tagged.best.length > 0 ? tagged.best : shelf;
  const trending = tagged.trending.length > 0 ? tagged.trending : shelf;
  const newArrivals = tagged.newArrivals.length > 0 ? tagged.newArrivals : shelf;

  // A shop with no products at all says nothing, rather than promising shoes
  // above an empty shelf.
  if (all.length === 0) return null;

  // One copy of each shoe named by any tab.
  const pool = [...new Map([...best, ...trending, ...newArrivals].map((p) => [p.id, p])).values()];

  return (
    <section className="bg-brand-mist py-8 md:py-20">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        {/* One plain heading (owner, 2026-10-02: fewer, truer words). "Most-
            loved styles, selected by repeat buyers" claimed a choosing that a
            shop of three shoes has not done. */}
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-2xl font-black tracking-tight text-brand-green-ink md:text-4xl">
            <T en="Our shoes" ne="हाम्रा जुत्ता" />
          </h2>
          <Link href="/shop" className="text-sm font-bold text-brand-green underline-offset-4 hover:underline">
            <T en="See all →" ne="सबै हेर्ने →" />
          </Link>
        </div>

        {/* Each shoe crosses the wire once, however many tabs it sits on.
            The three lists overlap heavily, and on a shop that has tagged
            nothing they are the same eight shoes three times over, because
            every tab falls back to this shelf. Sent as three arrays of whole
            products, the same catalogue rows were serialised into the page
            three times — most of why the home page weighed 46KB more than the
            shop, paid for on a phone connection. The pool is deduplicated by
            id and the tabs are named by id instead. */}
        <BestSellerTabs
          pool={pool}
          best={best.map((product) => product.id)}
          trending={trending.map((product) => product.id)}
          newArrivals={newArrivals.map((product) => product.id)}
        />
      </div>
    </section>
  );
}
