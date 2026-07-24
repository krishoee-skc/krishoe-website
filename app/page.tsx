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
        <div className="relative mx-auto min-h-[72svh] max-w-md overflow-hidden rounded-[1.75rem] bg-brand-green-ink shadow-[0_22px_70px_rgba(11,77,59,0.2)] md:hidden">
          <Image
            src="/images/about-craftsmanship-v3.webp"
            alt="Premium KRISHOE rexine slippers crafted for everyday comfort"
            fill
            preload
            sizes="100vw"
            className="object-cover object-[52%_55%]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,35,29,0.18)_0%,rgba(16,35,29,0.04)_38%,rgba(16,35,29,0.9)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 p-6 pb-7 text-white">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-gold-bright">
              Made for Nepal
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold leading-[0.98]">
              Your step. Your identity.
            </h1>
            <p className="mt-3 max-w-sm text-sm font-medium leading-6 text-white/85">
              Cute, comfortable rexine styles made for confident everyday movement.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Link
                href="/shop"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand-gold-bright px-5 text-sm font-black text-brand-green-ink"
              >
                Shop now
              </Link>
              <Link
                href="/shop/ladies-slippers"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/50 bg-white/10 px-4 text-sm font-bold text-white backdrop-blur"
              >
                View slippers
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
