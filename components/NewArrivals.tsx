import Link from "next/link";
import T from "@/components/T";
import ProductCard from "@/components/ProductCard";
import { getProducts } from "@/lib/product-store";
import type { Product } from "@/lib/products";

type NewArrivalsProps = {
  products?: Product[];
};

export default async function NewArrivals({ products }: NewArrivalsProps = {}) {
  const all = products ?? (await getProducts());

  /**
   * The newest shoes, however the shop labels them.
   *
   * This row filtered on the `newArrival` flag and drew its heading either
   * way, so a shop that has not ticked that box on anything — this shop —
   * showed "New Arrivals · Discover the latest KRISHOE styles" above a bare
   * button. The owner's screenshot caught it.
   *
   * Tagged products win when there are any. Otherwise the shop's own newest
   * four stand in, which is what the heading promises anyway.
   */
  const tagged = all.filter((product) => product.newArrival);
  const newArrivalProducts = (tagged.length > 0 ? tagged : all).slice(0, 4);

  // A shop with nothing to show says nothing. A heading and a "browse" button
  // over an empty shelf sends a customer to an empty page.
  if (newArrivalProducts.length === 0) return null;

  return (
    <section className="bg-brand-paper py-8 md:py-20">
      <div className="mx-auto max-w-7xl px-6">
        <h2 className="text-center font-display text-3xl font-black tracking-tight text-brand-green-ink md:text-5xl text-brand-green">
          <T en="New Arrivals" ne="नयाँ आएका" />
        </h2>

        <p className="mb-12 mt-3 text-center text-gray-500">
          <T en="Discover the latest KRISHOE styles." ne="KRISHOE का नयाँ जुत्ता हेर्नुहोस्।" />
        </p>

        <div className="mobile-product-rail md:grid md:grid-cols-2 md:gap-6 lg:grid-cols-4">
          {newArrivalProducts.map((product) => (
            <div key={product.id} className="mobile-product-slide">
              <ProductCard product={product} intent="shop" />
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/shop?category=new-arrivals"
            className="inline-flex h-11 items-center rounded-full border border-brand-green px-5 text-sm font-bold text-brand-green transition hover:bg-brand-green hover:text-white"
          >
            <T en="Browse new arrivals" ne="नयाँ जुत्ता हेर्ने" />
          </Link>
        </div>
      </div>
    </section>
  );
}
