import BestSellerTabs from "@/components/BestSellerTabs";
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

  return (
    <section className="bg-brand-mist py-8 md:py-20">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
            <T en="Shop the edit" ne="छानिएका जुत्ता" />
          </p>
          <h2 className="mt-3 font-display text-3xl font-black tracking-tight text-brand-green-ink md:text-5xl">
            <T en="Most-loved styles, selected by repeat buyers." ne="फेरि-फेरि किन्नेहरूले रोजेका जुत्ता।" />
          </h2>
        </div>

        <BestSellerTabs best={best} trending={trending} newArrivals={newArrivals} />
      </div>
    </section>
  );
}
