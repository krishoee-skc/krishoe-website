import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ShopCatalogControls from "@/app/shop/ShopCatalogControls";
import T from "@/components/T";
import { type Category, type Product } from "@/lib/products";

type ShopCatalogProps = {
  products: Product[];
  activeCategory?: Category;
  query?: string;
};

/**
 * The shop's own heading, in the reader's language.
 *
 * Category titles and descriptions are not translated here: they come from the
 * catalogue, which is one shared set of words used by the storefront, the admin
 * screens and the structured data handed to Google. Translating them at this
 * one call site would make the shop disagree with itself.
 */
export default function ShopCatalog({ products, activeCategory, query = "" }: ShopCatalogProps) {
  const heading = activeCategory ? (
    `${activeCategory.title} collection`
  ) : query ? (
    <T en={`Search results for "${query}"`} ne={`"${query}" को खोजी`} />
  ) : (
    <T en="Premium pairs, ready to browse." ne="राम्रा जोडीहरू — हेर्न तयार।" />
  );

  const description = activeCategory ? (
    activeCategory.description
  ) : (
    <T
      en="Explore selected sandals, slippers, casual shoes, heels, kids styles, and seasonal arrivals."
      ne="सेन्डिल, चप्पल, दैनिक जुत्ता, हिल, बच्चाका जुत्ता — सबै एकै ठाउँमा।"
    />
  );

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
          {/* Three promises, and the reason a first-time shopper here decides to
              trust an unfamiliar shop. "COD" stays as it is: it is the term
              customers use on the phone, and "प्रसव पछि भुक्तानी" would be a
              translation nobody asks for. */}
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.14em]">
            <span className="rounded-full border border-brand-green/20 bg-white px-3 py-1 text-brand-green">
              <T en="Stock checked" ne="स्टक जाँचिएको" />
            </span>
            <span className="rounded-full border border-brand-green/20 bg-white px-3 py-1 text-brand-green">
              <T en="COD available" ne="सामान पाएपछि पैसा" />
            </span>
            <span className="rounded-full border border-brand-green/20 bg-white px-3 py-1 text-brand-green">
              <T en="Nepal delivery" ne="नेपालभरि डेलिभरी" />
            </span>
          </div>
        </div>

        <ShopCatalogControls products={products} activeCategory={activeCategory} initialQuery={query} />
      </section>
      <Footer />
    </main>
  );
}
