import BestSellerTabs from "@/components/BestSellerTabs";
import T from "@/components/T";
import { getProducts } from "@/lib/product-store";
import type { Product } from "@/lib/products";

type BestSellerProps = {
  products?: Product[];
};

export default async function BestSeller({ products }: BestSellerProps = {}) {
  const all = products ?? (await getProducts());
  const best = all.filter((product) => product.bestSeller);
  const trending = all.filter((product) => product.featured);
  const newArrivals = all.filter((product) => product.newArrival);

  return (
    <section className="bg-brand-mist py-20">
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
