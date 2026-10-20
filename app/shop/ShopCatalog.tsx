import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ShopCatalogControls from "@/app/shop/ShopCatalogControls";
import T from "@/components/T";
import { type Category, type Product } from "@/lib/products";
import { loadShelfCounts } from "@/lib/shop-shelves";

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
export default async function ShopCatalog({ products, activeCategory }: ShopCatalogProps) {
  const shelfCounts = await loadShelfCounts();
  // One line, so the shoes are on the first screen of a phone (owner,
  // 2026-10-20, rule 2): a shopper from an advert who sees no shoe in three
  // seconds goes back. The long title, the paragraph and the three chips stood
  // above every pair.
  const heading = activeCategory ? activeCategory.title : <T en="Shop" ne="पसल" />;
  const shoes = products.length;

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
      <section className="mx-auto max-w-7xl px-5 py-4 md:px-8 md:py-12">
        <div className="mb-3 md:mb-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h1 className="text-2xl font-black tracking-tight text-brand-green-ink md:text-5xl">
              {heading}
              <span className="ml-2 text-base font-bold text-brand-muted md:text-2xl">
                · <T en={`${shoes} ${shoes === 1 ? "shoe" : "shoes"}`} ne={`${shoes} जुत्ता`} />
              </span>
            </h1>
            {/* The two promises a first-time shopper decides on, kept on one
                line. "COD" stays as it is: it is the word customers use. */}
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-green">
              <T en="COD · Nepal delivery" ne="सामान पाएपछि पैसा · नेपालभरि" />
            </p>
          </div>
          {/* The words about the shelf, from a tablet up; a phone goes straight to the shoes. */}
          <p className="mt-3 hidden max-w-2xl text-sm leading-7 text-brand-muted md:block">{description}</p>
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
        <ShopCatalogControls products={products} activeCategory={activeCategory} shelfCounts={shelfCounts} />
      </section>
      <Footer />
    </main>
  );
}
