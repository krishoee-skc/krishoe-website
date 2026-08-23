import type { Metadata } from "next";
import T from "@/components/T";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WishlistClient from "@/components/WishlistClient";

export const metadata: Metadata = {
  title: "Wishlist | KRISHOE",
  description: "Saved KRISHOE footwear styles.",
};

export default function WishlistPage() {
  return (
    <main className="bg-brand-mist">
      <Navbar />
      <section className="mx-auto max-w-7xl px-5 py-16 md:px-8">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
            <T en="Saved collection" ne="बचाएका जुत्ता" />
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-brand-green-ink md:text-6xl">
            <T en="Wishlist" ne="मन परेका" />
          </h1>
        </div>
        <WishlistClient />
      </section>
      <Footer />
    </main>
  );
}
