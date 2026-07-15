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
        <Link
          href="/shop"
          aria-label="Shop KRISHOE premium footwear — Your Step, Your Identity"
          className="mx-auto block max-w-7xl overflow-hidden rounded-2xl shadow-[0_20px_60px_rgba(11,77,59,0.12)] transition hover:shadow-[0_28px_80px_rgba(11,77,59,0.18)]"
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
