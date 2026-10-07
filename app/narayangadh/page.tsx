import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import T from "@/components/T";
import ProductCard from "@/components/ProductCard";
import { getProducts } from "@/lib/product-store";
import { businessContact, createPageMetadata } from "@/lib/seo";
import { reportError } from "@/lib/report-error";
import type { Product } from "@/lib/products";
import { narayangadhCopy } from "@/lib/local-pages";

/**
 * The shop for someone nearby (owner, 2026-10-07): "shoe shop Narayangadh",
 * "चप्पल नारायणगढ", "थोक चप्पल चितवन" are what people around Chitwan type,
 * and no page answered them by name. This one says where the factory and shop
 * are, how to reach them, what a shop buying wholesale gets, and the shoes on
 * sale — all from what the site already knows, nothing invented.
 */

export const metadata: Metadata = createPageMetadata({
  title: narayangadhCopy.en.title,
  description: narayangadhCopy.en.description,
  path: "/narayangadh",
  pairPath: "/ne/narayangadh",
});

// Built with the site; a database hiccup costs the shoe list, never the page.
async function loadShoes(): Promise<Product[]> {
  try {
    return (await getProducts()).filter((product) => product.status === "Active").slice(0, 8);
  } catch (error) {
    reportError("load shoes for the Narayangadh page", error);
    return [];
  }
}

export default async function NarayangadhPage() {
  const shoes = await loadShoes();
  const address = `${businessContact.streetAddress}, ${businessContact.addressLocality}, ${businessContact.addressRegion}`;
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${businessContact.latitude},${businessContact.longitude}`;
  const whatsappUrl = `https://wa.me/${businessContact.whatsappNumber}`;

  return (
    <main className="bg-brand-paper">
      <Navbar />

      <section className="bg-brand-green-ink py-8 text-white md:py-14">
        <div className="mx-auto max-w-5xl px-5 md:px-8">
          <p className="text-sm font-bold uppercase tracking-[0.28em] text-brand-gold-bright">
            <T en="Narayangadh · Chitwan" ne="नारायणगढ · चितवन" />
          </p>
          <h1 className="mt-4 max-w-3xl text-3xl font-black leading-tight text-white md:text-5xl">
            <T en="Shoes and chappal, made here in Narayangadh" ne="नारायणगढमै बनेका जुत्ता र चप्पल" />
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-white/80">
            <T
              en="KRISHOE is a factory and a shop in Kamalnagar, Narayangadh. Come and try a pair, order on WhatsApp, or buy wholesale for your own shop."
              ne="KRISHOE कमलनगर, नारायणगढमा रहेको कारखाना र पसल हो। आएर लगाएर हेर्नुहोस्, WhatsApp मा अर्डर गर्नुहोस्, वा आफ्नो पसलका लागि थोकमा लिनुहोस्।"
            />
          </p>
        </div>
      </section>

      <section className="py-8 md:py-12">
        <div className="mx-auto grid max-w-5xl gap-4 px-5 sm:grid-cols-2 md:grid-cols-3 md:px-8">
          <div className="rounded-2xl border border-brand-green-line bg-brand-paper p-5">
            <h2 className="text-lg font-black text-brand-green-ink">
              📍 <T en="Where we are" ne="हामी कहाँ छौँ" />
            </h2>
            <p className="mt-2 text-sm leading-6 text-brand-muted">{address}</p>
            <a href={mapUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center font-bold text-brand-green underline underline-offset-4">
              <T en="Open in Google Maps →" ne="Google Maps मा हेर्ने →" />
            </a>
          </div>
          <div className="rounded-2xl border border-brand-green-line bg-brand-paper p-5">
            <h2 className="text-lg font-black text-brand-green-ink">
              📞 <T en="Call or WhatsApp" ne="फोन वा WhatsApp" />
            </h2>
            <p className="mt-2 text-sm leading-6 text-brand-muted">
              <T en="Call" ne="फोन" /> {businessContact.phoneDisplay}
              <br />
              WhatsApp / Viber {businessContact.whatsappDisplay}
            </p>
            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center font-bold text-brand-green underline underline-offset-4">
              <T en="Message us on WhatsApp →" ne="WhatsApp मा लेख्ने →" />
            </a>
          </div>
          <div className="rounded-2xl border border-brand-green-line bg-brand-paper p-5">
            <h2 className="text-lg font-black text-brand-green-ink">
              🏪 <T en="For shops: wholesale" ne="पसलका लागि: थोक" />
            </h2>
            <p className="mt-2 text-sm leading-6 text-brand-muted">
              <T
                en="Straight from the factory, a minimum per design, the rate on the phone."
                ne="सिधै कारखानाबाट, हरेक डिजाइनको न्यूनतम संख्या, दर फोनमा।"
              />
            </p>
            <Link href="/wholesale" className="mt-3 inline-flex min-h-11 items-center font-bold text-brand-green underline underline-offset-4">
              <T en="Wholesale details →" ne="थोकको विवरण →" />
            </Link>
          </div>
        </div>
      </section>

      {shoes.length > 0 ? (
        <section className="pb-12">
          <div className="mx-auto max-w-5xl px-5 md:px-8">
            <h2 className="text-2xl font-black text-brand-green-ink">
              <T en="On sale now" ne="अहिले बिक्रीमा" />
            </h2>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
              {shoes.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <Footer />
    </main>
  );
}
