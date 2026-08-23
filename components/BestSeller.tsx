import ProductCard from "@/components/ProductCard";
import T from "@/components/T";
import { getProducts } from "@/lib/product-store";
import type { Product } from "@/lib/products";

type BestSellerProps = {
  products?: Product[];
};

export default async function BestSeller({ products }: BestSellerProps = {}) {
  const bestSellerProducts = (products ?? await getProducts()).filter((product) => product.bestSeller);

  return (
    <section className="bg-brand-mist py-20">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
            <T en="Best Sellers" ne="सबैभन्दा बिक्ने" />
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-brand-green-ink md:text-5xl">
            <T en="Most-loved styles, selected by repeat buyers." ne="फेरि-फेरि किन्नेहरूले रोजेका जुत्ता।" />
          </h2>
        </div>

        <div className="mobile-product-rail mt-10 md:grid md:grid-cols-2 md:gap-6 lg:grid-cols-4">
          {bestSellerProducts.map((product) => (
            <div key={product.id} className="mobile-product-slide">
              <ProductCard product={product} intent="shop" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
