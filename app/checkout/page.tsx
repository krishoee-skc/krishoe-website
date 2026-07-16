import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CheckoutClient from "@/components/CheckoutClient";
import { getCurrentCustomer } from "@/lib/customer-auth";

export const metadata: Metadata = {
  title: "Checkout | KRISHOE",
  description: "Complete a KRISHOE order request with delivery and payment preferences.",
};

export default async function CheckoutPage() {
  const user = await getCurrentCustomer();

  return (
    <main className="bg-brand-mist">
      <Navbar isLoggedIn={Boolean(user)} />
      <section className="mx-auto max-w-7xl px-5 py-16 md:px-8">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
            Premium checkout
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-brand-green-ink md:text-6xl">
            Confirm your order.
          </h1>
        </div>
        <CheckoutClient user={user} />
      </section>
      <Footer />
    </main>
  );
}
