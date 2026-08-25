import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ShopCatalogControls from "@/app/shop/ShopCatalogControls";
import T from "@/components/T";
import { type Category, type Product } from "@/lib/products";

type ShopCatalogProps = {
  products: Product[];
  activeCategory?: Category;
};

/**
 * The shop's own heading, in the reader's language.
 *
 * Category titles and descriptions are not translated here: they come from the
 * catalogue, which is one shared set of words used by the storefront, the admin
 * screens and the structured data handed to Google. Translating them at this
 * one call site would make the shop disagree with itself.
 *
 * The heading no longer changes for a search. It used to read "Search results
 * for X", which meant the page had to be built per visitor — two seconds of
 * waiting on the page where customers choose a pair, to restate a word they had
 * just typed and can still see in the search box below it.
 */
export default function ShopCatalog({ products, activeCategory }: ShopCatalogProps) {
  const heading = activeCategory ? (
    `${activeCategory.title} collection`
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
            <span className="rounded-full border border-brand-green/20 bg-brand-paper px-3 py-1 text-brand-green">
              <T en="Stock checked" ne="स्टक जाँचिएको" />
            </span>
            <span className="rounded-full border border-brand-green/20 bg-brand-paper px-3 py-1 text-brand-green">
              <T en="COD available" ne="सामान पाएपछि पैसा" />
            </span>
            <span className="rounded-full border border-brand-green/20 bg-brand-paper px-3 py-1 text-brand-green">
              <T en="Nepal delivery" ne="नेपालभरि डेलिभरी" />
            </span>
          </div>
        </div>

        {/* No Suspense boundary any more, and that is the point.
            It was here to keep the route prerendered while the controls read
            the search term with useSearchParams — but a boundary around a
            component that opts out of prerendering means the FALLBACK is what
            gets baked into the page. What shipped as /shop was an empty 60vh
            box: no product, no photograph, nothing for the browser's preload
            scanner to find, and every image fetched only once the JavaScript
            had arrived and hydrated. One shopper waited 5.5 seconds to see a
            shoe. The controls read the URL after mounting now, so the whole
            grid prerenders and the photographs are in the page itself. */}
        <ShopCatalogControls products={products} activeCategory={activeCategory} />
      </section>
      <Footer />
    </main>
  );
}
