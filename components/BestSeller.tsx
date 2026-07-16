import ProductCard from "@/components/ProductCard";
import { getProducts } from "@/lib/product-store";

export default async function BestSeller() {
  const bestSellerProducts = (await getProducts()).filter((product) => product.bestSeller);

  return (
    <section className="bg-brand-mist py-20">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
            Best Sellers
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-brand-green-ink md:text-5xl">
            Most-loved styles, selected by repeat buyers.
          </h2>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {bestSellerProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
