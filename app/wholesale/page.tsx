import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WholesaleForm from "./WholesaleForm";
import { getProducts } from "@/lib/product-store";
import { absoluteUrl, siteConfig } from "@/lib/seo";

export const metadata: Metadata = {
  title: "थोक बिक्री — Wholesale | KRISHOE",
  description:
    "KRISHOE sells wholesale to shops across Nepal, direct from our own factory in Narayangadh. Trade rates on enquiry, minimum order per design.",
  alternates: { canonical: absoluteUrl("/wholesale") },
  openGraph: {
    title: "थोक बिक्री — KRISHOE",
    description: "हाम्रै कारखानाबाट थोकमा — पसलहरूका लागि।",
    url: absoluteUrl("/wholesale"),
    siteName: siteConfig.name,
  },
};

export const dynamic = "force-dynamic";

/**
 * The page a shopkeeper needs and could not find.
 *
 * Every product already carries a trade rate and a minimum order quantity, and
 * the POS already sells on a Wholesale channel — all built, none of it
 * reachable from the website. For a factory this is the larger money: a retail
 * customer buys one pair, a shop buys fifty.
 *
 * Rates are not printed here. That decision is already made on the product
 * page, and it is the right one — publishing trade rates tells every retail
 * customer what the shop paid. The minimum order is not a secret, so that is
 * shown; the rate comes on the phone, which is where a wholesale deal in Nepal
 * gets settled anyway.
 */
export default async function WholesalePage() {
  const products = await getProducts();
  const tradeable = products
    .filter((product) => product.wholesalePriceValue > 0)
    .sort((left, right) => left.name.localeCompare(right.name));

  return (
    <main className="bg-white">
      <Navbar />

      <section className="bg-brand-green-ink py-16 text-white">
        <div className="mx-auto max-w-5xl px-5 md:px-8">
          <p className="text-sm font-bold uppercase tracking-[0.28em] text-brand-gold-bright">
            थोक बिक्री · Wholesale
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-white md:text-5xl">
            पसल चलाउनुहुन्छ? सिधै कारखानाबाट लिनुहोस्।
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-white/80">
            KRISHOE आफ्नै कारखाना हो — नारायणगढ, चितवन। बीचमा कोही नभएकाले
            थोकको दर इमानदार हुन्छ, र माल आफ्नै हातले जाँचेर पठाइन्छ।
          </p>
        </div>
      </section>

      <section className="py-14">
        <div className="mx-auto grid max-w-5xl gap-8 px-5 md:grid-cols-3 md:px-8">
          {[
            ["आफ्नै कारखाना", "बीचको कमिसन छैन — दर सिधै कारखानाको।"],
            ["नियमित सप्लाई", "महिनैपिच्छे उही design, उही गुणस्तर।"],
            ["साट्ने सुविधा", "मिलेन भने साट्न मिल्छ — पसलको जोखिम कम।"],
          ].map(([title, detail]) => (
            <article key={title} className="rounded-2xl border border-black/10 bg-brand-mist p-6">
              <h2 className="text-xl font-black text-brand-green-ink">{title}</h2>
              <p className="mt-2 text-sm leading-7 text-brand-muted">{detail}</p>
            </article>
          ))}
        </div>
      </section>

      {tradeable.length > 0 ? (
        <section className="bg-brand-mist py-14">
          <div className="mx-auto max-w-5xl px-5 md:px-8">
            <h2 className="text-2xl font-black text-brand-green-ink">
              थोकमा पाइने design र न्यूनतम अर्डर
            </h2>
            <p className="mt-2 text-sm leading-7 text-brand-muted">
              दर फोनमा भनिन्छ — तपाईंको परिमाण र नियमितता अनुसार फरक पर्छ।
            </p>

            <div className="mt-6 overflow-x-auto rounded-2xl border border-black/10 bg-white">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-black/10">
                    <th className="px-5 py-3 font-black text-brand-green-ink">Design</th>
                    <th className="px-5 py-3 font-black text-brand-green-ink">न्यूनतम अर्डर</th>
                    <th className="px-5 py-3 font-black text-brand-green-ink">साइज</th>
                  </tr>
                </thead>
                <tbody>
                  {tradeable.map((product) => (
                    <tr key={product.id} className="border-b border-black/[0.06] last:border-0">
                      <td className="px-5 py-3 font-bold text-brand-green-ink">{product.name}</td>
                      <td className="px-5 py-3 tabular-nums text-brand-muted">
                        {product.minWholesaleQty} जोडी
                      </td>
                      <td className="px-5 py-3 text-brand-muted">
                        {product.sizes[0]}–{product.sizes[product.sizes.length - 1]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      <section className="py-14">
        <div className="mx-auto max-w-3xl px-5 md:px-8">
          <h2 className="text-2xl font-black text-brand-green-ink">दर सोध्नुहोस्</h2>
          <p className="mt-2 text-sm leading-7 text-brand-muted">
            तल भर्नुहोस् — हामी फोन गरेर दर, साइज र पठाउने कुरा मिलाउँछौँ।
          </p>
          <div className="mt-6">
            <WholesaleForm />
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
