import Image from "next/image";
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

export default function Home() {
  return (
    <main className="bg-white">

      <Navbar />

      {/* The hero graphic is a complete branded banner (headline, CTAs, trust
          badges are part of the image). We render it as one responsive,
          tappable image — no overlaid text — so it never doubles up, stays
          sharp on every screen, and the whole banner links into the shop. A
          visually-hidden heading keeps the real text for SEO and screen
          readers. */}
      <section className="bg-white px-4 pt-4 md:px-8 md:pt-6">
        <div className="relative mx-auto min-h-[78svh] max-w-md overflow-hidden rounded-[1.75rem] bg-[#F9C8B3] shadow-[0_22px_70px_rgba(96,43,55,0.2)] md:hidden">
          <Image
            src="/images/mobile-hero-colorful-v1.webp"
            alt="A colorful premium collection of cute KRISHOE rexine slippers"
            fill
            preload
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,247,238,0.92)_0%,rgba(255,247,238,0.66)_23%,rgba(255,247,238,0)_48%)]" />
          <div className="absolute inset-x-0 top-0 p-6 pt-7 text-brand-green-ink">
            <p className="inline-flex rounded-full border border-white/70 bg-white/65 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#8A3B62] shadow-sm backdrop-blur">
              Colour your every step
            </p>
            <h1 className="mt-4 max-w-[310px] font-display text-[2.65rem] font-bold leading-[0.92] tracking-[-0.03em]">
              Cute comfort.
              <span className="mt-1 block text-[#A83E70]">Confident colour.</span>
            </h1>
            <p className="mt-3 max-w-[285px] text-sm font-semibold leading-6 text-brand-green-ink/75">
              Premium rexine styles, shaped for Nepal and made to brighten every move.
            </p>
            <div className="mt-4 flex gap-2.5">
              <Link
                href="/shop"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand-green px-5 text-sm font-black text-white shadow-lg"
              >
                Shop now
              </Link>
              <Link
                href="/shop/ladies-slippers"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/80 bg-white/70 px-4 text-sm font-black text-[#8A3B62] shadow-sm backdrop-blur"
              >
                New colours
              </Link>
            </div>
          </div>
        </div>
        <Link
          href="/shop"
          aria-label="Shop KRISHOE premium footwear — Your Step, Your Identity"
          className="mx-auto hidden max-w-7xl overflow-hidden rounded-2xl shadow-[0_20px_60px_rgba(11,77,59,0.12)] transition hover:shadow-[0_28px_80px_rgba(11,77,59,0.18)] md:block"
        >
          <h1 className="sr-only">
            Your Step. Your Identity. KRISHOE premium footwear crafted for Nepal with style, comfort and quality.
          </h1>
          <Image
            src="/images/hero-banner.png"
            alt="KRISHOE — Your Step. Your Identity. Premium footwear crafted for Nepal."
            width={1536}
            height={1024}
            priority
            sizes="100vw"
            className="h-auto w-full"
          />
        </Link>
      </section>

      <FeaturedProducts />

      <BestSeller />

      <Categories />

      <NewArrivals />
      <About />

      <WhyChoose />

      <Testimonials />

      <Footer />

    </main>
  );
}
