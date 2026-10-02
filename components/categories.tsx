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


/** Five sides, point up, the base wider than the shoulders. */
const PENTAGON = "polygon(50% 0%, 100% 38%, 81% 100%, 19% 100%, 0% 38%)";

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
 */
export default function Categories({ shoeCounts }: { shoeCounts?: Record<string, number> } = {}) {
  return (
    <section className="bg-brand-mist py-8 md:py-20">
      <div className="mx-auto max-w-7xl px-6">
        <h2 className="text-center font-display text-2xl font-black tracking-tight text-brand-green-ink md:text-4xl mb-6 md:mb-8">
          <T en="Shop by style" ne="किसिम अनुसार" />
        </h2>

        <SlideRail className="gap-3 px-0.5 pb-2 pt-1 sm:gap-5 lg:[&>*:first-child]:ml-auto lg:[&>*:last-child]:mr-auto">
          {[...categories]
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
                  {/* The rim is the shape itself in green, the photo the same
                      shape set 3px inside it; gold on hover. */}
                  <span
                    className={`relative block aspect-[1.05/1] w-full p-[3px] transition duration-300 group-hover:-translate-y-1 ${
                      comingSoon ? "bg-brand-green-line" : "bg-brand-green group-hover:bg-brand-gold"
                    }`}
                    style={{ clipPath: PENTAGON }}
                  >
                    <span className="relative block h-full w-full overflow-hidden bg-brand-paper" style={{ clipPath: PENTAGON }}>
                      <Image
                        src={item.image}
                        alt={item.title}
                        fill
                        sizes="(min-width: 1024px) 144px, (min-width: 640px) 128px, 92px"
                        className={`object-cover transition duration-500 group-hover:scale-110 ${comingSoon ? "opacity-75 saturate-[.35]" : ""}`}
                      />
                    </span>
                  </span>
                  <span className="text-[13px] font-semibold leading-tight text-brand-green-ink sm:text-sm">{item.title}</span>
                  {comingSoon ? (
                    <span className="-mt-1 rounded-full border border-brand-gold/50 bg-brand-cream-soft px-2 py-0.5 text-[11px] font-bold leading-tight text-brand-gold-ink">
                      <T en="Coming soon" ne="छिट्टै आउँदैछ" />
                    </span>
                  ) : count > 0 ? (
                    <span className="-mt-1 text-xs font-bold text-brand-green">
                      <T en={`${count} style${count === 1 ? "" : "s"}`} ne={`${count} किसिम`} />
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
