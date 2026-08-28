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

      {/* Free-delivery utility bar — the very top of the shop, like the mockup:
          the two facts a first-time shopper checks before anything else. */}
      <div className="bg-brand-green px-4 py-2 text-center text-[11px] font-semibold tracking-wide text-brand-cream-hero sm:text-xs">
        <T
          en="Free delivery over NPR 2000 · Order on WhatsApp · Made in Nepal"
          ne="NPR 2000 माथि Free delivery · WhatsApp मा अर्डर · नेपालमै बनेको"
        />
      </div>

      <Navbar />

      {/* Search — a wide, tappable bar into the shop, in the purple accent. */}
      <div className="px-4 pt-3 md:px-8">
        <Link
          href="/shop"
          className="mx-auto flex max-w-2xl items-center gap-3 rounded-full border border-brand-green-line bg-brand-mist px-5 py-3 shadow-sm transition hover:border-brand-gold"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#3C1A63" strokeWidth="2" className="h-5 w-5 shrink-0">
            <path strokeLinecap="round" d="m21 21-4.3-4.3m1.3-5.2a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
          </svg>
          <span className="text-sm text-brand-muted">
            <T en="Search shoes…" ne="जुत्ता खोज्नुहोस्…" />
          </span>
        </Link>
      </div>

      {/* This week's offer, in the storefront's purple. */}
      <Link
        href="/shop"
        className="mx-4 mt-3 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-purple to-brand-purple-deep px-4 py-2.5 text-center text-xs font-bold leading-5 text-white shadow-md md:mx-8"
      >
        <T
          en="This week — free delivery over NPR 2000 · order on WhatsApp too"
          ne="यो हप्ता — NPR 2000 माथि Free delivery · WhatsApp मा पनि अर्डर"
        />
      </Link>

      {/* One complete branded banner — crest, Made in Nepal, tagline and the
          product all in the artwork, so nothing is typed over it. */}
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
          <h1 className="sr-only text-brand-green-ink">KRISHOE — Made in Nepal premium footwear. Walk with Authority.</h1>
        </Link>
      </section>

      {/* Trust badges — the four assurances under the hero, like the mockup. */}
      <section className="px-4 pt-5 md:px-8">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-brand-green-line bg-brand-paper p-4 text-center shadow-sm">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#12634A" strokeWidth="1.8" className="h-6 w-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7h13v10H3zM16 10h3l2 3v4h-5M6 19a2 2 0 1 0 4 0M15 19a2 2 0 1 0 4 0" /></svg>
            <span className="text-xs font-bold text-brand-green-ink"><T en="Free Shipping" ne="Free ढुवानी" /></span>
          </div>
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-brand-green-line bg-brand-paper p-4 text-center shadow-sm">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#12634A" strokeWidth="1.8" className="h-6 w-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 1 1 3 6.7M3 12v5m0-5h5" /></svg>
            <span className="text-xs font-bold text-brand-green-ink"><T en="Easy Returns" ne="सजिलो फिर्ता" /></span>
          </div>
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-brand-green-line bg-brand-paper p-4 text-center shadow-sm">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#12634A" strokeWidth="1.8" className="h-6 w-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3 4 6v6c0 5 3.5 7.5 8 9 4.5-1.5 8-4 8-9V6l-8-3Z" /></svg>
            <span className="text-xs font-bold text-brand-green-ink"><T en="Premium Quality" ne="उत्कृष्ट गुण" /></span>
          </div>
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-brand-green-line bg-brand-paper p-4 text-center shadow-sm">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#12634A" strokeWidth="1.8" className="h-6 w-6"><rect x="3" y="6" width="18" height="13" rx="2" /><path strokeLinecap="round" d="M3 10h18" /></svg>
            <span className="text-xs font-bold text-brand-green-ink"><T en="Secure Payment" ne="सुरक्षित भुक्तानी" /></span>
          </div>
        </div>
      </section>

      {/* Mockup order: collections → best-seller tabs → featured/new →
          reviews → why → about → footer. */}
      <Categories />

      <BestSeller products={products} />

      <FeaturedProducts products={products} />

      <NewArrivals products={products} />

      <Testimonials products={products} />

      <WhyChoose />

      <About />

      <Footer />

    </main>
  );
}
