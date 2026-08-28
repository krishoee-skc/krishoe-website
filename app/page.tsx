import Image from "next/image";
import T from "@/components/T";
import Link from "next/link";
import NewArrivals from "@/components/NewArrivals";
import Navbar from "@/components/Navbar";
import FeaturedProducts from "@/components/FeaturedProducts";
import BestSeller from "@/components/BestSeller";
import Categories from "@/components/categories";
import About from "@/components/About";
import WhyChoose from "@/components/WhyChoose";
import Testimonials from "@/components/Testimonials";
import Footer from "@/components/Footer";
import { getProducts } from "@/lib/product-store";
import { reportError } from "@/lib/report-error";
import type { Product } from "@/lib/products";

async function loadHomeProducts(): Promise<Product[]> {
  try {
    return await getProducts();
  } catch (error) {
    reportError("load product sections for the homepage", error);
    return [];
  }
}

export default async function Home() {
  const products = await loadHomeProducts();

  return (
    <main className="bg-brand-paper">

      <Navbar />

      {/* This week's offer, in the storefront's new purple. One tappable line
          under the nav — free-delivery threshold and the WhatsApp order path,
          the two things a first-time shopper most wants to know. */}
      <Link
        href="/shop"
        className="mx-4 mt-3 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-purple to-brand-purple-deep px-4 py-2.5 text-center text-xs font-bold leading-5 text-white shadow-md md:mx-8"
      >
        <T
          en="This week — free delivery over NPR 2000 · order on WhatsApp too"
          ne="यो हप्ता — NPR 2000 माथि Free delivery · WhatsApp मा पनि अर्डर"
        />
      </Link>

      {/* One complete branded banner — the crest, "Made in Nepal", the tagline
          and the product all live in the image, so it renders as a single
          tappable graphic with no HTML text over it (nothing to double up). The
          same 3:2 banner scales full-width on a phone and on a desktop; a
          visually-hidden heading carries the words for search and screen
          readers. Hosted on the shop's own Blob store, whitelisted in
          next.config.js. */}
      <section className="bg-brand-paper px-4 pt-4 md:px-8 md:pt-6">
        <Link
          href="/shop"
          aria-label="Shop KRISHOE — Made in Nepal premium footwear"
          className="group relative mx-auto block max-w-6xl overflow-hidden rounded-[1.75rem] shadow-[0_22px_70px_rgba(59,42,24,0.18)] ring-1 ring-brand-gold/25 transition hover:shadow-[0_30px_90px_rgba(11,77,59,0.22)] md:rounded-[2rem]"
        >
          <Image
            src="https://scx7x508oyhat5zs.public.blob.vercel-storage.com/products/chatgpt-image-aug-28-2026-11_07_14-pm-RYHCtnMXhx6h6X9XfHX7gWj2kHfWj6.png"
            alt="KRISHOE — Made in Nepal. A premium gold sparkle sandal, crafted in our own factory in Nepal."
            width={1536}
            height={1024}
            priority
            sizes="(min-width: 1152px) 1152px, 100vw"
            className="h-auto w-full"
          />
          <h1 className="sr-only">KRISHOE — Made in Nepal premium footwear. Walk with Authority.</h1>
        </Link>
      </section>

      <FeaturedProducts products={products} />

      <BestSeller products={products} />

      <Categories />

      <NewArrivals products={products} />
      <About />

      <WhyChoose />

      <Testimonials products={products} />

      <Footer />

    </main>
  );
}
