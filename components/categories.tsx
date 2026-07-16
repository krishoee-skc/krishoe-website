import Image from "next/image";
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
    <section className="bg-[#f8f8f8] py-20">
      <div className="mx-auto max-w-7xl px-6">
        <h2 className="text-center text-4xl font-bold text-brand-green">
          Shop by Category
        </h2>

        <p className="mb-12 mt-3 text-center text-gray-500">
          Find your perfect footwear.
        </p>

        <div className="grid grid-cols-2 gap-8 md:grid-cols-3">
          {categories.map((item) => (
            <Link
              key={item.slug}
              href={`/shop/${item.slug}`}
              className="group relative overflow-hidden rounded-lg"
            >
              <Image
                src={item.image}
                alt={item.title}
                width={500}
                height={500}
                className="h-72 w-full object-cover transition duration-500 group-hover:scale-110"
              />

              <div className="absolute inset-0 flex items-end bg-black/30">
                <h3 className="p-6 text-2xl font-bold text-white">{item.title}</h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
