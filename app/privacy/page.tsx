import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { businessContact, createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "गोपनीयता — Privacy Policy",
  description:
    "KRISHOE ले कस्तो जानकारी लिन्छ, किन लिन्छ र कसरी जोगाउँछ। What KRISHOE collects, why, and how it is protected.",
  path: "/privacy",
});

/**
 * What the shop collects and why.
 *
 * Written to describe what this shop actually does, not what a template says a
 * shop does. It claims no cookie banner that does not exist and no consent flow
 * that was never built; where something is true only because of how the site is
 * built — that card numbers never reach it, because payment is on delivery —
 * it says so plainly.
 *
 * Meta and Google both ask for a privacy policy before an advertising account
 * is trusted, so this also unblocks the campaigns the pixel was installed for.
 */
export default function PrivacyPage() {
  return (
    <main className="bg-white">
      <Navbar />
      <div className="mx-auto max-w-3xl px-5 py-16 md:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
          KRISHOE
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-brand-green-ink md:text-5xl">
          गोपनीयता नीति
        </h1>
        <p className="mt-4 leading-7 text-brand-muted">
          Privacy Policy · अन्तिम अद्यावधिक: भदौ २०८३
        </p>

        <div className="mt-10 grid gap-8">
          <section>
            <h2 className="text-xl font-black text-brand-green-ink">हामी के लिन्छौँ</h2>
            <ul className="mt-3 grid gap-2 leading-7 text-brand-muted">
              <li>• <strong className="text-brand-green-ink">नाम, मोबाइल नम्बर र ठेगाना</strong> — सामान पुर्‍याउन। यो बिना डेलिभरी सम्भव छैन।</li>
              <li>• <strong className="text-brand-green-ink">Email</strong> — दिनुभएको भए, अर्डरको जानकारी पठाउन।</li>
              <li>• <strong className="text-brand-green-ink">के हेर्नुभयो</strong> — कुन जुत्ता धेरै मन पर्छ बुझ्न (Google Analytics, Meta Pixel)।</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-brand-green-ink">हामी के लिँदैनौँ</h2>
            <ul className="mt-3 grid gap-2 leading-7 text-brand-muted">
              {/* Not a promise about our conduct — a fact about how the shop is
                  built. Payment is on delivery, so card details never arrive
                  here in the first place and cannot be lost from here. */}
              <li>• <strong className="text-brand-green-ink">Card वा बैंकको गोप्य विवरण</strong> — सामान पाएपछि पैसा तिर्ने भएकाले यो हामीकहाँ आउँदैनै।</li>
              <li>• <strong className="text-brand-green-ink">नागरिकता वा परिचयपत्र</strong> — जुत्ता किन्न चाहिँदैन।</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-brand-green-ink">कसलाई दिन्छौँ</h2>
            <p className="mt-3 leading-7 text-brand-muted">
              सामान पुर्‍याउने कुरियरलाई तपाईंको नाम, नम्बर र ठेगाना दिनैपर्छ — त्यति मात्र।
              तपाईंको जानकारी हामी कसैलाई बेच्दैनौँ र विज्ञापनका लागि कसैसँग साट्दैनौँ।
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-brand-green-ink">गन्ने कुरा (Analytics)</h2>
            <p className="mt-3 leading-7 text-brand-muted">
              कति जना आए र कुन पाना हेरे भन्ने गन्न हामी Google Analytics र Meta Pixel
              प्रयोग गर्छौं। यसले <strong className="text-brand-green-ink">तपाईंको नाम, फोन वा
              ठेगाना पठाउँदैन</strong> — कुन जुत्ता हेरियो र कति मूल्यको अर्डर भयो भन्ने मात्र।
              फोनको सेटिङबाट यो बन्द गर्न सकिन्छ।
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-brand-green-ink">तपाईंको अधिकार</h2>
            <p className="mt-3 leading-7 text-brand-muted">
              आफ्नो जानकारी हेर्न, सच्याउन वा मेटाउन भन्न पाउनुहुन्छ। फोन गर्नुहोस् वा email
              गर्नुहोस् — हामी गरिदिन्छौँ। हिसाब-किताबका लागि कानुनले राख्नैपर्ने अर्डरको
              विवरण भने राख्नुपर्ने हुन्छ।
            </p>
          </section>

          <section className="rounded-2xl border border-brand-green/20 bg-brand-green-wash p-6">
            <h2 className="text-xl font-black text-brand-green-ink">सम्पर्क</h2>
            <p className="mt-3 leading-7 text-brand-muted">
              {businessContact.streetAddress}, {businessContact.addressLocality},{" "}
              {businessContact.addressRegion}
            </p>
            <p className="mt-2 leading-7">
              <a href={`tel:${businessContact.phoneTel}`} className="font-bold text-brand-green">
                {businessContact.phoneDisplay}
              </a>
              {" · "}
              <a
                href={`mailto:${businessContact.email}`}
                className="font-bold text-brand-green"
              >
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
