import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { getProducts } from "@/lib/product-store";

export default async function NewArrivals() {
  const products = (await getProducts()).filter((product) => product.newArrival).slice(0, 4);

  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-6">
        <h2 className="text-center text-4xl font-bold text-brand-green">
          New Arrivals
        </h2>

        <p className="mb-12 mt-3 text-center text-gray-500">
          Discover the latest KRISHOE styles.
        </p>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/shop?category=new-arrivals"
            className="inline-flex h-11 items-center rounded-full border border-brand-green px-5 text-sm font-bold text-brand-green transition hover:bg-brand-green hover:text-white"
          >
            Browse new arrivals
          </Link>
        </div>
      </div>
    </section>
  );
}
