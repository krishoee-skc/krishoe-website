import Link from "next/link";
import T from "@/components/T";
import ProductCard from "@/components/ProductCard";
import { getProducts } from "@/lib/product-store";
import type { Product } from "@/lib/products";

type FeaturedProductsProps = {
  products?: Product[];
};

export default async function FeaturedProducts({ products }: FeaturedProductsProps = {}) {
  const featuredProducts = (products ?? await getProducts()).filter((product) => product.featured);

  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
              <T en="Featured Collection" ne="छानिएका जुत्ता" />
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-brand-green-ink md:text-5xl">
              <T en="Polished pairs for daily confidence." ne="दिनहुँ लगाउन मिल्ने, हेर्दा राम्रो।" />
            </h2>
          </div>
          <Link
            href="/shop"
            className="inline-flex h-11 w-fit items-center rounded-full border border-brand-green px-5 text-sm font-semibold text-brand-green transition hover:bg-brand-green hover:text-white"
          >
            <T en="View all products" ne="सबै जुत्ता हेर्ने" />
          </Link>
        </div>

        <div className="mobile-product-rail mt-10 md:grid md:grid-cols-2 md:gap-6 lg:grid-cols-4">
          {featuredProducts.map((product) => (
            <div key={product.id} className="mobile-product-slide">
              <ProductCard product={product} intent="shop" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
