import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ContactForm from "@/components/ContactForm";
import { businessContact } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Contact KRISHOE | Premium Footwear Nepal",
  description: "Contact KRISHOE for footwear inquiries, delivery coordination, and product availability.",
};

export default function ContactPage() {
  return (
    <main className="bg-brand-mist">
      <Navbar />
      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-[0.9fr_1.1fr] md:px-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
            Contact
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-brand-green-ink md:text-6xl">
            Premium service, clear answers.
          </h1>
          <p className="mt-5 text-base leading-8 text-brand-muted">
            Ask about sizing, stock, delivery, bulk orders, or a pair you saw in
            the KRISHOE collection. The experience should feel calm before the
            shoe even arrives.
          </p>

          <div className="mt-8 grid gap-4">
            {[
              [
                "Location",
                `${businessContact.streetAddress}, ${businessContact.addressLocality}, ${businessContact.addressRegion}`,
              ],
              ["Phone", businessContact.phoneDisplay],
              ["Email", businessContact.email],
              ["Hours", "10:00 AM - 7:00 PM, Monday-Saturday"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-black/10 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-gold-deep">{label}</p>
                {label === "Email" ? (
                  <a href={`mailto:${value}`} className="mt-2 block break-all text-lg font-black text-brand-green-ink underline-offset-4 hover:underline">
                    {value}
                  </a>
                ) : label === "Phone" ? (
                  <a href={`tel:${businessContact.phoneTel}`} className="mt-2 block text-lg font-black text-brand-green-ink underline-offset-4 hover:underline">
                    {value}
                  </a>
                ) : (
                  <p className="mt-2 text-lg font-black text-brand-green-ink">{value}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <ContactForm />
      </section>
      <Footer />
    </main>
  );
}
