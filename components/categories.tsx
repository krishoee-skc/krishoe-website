import Image from "next/image";
import T from "@/components/T";
import Link from "next/link";

const categories = [
  {
    title: "Ladies Sandals",
    slug: "ladies-sandals",
    image: "/images/products/ladies-sandals.jpg",
  },
  {
    title: "Ladies Slippers",
    slug: "ladies-slippers",
    image: "/images/products/ladies-slippers.jpg",
  },
  {
    title: "Casual Shoes",
    slug: "casual-shoes",
    image: "/images/products/casual-shoes.jpg",
  },
  {
    title: "Party Heels",
    slug: "party-heels",
    image: "/images/products/party-heels.jpg",
  },
  {
    title: "Men's Collection",
    slug: "mens-collection",
    image: "/images/products/casual-shoes.jpg",
  },
  {
    title: "Kids Collection",
    slug: "kids-collection",
    image: "/images/products/kids-collection.jpg",
  },
  {
    title: "New Arrivals",
    slug: "new-arrivals",
    image: "/images/products/new-arrivals.jpg",
  },
];

/**
 * shoeCounts: shoes on sale in each collection, by slug. A collection with
 * none still shows — the shop means to sell it — but says "coming soon"
 * instead of opening on "No products found" (owner, 2026-09-29). Left out
 * when the catalogue could not be read, so a read failure never marks every
 * collection empty.
 */
export default function Categories({ shoeCounts }: { shoeCounts?: Record<string, number> } = {}) {
  return (
    <section className="bg-brand-mist py-8 md:py-20">
      <div className="mx-auto max-w-7xl px-6">
        <h2 className="text-center font-display text-3xl font-black tracking-tight text-brand-green-ink md:text-5xl">
          <T en="Shop by Collection" ne="किसिम अनुसार" />
        </h2>

        <p className="mb-10 mt-3 text-center text-brand-muted">
          <T en="Find your perfect footwear." ne="आफूलाई मिल्ने जुत्ता भेट्टाउनुहोस्।" />
        </p>

        {/* Round chips with a platinum-silver rim that turns purple on hover —
            the storefront's new accents. Real category photos, not emoji, so
            each reads as the shoes it leads to. Scrolls on a phone, centres on
            a wider screen. */}
        <div className="flex snap-x gap-6 overflow-x-auto pb-2 sm:flex-wrap sm:justify-center">
          {/* The collections that have shoes first, the rest smaller after them
              (owner, 2026-10-01): six full-size "coming soon" circles pushed the
              one with shoes off a phone screen. */}
          {[...categories]
            .sort((a, b) => Number((shoeCounts?.[b.slug] ?? 1) > 0) - Number((shoeCounts?.[a.slug] ?? 1) > 0))
            .map((item) => {
            const comingSoon = shoeCounts !== undefined && (shoeCounts[item.slug] ?? 0) === 0;
            const count = shoeCounts?.[item.slug] ?? 0;
            return (
              <Link
                key={item.slug}
                href={`/shop/${item.slug}`}
                className={`group flex flex-none snap-start flex-col items-center gap-3 text-center ${comingSoon ? "w-20" : "w-24"}`}
              >
                <span
                  className={`relative overflow-hidden rounded-full shadow-sm ring-2 transition duration-300 group-hover:-translate-y-1 ${
                    comingSoon ? "h-16 w-16 ring-brand-silver" : "h-24 w-24 ring-brand-green group-hover:ring-brand-gold"
                  }`}
                >
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    sizes="96px"
                    className={`object-cover transition duration-500 group-hover:scale-110 ${comingSoon ? "opacity-60 grayscale" : ""}`}
                  />
                </span>
                <span className={`font-semibold leading-tight ${comingSoon ? "text-xs text-brand-muted" : "text-sm text-brand-green-ink"}`}>
                  {item.title}
                  {!comingSoon && count > 0 ? <span className="block text-xs font-bold text-brand-green"><T en={`${count} style${count === 1 ? "" : "s"}`} ne={`${count} किसिम`} /></span> : null}
                </span>
                {comingSoon ? (
                  <span className="-mt-2 rounded-full border border-brand-gold/50 bg-brand-cream-soft px-2 py-0.5 text-[11px] font-bold leading-tight text-brand-gold-ink">
                    <T en="Coming soon" ne="छिट्टै आउँदैछ" />
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
