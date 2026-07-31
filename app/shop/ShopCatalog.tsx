import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ShopCatalogControls from "@/app/shop/ShopCatalogControls";
import { type Category, type Product } from "@/lib/products";

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
    <main className="bg-brand-mist">
      <Navbar />
      <section className="mx-auto max-w-7xl px-5 py-10 md:px-8 md:py-16">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
            KRISHOE shop
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-brand-green-ink md:text-6xl">
            {heading}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-brand-muted">
            {description}
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.14em]">
            <span className="rounded-full border border-brand-green/20 bg-white px-3 py-1 text-brand-green">
              Stock checked
            </span>
            <span className="rounded-full border border-brand-green/20 bg-white px-3 py-1 text-brand-green">
              COD available
            </span>
            <span className="rounded-full border border-brand-green/20 bg-white px-3 py-1 text-brand-green">
              Nepal delivery
            </span>
          </div>
        </div>

        <ShopCatalogControls products={products} activeCategory={activeCategory} initialQuery={query} />
      </section>
      <Footer />
    </main>
  );
}
