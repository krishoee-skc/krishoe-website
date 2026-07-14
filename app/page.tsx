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

      <section className="relative flex min-h-[82vh] items-center">

        <Image
          src="/images/hero-banner.png"
          alt="KRISHOE Hero Banner"
          fill
          priority
          className="object-cover"
        />

        <div className="absolute inset-0 bg-black/50"></div>

        <div className="relative z-10 max-w-7xl mx-auto w-full px-6 md:px-12 text-white">

          <h1 className="font-display text-5xl md:text-7xl font-bold leading-tight tracking-tight">
            Your Step.
            <br />
            Your Identity.
          </h1>

          <p className="mt-6 max-w-2xl text-lg md:text-2xl text-gray-200">
            Premium Footwear Crafted for Nepal with Style, Comfort and Quality.
          </p>

          <div className="mt-10 flex gap-5 flex-wrap">

            <Link href="/shop" className="rounded-full bg-[#C8A04D] px-8 py-4 font-semibold text-[#10231D] transition hover:bg-white">
              Shop Now
            </Link>

            <Link href="/shop?category=new-arrivals" className="rounded-full border-2 border-white px-8 py-4 font-semibold transition hover:bg-white hover:text-black">
              Explore Collection
            </Link>

          </div>

        </div>

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
