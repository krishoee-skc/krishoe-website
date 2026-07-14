import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WishlistClient from "@/components/WishlistClient";

export const metadata: Metadata = {
  title: "Wishlist | KRISHOE",
  description: "Saved KRISHOE footwear styles.",
};

export default function WishlistPage() {
  return (
    <main className="bg-[#F5F7F4]">
      <Navbar />
      <section className="mx-auto max-w-7xl px-5 py-16 md:px-8">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#B98A2E]">
            Saved collection
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-[#10231D] md:text-6xl">
            Wishlist
          </h1>
        </div>
        <WishlistClient />
      </section>
      <Footer />
    </main>
  );
}
