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

      {/* The hero graphic is a complete branded banner (headline, CTAs, trust
          badges are part of the image). We render it as one responsive,
          tappable image — no overlaid text — so it never doubles up, stays
          sharp on every screen, and the whole banner links into the shop. A
          visually-hidden heading keeps the real text for SEO and screen
          readers. */}
      <section className="bg-brand-paper px-4 pt-4 md:px-8 md:pt-6">
        <div className="relative mx-auto min-h-[78svh] max-w-md overflow-hidden rounded-[1.75rem] bg-brand-cream-hero shadow-[0_22px_70px_rgba(59,42,24,0.18)] md:hidden">
          {/* Two heroes, one shown: this portrait banner on a phone, the
              landscape one below on a desktop. Both used to be preloaded, and a
              preload link carries no idea of the CSS that hides one — so every
              shopper on a phone in Nepal downloaded the desktop banner as well,
              at full viewport width, racing the banner they were actually
              waiting to see. Next's own guidance for a pair like this is to
              leave the loading lazy, which fetches only the one that is
              displayed, and to say which matters with fetchPriority instead. */}
          <Image
            src="/images/mobile-hero-krishoe-gold-v2.png"
            alt="Premium champagne-gold KRISHOE sandals with artisan-inspired detailing"
            fill
            fetchPriority="high"
            sizes="(max-width: 767px) 100vw, 1px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,252,246,0.96)_0%,rgba(255,252,246,0.78)_25%,rgba(255,252,246,0)_48%)]" />
          <div className="absolute inset-x-0 top-0 p-6 pt-7 text-brand-green-ink">
            <div className="flex items-center gap-2.5">
              <Image
                src="/images/logo-mark.png"
                alt=""
                width={96}
                height={96}
                className="h-12 w-12 rounded-full shadow-md"
              />
              <div>
                <p className="font-display text-2xl font-black leading-none tracking-[0.08em] text-brand-green">
                  KRISHOE
                </p>
                <p className="mt-1 text-[8px] font-black uppercase tracking-[0.22em] text-brand-gold-label">
                  Walk with Authority
                </p>
              </div>
            </div>
            <p className="mt-4 inline-flex rounded-full border border-brand-gold/35 bg-white/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-brand-gold-label shadow-sm backdrop-blur">
              <T en="The Signature Collection" ne="हस्ताक्षर संग्रह" />
            </p>
            <h1 className="mt-3 max-w-[310px] font-display text-[2.4rem] font-bold leading-[0.92] tracking-[-0.03em]">
              <T en="Your Step." ne="तपाईंको पाइला।" />
              <span className="mt-1 block text-brand-clay-deep">
                <T en="Your Identity." ne="तपाईंको पहिचान।" />
              </span>
            </h1>
            <p className="mt-3 max-w-[285px] text-sm font-semibold leading-6 text-brand-green-ink/75">
              <T
                en="Premium comfort, artisan detail and confident style—crafted for Nepal."
                ne="नेपालमै बनेको — दिनभर लगाउँदा खुट्टा दुख्दैन, र हेर्दा राम्रो देखिन्छ।"
              />
            </p>
            <div className="mt-4 flex flex-col gap-3 md:flex-row md:gap-2.5">
              <Link
                href="/shop"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand-green px-5 py-2.5 text-sm font-black text-white shadow-lg transition hover:shadow-xl md:min-h-11 md:py-0"
              >
                <T en="Shop now" ne="पसल हेर्ने" />
              </Link>
              <Link
                href="/shop/ladies-sandals"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-brand-gold/50 bg-white/75 px-4 py-2.5 text-sm font-black text-brand-green shadow-sm backdrop-blur transition hover:bg-white/85 md:min-h-11 md:py-0"
              >
                <T en="Explore" ne="सबै जुत्ता" />
              </Link>
            </div>
          </div>
        </div>
        <Link
          href="/shop"
          aria-label="Shop KRISHOE premium footwear — Your Step, Your Identity"
          className="relative mx-auto hidden min-h-[clamp(560px,65vw,760px)] max-w-7xl overflow-hidden rounded-[2rem] bg-brand-cream-hero shadow-[0_24px_80px_rgba(11,77,59,0.14)] transition hover:shadow-[0_30px_90px_rgba(11,77,59,0.2)] md:block"
        >
          <Image
            src="/images/hero-krishoe-gold-v2.png"
            alt="KRISHOE — Your Step. Your Identity. Premium footwear crafted for Nepal."
            width={1536}
            height={1024}
            fetchPriority="high"
            sizes="(min-width: 768px) 100vw, 1px"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,252,246,0.97)_0%,rgba(255,252,246,0.84)_35%,rgba(255,252,246,0.08)_62%)]" />
          <div className="absolute inset-y-0 left-0 flex w-[48%] flex-col justify-center px-[clamp(3rem,6vw,6rem)] pb-24">
            <div className="flex items-center gap-4">
              <Image
                src="/images/logo-mark.png"
                alt=""
                width={128}
                height={128}
                className="h-16 w-16 rounded-full shadow-lg"
              />
              <div>
                <p className="font-display text-4xl font-black leading-none tracking-[0.08em] text-brand-green">
                  KRISHOE
                </p>
                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.28em] text-brand-gold-label">
                  Walk with Authority
                </p>
              </div>
            </div>
            <p className="mt-7 text-xs font-black uppercase tracking-[0.28em] text-brand-gold-label">
              <T en="The Signature Collection" ne="हस्ताक्षर संग्रह" />
            </p>
            <h1 className="mt-5 font-display text-[clamp(3.75rem,5.5vw,6rem)] font-bold leading-[0.86] tracking-[-0.045em] text-brand-green-ink">
              <T en="Your Step." ne="तपाईंको पाइला।" />
              <span className="mt-3 block text-brand-clay-deep">
                <T en="Your Identity." ne="तपाईंको पहिचान।" />
              </span>
            </h1>
            <p className="mt-7 max-w-xl text-[clamp(1rem,1.35vw,1.2rem)] font-medium leading-8 text-brand-green-ink/70">
              <T
                en="Premium comfort, artisan detail and confident style—crafted for Nepal."
                ne="नेपालमै बनेको — दिनभर लगाउँदा खुट्टा दुख्दैन, र हेर्दा राम्रो देखिन्छ।"
              />
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <span className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-brand-green px-8 py-3.5 text-sm font-black uppercase tracking-[0.12em] text-white shadow-[0_12px_30px_rgba(11,77,59,0.24)]">
                <T en="Shop now" ne="पसल हेर्ने" />
              </span>
              <span className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-brand-gold-deep bg-white/65 px-8 py-3.5 text-sm font-black uppercase tracking-[0.1em] text-brand-green-ink backdrop-blur">
                <T en="Explore collection" ne="सबै जुत्ता हेर्ने" />
              </span>
            </div>
          </div>
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-[72px] border-t-2 border-brand-gold-bright bg-brand-clay-ink/95 shadow-[0_-14px_36px_rgba(101,27,36,0.16)] backdrop-blur"
          />
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
