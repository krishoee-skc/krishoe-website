import Image from "next/image";
import T from "@/components/T";
import Link from "next/link";
import SlideRail from "@/components/SlideRail";

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
    title: "Ladies Close Shoes",
    slug: "ladies-close-shoes",
    image: "/images/products/ph-ladies-closed-shoes.svg",
  },
  {
    title: "Ladies Shoes",
    slug: "ladies-shoes",
    image: "/images/products/new-arrivals.jpg",
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
    title: "Men's Slippers",
    slug: "mens-slippers",
    image: "/images/products/ph-pu-chappal.svg",
  },
  {
    title: "Men's Shoes",
    slug: "mens-shoes",
    image: "/images/products/ph-shoes.svg",
  },
  {
    title: "Kids Collection",
    slug: "kids-collection",
    image: "/images/products/kids-collection.jpg",
  },
  {
    title: "Kids Shoes",
    slug: "kids-shoes",
    image: "/images/products/kids-collection.jpg",
  },
  {
    title: "Kids Slippers",
    slug: "kids-slippers",
    image: "/images/products/ph-bachha-rubber-kids.svg",
  },
  {
    title: "New Arrivals",
    slug: "new-arrivals",
    image: "/images/products/new-arrivals.jpg",
  },
];


/**
 * Ten sides, flat on top and bottom, like a cut stone (owner, 2026-10-02:
 * "five lines to ten" — chosen from the compare as ख२).
 */
const DECAGON =
  "polygon(65.5% 2.4%, 90.5% 20.6%, 100% 50%, 90.5% 79.4%, 65.5% 97.6%, 34.5% 97.6%, 9.5% 79.4%, 0% 50%, 9.5% 20.6%, 34.5% 2.4%)";

/**
 * shoeCounts: shoes on sale in each collection, by slug. A collection with
 * none still shows — the shop means to sell it — but says "coming soon"
 * instead of opening on "No products found" (owner, 2026-09-29). Left out
 * when the catalogue could not be read, so a read failure never marks every
 * collection empty.
 *
 * Every collection is a tile in one row that slides (owner, 2026-10-02: "show
 * them all, sliding, and not round — five-sided"). The ones with shoes come
 * first, with how many; the rest follow with their photo faded and a "coming
 * soon" tag, and still open — their page says what is coming and offers
 * WhatsApp. A line of names under one round photo left six doors with no
 * handle.
 *
 * Since 2026-10-08 (owner, from the compare): a collection with no shoes is
 * left out of the row. Seven "coming soon" tiles beside one real one told a
 * first visitor the shop was empty. A collection appears by itself the day its
 * first shoe goes on sale. Only when no collection has a shoe do they all
 * show, faded, so the row is never empty; their pages still say "coming soon".
 */
export default function Categories({ shoeCounts }: { shoeCounts?: Record<string, number> } = {}) {
  const hideEmpty = shoeCounts !== undefined && Object.values(shoeCounts).some((count) => count > 0);
  return (
    <section className="bg-brand-mist py-8 md:py-20">
      <div className="mx-auto max-w-7xl px-6">
        <h2 className="text-center font-display text-2xl font-black tracking-tight text-brand-green-ink md:text-4xl mb-6 md:mb-8">
          <T en="Shop by style" ne="किसिम अनुसार" />
        </h2>

        <SlideRail className="gap-3 px-0.5 pb-2 pt-1 sm:gap-5 lg:[&>*:first-child]:ml-auto lg:[&>*:last-child]:mr-auto">
          {[...categories]
            .filter((item) => !hideEmpty || (shoeCounts?.[item.slug] ?? 0) > 0)
            .sort((a, b) => Number((shoeCounts?.[b.slug] ?? 1) > 0) - Number((shoeCounts?.[a.slug] ?? 1) > 0))
            .map((item) => {
              const comingSoon = shoeCounts !== undefined && (shoeCounts[item.slug] ?? 0) === 0;
              const count = shoeCounts?.[item.slug] ?? 0;
              return (
                <Link
                  key={item.slug}
                  href={`/shop/${item.slug}`}
                  data-coming-soon={comingSoon || undefined}
                  className="group flex w-[5.75rem] flex-none snap-start flex-col items-center gap-2 text-center sm:w-32 lg:w-36"
                >
                  {/* Two rims, each the shape itself: gold outside, a hair of
                      paper, green inside, then the photo — and a light sheen
                      across the top corner, like a cut stone. A collection
                      still to come has both rims faded. */}
                  <span className="relative block aspect-square w-full transition duration-300 group-hover:-translate-y-1">
                    <span className={`absolute inset-0 ${comingSoon ? "bg-brand-green-line" : "bg-brand-gold"}`} style={{ clipPath: DECAGON }} />
                    <span className="absolute inset-[3px] bg-brand-paper" style={{ clipPath: DECAGON }} />
                    <span className={`absolute inset-[5px] transition ${comingSoon ? "bg-brand-green-line" : "bg-brand-green group-hover:bg-brand-gold"}`} style={{ clipPath: DECAGON }} />
                    <span className="absolute inset-[8px] overflow-hidden bg-brand-paper" style={{ clipPath: DECAGON }}>
                      {/* The collection photos carry their name on a band
                          along the bottom; drawn larger from the top, the
                          band falls outside the stone and the name is said
                          once, underneath. */}
                      <Image
                        src={item.image}
                        alt={item.title}
                        fill
                        sizes="(min-width: 1024px) 144px, (min-width: 640px) 128px, 92px"
                        className={`origin-[50%_8%] scale-[1.38] object-cover transition duration-500 group-hover:scale-[1.48] ${comingSoon ? "opacity-75 saturate-[.35]" : ""}`}
                      />
                      <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0)_38%,rgba(255,255,255,0)_62%,rgba(255,255,255,0.16)_100%)]" />
                    </span>
                    {/* How many shoes, on a small stone of its own. */}
                    {!comingSoon && count > 0 ? (
                      <span className="absolute right-0 top-0 grid h-6 min-w-6 place-items-center rounded-full bg-brand-green-ink px-1.5 text-[11px] font-extrabold text-white shadow-md sm:right-1 sm:top-1">
                        {count}
                        <span className="sr-only">
                          {" "}
                          <T en={`style${count === 1 ? "" : "s"}`} ne="किसिम" />
                        </span>
                      </span>
                    ) : null}
                  </span>
                  <span className="text-[13px] font-semibold leading-tight text-brand-green-ink sm:text-sm">{item.title}</span>
                  {comingSoon ? (
                    <span className="-mt-1 whitespace-nowrap rounded-full border border-brand-gold/50 bg-brand-cream-soft px-1.5 py-0.5 text-[10px] font-bold leading-tight text-brand-gold-ink sm:px-2 sm:text-[11px]">
                      <T en="Coming soon" ne="छिट्टै आउँदैछ" />
                    </span>
                  ) : null}
                </Link>
              );
            })}
        </SlideRail>
      </div>
    </section>
  );
}
