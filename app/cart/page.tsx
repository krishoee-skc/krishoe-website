import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CartClient from "@/components/CartClient";

export const metadata: Metadata = {
  title: "Cart | KRISHOE",
  description: "Review selected KRISHOE footwear before checkout.",
};

export default function CartPage() {
  return (
    <main className="bg-brand-mist">
      <Navbar />
      <section className="mx-auto max-w-7xl px-5 py-16 md:px-8">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">KRISHOE cart</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-brand-green-ink md:text-6xl">
            Your selected pairs.
          </h1>
        </div>
        <CartClient />
      </section>
      <Footer />
    </main>
  );
}
