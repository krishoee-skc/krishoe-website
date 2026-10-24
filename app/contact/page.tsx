import type { Metadata } from "next";
import T from "@/components/T";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ContactForm from "@/components/ContactForm";
import ShopOpenNow from "@/components/ShopOpenNow";
import { businessContact, businessMapsUrl } from "@/lib/seo";
import { shopHours } from "@/lib/shop-hours";

export const metadata: Metadata = {
  title: "Contact KRISHOE | Premium Footwear Nepal",
  description: "Contact KRISHOE for footwear inquiries, delivery coordination, and product availability.",
};

export default function ContactPage() {
  return (
    <main className="bg-brand-mist">
      <Navbar />
      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-8 md:py-16 md:grid-cols-[0.9fr_1.1fr] md:px-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
            <T en="Contact" ne="सम्पर्क" />
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-brand-green-ink md:text-6xl">
            <T en="Call, WhatsApp or visit us" ne="फोन, WhatsApp वा पसलमै आउनुहोस्" />
          </h1>

          {/* The three ways in, first (owner, 2026-10-24): the page named only
              the phone, and the WhatsApp the orders come by was in the footer. */}
          <div className="mt-5 grid gap-3">
            <ShopOpenNow />
            <a
              href={`tel:${businessContact.phoneTel}`}
              className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-green px-5 text-base font-black text-white transition hover:bg-brand-green-ink"
            >
              📞 <T en={`Call ${businessContact.phoneDisplay}`} ne={`फोन ${businessContact.phoneDisplay}`} />
            </a>
            <a
              href={`https://wa.me/${businessContact.whatsappNumber}`}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-brand-green bg-brand-paper px-5 text-base font-black text-brand-green transition hover:bg-brand-green-mist"
            >
              💬 WhatsApp {businessContact.whatsappDisplay}
            </a>
            <a
              href={businessMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-black/10 bg-brand-paper px-5 text-center text-base font-black text-brand-green-ink transition hover:border-brand-green"
            >
              📍 <T en={`Directions · ${businessContact.streetAddress}`} ne={`बाटो हेर्ने · ${businessContact.streetAddress}`} />
            </a>
          </div>

          <p className="mt-5 text-base leading-8 text-brand-muted">
            <T
              en="Ask about sizing, stock, delivery or bulk orders."
              ne="साइज, स्टक, डेलिभरी वा थोक अर्डरबारे सोध्नुहोस्।"
            />
          </p>

          <div className="mt-8 grid gap-4">
            {[
              [
                "Location",
                `${businessContact.streetAddress}, ${businessContact.addressLocality}, ${businessContact.addressRegion}`,
              ],
              ["Phone", businessContact.phoneDisplay],
              ["Email", businessContact.email],
              ["Hours", shopHours.en],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-black/10 bg-brand-paper p-5">
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
