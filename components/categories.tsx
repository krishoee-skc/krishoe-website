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

export default function Categories() {
  return (
    <section className="bg-brand-mist py-16">
      <div className="mx-auto max-w-7xl px-6">
        <h2 className="text-center font-display text-4xl font-bold text-brand-green">
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
          {categories.map((item) => (
            <Link
              key={item.slug}
              href={`/shop/${item.slug}`}
              className="group flex w-24 flex-none snap-start flex-col items-center gap-3 text-center"
            >
              <span className="relative h-24 w-24 overflow-hidden rounded-full shadow-sm ring-2 ring-brand-silver transition duration-300 group-hover:-translate-y-1 group-hover:ring-brand-purple">
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  sizes="96px"
                  className="object-cover transition duration-500 group-hover:scale-110"
                />
              </span>
              <span className="text-sm font-semibold leading-tight text-brand-green-ink">
                {item.title}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
