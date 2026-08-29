import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import T from "@/components/T";
import { businessContact, createPageMetadata, siteConfig } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Terms of Service | KRISHOE",
  description:
    "KRISHOE बाट किन्दा लागू हुने सर्तहरू: मूल्य, अर्डर पक्का हुने तरिका, डेलिभरी, साट्ने नियम। The terms KRISHOE trades on: price, confirmation, delivery and exchange.",
  path: "/terms",
});

/**
 * The terms this shop actually trades on.
 *
 * Kept to what is true here rather than the usual imported boilerplate. Two
 * points are worth stating because they are how the shop really works and a
 * customer can otherwise be surprised: an order is a request until someone
 * telephones to confirm it, and stock is counted by hand in a real workshop, so
 * a pair can occasionally sell out between the click and the call.
 *
 * In both languages, because this is the page a cautious buyer opens before
 * parting with money — and a page of terms a reader cannot read is worth less
 * than no page at all. The English is a translation of what the Nepali already
 * promises, not a second and different set of terms.
 */
export default function TermsPage() {
  return (
    <main className="bg-brand-paper">
      <Navbar />
      <div className="mx-auto max-w-3xl px-5 py-16 md:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
          KRISHOE
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-brand-green-ink md:text-5xl">
          <T en="Terms of Service" ne="सर्तहरू" />
        </h1>
        <p className="mt-4 leading-7 text-brand-muted">
          <T en="Terms of Service" ne="सर्तहरू" /> · {siteConfig.legalName} ·{" "}
          <T en="Last updated: Bhadau 2083" ne="अन्तिम अद्यावधिक: भदौ २०८३" />
        </p>

        <div className="mt-10 grid gap-8">
          <section>
            <h2 className="text-xl font-black text-brand-green-ink">
              <T en="1. When an order becomes firm" ne="१. अर्डर कहिले पक्का हुन्छ" />
            </h2>
            <p className="mt-3 leading-7 text-brand-muted">
              <T
                en="An order placed on this website starts as a request. It becomes firm only once we have telephoned to confirm the size, the colour and the address — so please give a mobile number we can reach you on."
                ne="वेबसाइटबाट गरिएको अर्डर सुरुमा अनुरोध हो। हामीले फोन गरेर साइज, रङ र ठेगाना पक्का गरेपछि मात्र अर्डर पक्का हुन्छ। त्यसैले सही मोबाइल नम्बर दिनुहोस्।"
              />
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-brand-green-ink">
              <T en="2. Price and stock" ne="२. मूल्य र स्टक" />
            </h2>
            <p className="mt-3 leading-7 text-brand-muted">
              <T
                en="Prices shown are in Nepali rupees. Stock is counted by hand in our own factory, so on rare occasions a size sells out between your order and our call. If that happens we tell you at once, and either offer another option or return your money."
                ne="वेबसाइटमा देखिएको मूल्य नेपाली रुपैयाँमा हो। स्टक हाम्रै कारखानामा हातले गनिन्छ — विरलै, तपाईंले अर्डर गर्ने र हामीले फोन गर्ने बीचमा कुनै साइज सकिन सक्छ। त्यस्तो भए हामी तुरुन्तै भन्छौँ र अर्को विकल्प दिन्छौँ वा पैसा फिर्ता गर्छौं।"
              />
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-brand-green-ink">
              <T en="3. Payment" ne="३. भुक्तानी" />
            </h2>
            <p className="mt-3 leading-7 text-brand-muted">
              <T
                en="Cash on delivery and bank transfer both work. Nothing has to be sent in advance."
                ne="सामान पाएपछि पैसा (COD) र बैंक जम्मा — दुवै चल्छ। अग्रिम पैसा पठाउनै पर्दैन।"
              />
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-brand-green-ink">
              <T en="4. Delivery" ne="४. डेलिभरी" />
            </h2>
            <p className="mt-3 leading-7 text-brand-muted">
              <T
                en="We deliver anywhere in Nepal — usually 1–2 days within Narayangadh and Bharatpur, and 3–5 days elsewhere. Floods, strikes or a courier's own delay can hold a parcel up, and those are outside our hands."
                ne="नेपालभरि पठाउँछौँ। नारायणगढ–भरतपुर भित्र सामान्यतया १–२ दिन, अन्यत्र ३–५ दिन। बाढी, बन्द वा कुरियरको ढिलाइ जस्ता हाम्रो नियन्त्रण बाहिरका कारणले ढिलो हुन सक्छ।"
              />
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-brand-green-ink">
              <T en="5. Exchange and return" ne="५. साट्ने र फिर्ता" />
            </h2>
            <p className="mt-3 leading-7 text-brand-muted">
              <T
                en="You may exchange within 7 days of delivery, unworn and with the packing intact. The full detail is in the"
                ne="सामान पाएको ७ दिनभित्र, नलगाएको र प्याकिङ नबिगारेको अवस्थामा साट्न मिल्छ। पूरा विवरण"
              />{" "}
              <Link href="/return-policy" className="font-bold text-brand-green hover:underline">
                <T en="return policy" ne="साट्ने नियम" />
              </Link>
              <T en="." ne=" मा छ।" />
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-brand-green-ink">
              <T en="6. Photographs and the name" ne="६. फोटो र नाम" />
            </h2>
            <p className="mt-3 leading-7 text-brand-muted">
              <T
                en="The photographs, designs and the KRISHOE name on this website are ours. They may not be copied for sale."
                ne="वेबसाइटका फोटो, डिजाइन र KRISHOE नाम हाम्रो हो। बिक्रीका लागि नक्कल गर्न पाइँदैन।"
              />
            </p>
          </section>

          <section className="rounded-2xl border border-brand-green/20 bg-brand-green-wash p-6">
            <h2 className="text-xl font-black text-brand-green-ink">
              <T en="Contact" ne="सम्पर्क" />
            </h2>
            <p className="mt-3 leading-7 text-brand-muted">
              {siteConfig.legalName} — {businessContact.streetAddress},{" "}
              {businessContact.addressLocality}, {businessContact.addressRegion}
            </p>
            <p className="mt-2 leading-7">
              <a href={`tel:${businessContact.phoneTel}`} className="font-bold text-brand-green">
                {businessContact.phoneDisplay}
              </a>
              {" · "}
              <a href={`mailto:${businessContact.email}`} className="font-bold text-brand-green">
                {businessContact.email}
              </a>
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
}
