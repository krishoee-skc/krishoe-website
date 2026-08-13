import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CartClient from "@/components/CartClient";
import T from "@/components/T";

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
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
            <T en="KRISHOE cart" ne="KRISHOE कार्ट" />
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-brand-green-ink md:text-6xl">
            <T en="Your selected pairs." ne="तपाईंले छान्नुभएका जोडीहरू।" />
          </h1>
        </div>
        <CartClient />
      </section>
      <Footer />
    </main>
  );
}
