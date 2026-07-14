import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { categories, type Category, type Product } from "@/lib/products";

type ShopCatalogProps = {
  products: Product[];
  activeCategory?: Category;
  query?: string;
};

export default function ShopCatalog({ products, activeCategory, query = "" }: ShopCatalogProps) {
  const heading = activeCategory
    ? `${activeCategory.title} collection`
    : query
      ? `Search results for "${query}"`
      : "Premium pairs, ready to browse.";
  const description = activeCategory
    ? activeCategory.description
    : "Explore selected sandals, slippers, casual shoes, heels, kids styles, and seasonal arrivals.";

  return (
    <main className="bg-[#F5F7F4]">
      <Navbar />
      <section className="mx-auto max-w-7xl px-5 py-16 md:px-8">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#B98A2E]">
            KRISHOE shop
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-[#10231D] md:text-6xl">
            {heading}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#5F6B66]">
            {description}
          </p>
        </div>

        <div className="mb-8 flex flex-wrap gap-2">
          <Link
            href="/shop"
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${
              !activeCategory ? "border-[#0B4D3B] bg-[#0B4D3B] text-white" : "border-black/10 bg-white text-[#10231D]"
            }`}
          >
            All
          </Link>
          {categories.map((item) => (
            <Link
              key={item.slug}
              href={`/shop/${item.slug}`}
              className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                activeCategory?.slug === item.slug
                  ? "border-[#0B4D3B] bg-[#0B4D3B] text-white"
                  : "border-black/10 bg-white text-[#10231D]"
              }`}
            >
              {item.title}
            </Link>
          ))}
        </div>

        {products.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {products.map((product, index) => (
              <ProductCard key={product.id} product={product} intent="shop" eager={index < 4} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-black/15 bg-white p-10 text-center">
            <h2 className="text-2xl font-black text-[#10231D]">No products found.</h2>
            <p className="mt-3 text-sm text-[#5F6B66]">Try another category or search term.</p>
          </div>
        )}
      </section>
      <Footer />
    </main>
  );
}
