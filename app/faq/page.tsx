import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { JsonLdScript } from "@/components/commerce/StructuredData";
import { businessContact, createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "बारम्बार सोधिने प्रश्न — FAQ",
  description:
    "KRISHOE बाट किन्दा सोधिने प्रश्नहरू: कति दिनमा पुग्छ, सामान पाएपछि पैसा तिर्न मिल्छ, साइज मिलेन भने के गर्ने, साट्न मिल्छ कि मिल्दैन।",
  path: "/faq",
});

/**
 * The questions customers ask before they trust a shop they have not visited.
 *
 * Every answer here is one the shop already gives on the telephone. Writing
 * them down does two things: it saves the owner the same call twenty times, and
 * it lets someone deciding at eleven at night find the answer without having to
 * ask a stranger for it.
 *
 * The FAQPage structured data below is what lets Google show these questions
 * directly in its results — worth more to a shop nobody has heard of than any
 * amount of keyword tuning, because it puts a real answer in front of someone
 * who has not yet clicked anything.
 */
const faqs = [
  {
    q: "कति दिनमा सामान पुग्छ?",
    a: "नारायणगढ र भरतपुर भित्र सामान्यतया १–२ दिन। नेपालका अन्य ठाउँमा ३–५ दिन लाग्छ। अर्डर गरेपछि हामी फोन गरेर ठ्याक्कै कति दिन लाग्छ भन्छौँ।",
  },
  {
    q: "सामान पाएपछि पैसा तिर्न मिल्छ?",
    a: "मिल्छ। नेपालभरि cash on delivery (COD) चल्छ — सामान हातमा आएपछि मात्र पैसा तिर्नुहोस्। अग्रिम पैसा पठाउनै पर्दैन।",
  },
  {
    q: "साइज मिलेन भने के गर्ने?",
    a: "साट्न मिल्छ। सामान पाएको ७ दिनभित्र, नलगाएको र प्याकिङ नबिगारेको अवस्थामा अर्को साइज पठाइदिन्छौँ। हामीलाई फोन गर्नुहोस्, बाँकी हामी मिलाउँछौँ।",
  },
  {
    q: "साइज कसरी छान्ने?",
    a: "हरेक जुत्ताको पानामा साइज तालिका छ — त्यहाँ खुट्टाको लम्बाइ सेन्टिमिटरमा दिइएको छ। खुट्टा नाप्नुहोस्, अनि तालिकासँग मिलाउनुहोस्। दुविधा भए फोन गर्नुहोस्, हामी भनिदिन्छौँ।",
  },
  {
    q: "यी जुत्ता कहाँ बन्छन्?",
    a: "हाम्रै कारखानामा, नारायणगढ, चितवनमा। डिजाइन हामी गर्छौं, बनाउने पनि हामी नै — बीचमा कोही छैन। त्यसैले मूल्य इमानदार हुन्छ।",
  },
  {
    q: "अर्डर कहाँ पुग्यो कसरी थाहा पाउने?",
    a: "अर्डर नम्बर र आफ्नो मोबाइल नम्बर हालेर वेबसाइटमै हेर्न सकिन्छ। अर्डर पाइयो, तयारी भइरहेको, वा पुगिसक्यो — सबै देखिन्छ।",
  },
  {
    q: "थोकमा किन्न मिल्छ?",
    a: "मिल्छ। पसल चलाउनुहुन्छ भने थोक मूल्यमा दिन्छौँ। वेबसाइटको थोक बिक्री पानाबाट सम्पर्क गर्नुहोस्, वा सिधै फोन गर्नुहोस्।",
  },
  {
    q: "अनलाइन पैसा तिर्न मिल्छ?",
    a: `अहिले cash on delivery र बैंक जम्मा चल्छ। eSewa र Khalti को काम भइरहेको छ। कुनै दुविधा भए ${businessContact.phoneDisplay} मा फोन गर्नुहोस्।`,
  },
];

export default function FaqPage() {
  return (
    <main className="bg-brand-mist">
      <JsonLdScript
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }}
      />
      <Navbar />
      <section className="mx-auto max-w-3xl px-5 py-12 md:px-8 md:py-16">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
          KRISHOE
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-brand-green-ink md:text-5xl">
          बारम्बार सोधिने प्रश्न
        </h1>
        <p className="mt-4 leading-7 text-brand-muted">
          किन्नुअघि जान्नुपर्ने कुरा। यहाँ नभएको कुरा भए फोन गर्नुहोस् — हामी भनिदिन्छौँ।
        </p>

        <div className="mt-10 grid gap-4">
          {faqs.map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl border border-black/10 bg-white p-5 shadow-sm"
            >
              <summary className="cursor-pointer list-none text-lg font-black text-brand-green-ink marker:hidden">
                <span className="flex items-start justify-between gap-4">
                  {item.q}
                  <span className="mt-1 shrink-0 text-brand-gold-deep transition group-open:rotate-45">
                    ＋
                  </span>
                </span>
              </summary>
              <p className="mt-3 leading-7 text-brand-muted">{item.a}</p>
            </details>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border-2 border-brand-green/25 bg-brand-green-wash p-6 text-center">
          <p className="text-lg font-black text-brand-green-ink">अरू केही सोध्नु छ?</p>
          <p className="mt-2 leading-7 text-brand-muted">
            फोन गर्नुहोस् — बिहान १० देखि बेलुका ७ बजेसम्म।
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <a
              href={`tel:${businessContact.phoneTel}`}
              className="inline-flex min-h-12 items-center rounded-full bg-brand-green px-6 text-sm font-black text-white"
            >
              {businessContact.phoneDisplay}
            </a>
            <Link
              href="/track-order"
              className="inline-flex min-h-12 items-center rounded-full border border-brand-green px-6 text-sm font-black text-brand-green"
            >
              अर्डर कहाँ पुग्यो हेर्ने
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
