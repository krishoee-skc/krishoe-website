import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import T from "@/components/T";
import { JsonLdScript } from "@/components/commerce/StructuredData";
import { businessContact, createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "बारम्बार सोधिने प्रश्न — FAQ",
  description:
    "KRISHOE बाट किन्दा सोधिने प्रश्नहरू: कति दिनमा पुग्छ, सामान पाएपछि पैसा तिर्न मिल्छ, साइज मिलेन भने के गर्ने, साट्न मिल्छ कि मिल्दैन। Delivery, cash on delivery, sizing and exchanges at KRISHOE.",
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
 *
 * Both languages, because two different people read this page and the shop
 * cannot tell them apart: the shopper in Chitwan, and the Nepali abroad buying
 * for family at home, who reads English faster than Devanagari. The second one
 * was pressing EN and being shown this page unchanged.
 */
const faqs = [
  {
    q: { ne: "कति दिनमा सामान पुग्छ?", en: "How long does delivery take?" },
    a: {
      ne: "नारायणगढ र भरतपुर भित्र सामान्यतया १–२ दिन। नेपालका अन्य ठाउँमा ३–५ दिन लाग्छ। अर्डर गरेपछि हामी फोन गरेर ठ्याक्कै कति दिन लाग्छ भन्छौँ।",
      en: "Usually 1–2 days inside Narayangadh and Bharatpur, and 3–5 days elsewhere in Nepal. We ring you after the order to say exactly how long yours will take.",
    },
  },
  {
    q: { ne: "सामान पाएपछि पैसा तिर्न मिल्छ?", en: "Can I pay after the shoes arrive?" },
    a: {
      ne: "मिल्छ। नेपालभरि cash on delivery (COD) चल्छ — सामान हातमा आएपछि मात्र पैसा तिर्नुहोस्। अग्रिम पैसा पठाउनै पर्दैन।",
      en: "Yes. Cash on delivery works anywhere in Nepal — pay once the pairs are in your hands. Nothing has to be sent in advance.",
    },
  },
  {
    q: { ne: "साइज मिलेन भने के गर्ने?", en: "What if the size does not fit?" },
    a: {
      ne: "साट्न मिल्छ। सामान पाएको ७ दिनभित्र, नलगाएको र प्याकिङ नबिगारेको अवस्थामा अर्को साइज पठाइदिन्छौँ। हामीलाई फोन गर्नुहोस्, बाँकी हामी मिलाउँछौँ।",
      en: "We exchange it. Within 7 days of delivery, unworn and with the packing intact, we send the other size. Ring us and we will arrange the rest.",
    },
  },
  {
    q: { ne: "साइज कसरी छान्ने?", en: "How do I pick my size?" },
    a: {
      ne: "हरेक जुत्ताको पानामा साइज तालिका छ — त्यहाँ खुट्टाको लम्बाइ सेन्टिमिटरमा दिइएको छ। खुट्टा नाप्नुहोस्, अनि तालिकासँग मिलाउनुहोस्। दुविधा भए फोन गर्नुहोस्, हामी भनिदिन्छौँ।",
      en: "Every shoe's page carries a size chart giving foot length in centimetres. Measure your foot and match it to the chart. If you fall between two sizes, ring us and we will tell you which to take.",
    },
  },
  {
    q: { ne: "यी जुत्ता कहाँ बन्छन्?", en: "Where are these shoes made?" },
    a: {
      ne: "हाम्रै कारखानामा, नारायणगढ, चितवनमा। डिजाइन हामी गर्छौं, बनाउने पनि हामी नै — बीचमा कोही छैन। त्यसैले मूल्य इमानदार हुन्छ।",
      en: "In our own factory in Narayangadh, Chitwan. We design them and we make them — nobody stands in between, which is why the price is an honest one.",
    },
  },
  {
    q: { ne: "अर्डर कहाँ पुग्यो कसरी थाहा पाउने?", en: "How do I know where my order is?" },
    a: {
      ne: "अर्डर नम्बर र आफ्नो मोबाइल नम्बर हालेर वेबसाइटमै हेर्न सकिन्छ। अर्डर पाइयो, तयारी भइरहेको, वा पुगिसक्यो — सबै देखिन्छ।",
      en: "Enter your order number and the mobile number you ordered with, right here on the site. It shows whether the order is received, being prepared, or already delivered.",
    },
  },
  {
    q: { ne: "थोकमा किन्न मिल्छ?", en: "Can I buy wholesale?" },
    a: {
      ne: "मिल्छ। पसल चलाउनुहुन्छ भने थोक मूल्यमा दिन्छौँ। वेबसाइटको थोक बिक्री पानाबाट सम्पर्क गर्नुहोस्, वा सिधै फोन गर्नुहोस्।",
      en: "Yes. If you run a shop we sell at wholesale rates. Write to us from the wholesale page on this site, or simply ring.",
    },
  },
  {
    q: { ne: "अनलाइन पैसा तिर्न मिल्छ?", en: "Can I pay online?" },
    a: {
      ne: `अहिले cash on delivery र बैंक जम्मा चल्छ। eSewa र Khalti को काम भइरहेको छ। कुनै दुविधा भए ${businessContact.phoneDisplay} मा फोन गर्नुहोस्।`,
      en: `For now, cash on delivery and bank transfer. eSewa and Khalti are being set up. If you are unsure about anything, ring ${businessContact.phoneDisplay}.`,
    },
  },
];

export default function FaqPage() {
  return (
    <main className="bg-brand-mist">
      {/* Structured data is read by Google rather than by a reader holding a
          language switch, so it carries the Nepali the shop's own customers
          type into search. */}
      <JsonLdScript
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((item) => ({
            "@type": "Question",
            name: item.q.ne,
            acceptedAnswer: { "@type": "Answer", text: item.a.ne },
          })),
        }}
      />
      <Navbar />
      <section className="mx-auto max-w-3xl px-5 py-12 md:px-8 md:py-16">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
          KRISHOE
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-brand-green-ink md:text-5xl">
          <T en="Questions people ask" ne="बारम्बार सोधिने प्रश्न" />
        </h1>
        <p className="mt-4 leading-7 text-brand-muted">
          <T
            en="What to know before you buy. If your question is not here, ring us — we will tell you."
            ne="किन्नुअघि जान्नुपर्ने कुरा। यहाँ नभएको कुरा भए फोन गर्नुहोस् — हामी भनिदिन्छौँ।"
          />
        </p>

        <div className="mt-10 grid gap-4">
          {faqs.map((item) => (
            <details
              key={item.q.ne}
              className="group rounded-2xl border border-black/10 bg-brand-paper p-5 shadow-sm"
            >
              <summary className="cursor-pointer list-none text-lg font-black text-brand-green-ink marker:hidden">
                <span className="flex items-start justify-between gap-4">
                  <T en={item.q.en} ne={item.q.ne} />
                  <span className="mt-1 shrink-0 text-brand-gold-deep transition group-open:rotate-45">
                    ＋
                  </span>
                </span>
              </summary>
              <p className="mt-3 leading-7 text-brand-muted">
                <T en={item.a.en} ne={item.a.ne} />
              </p>
            </details>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border-2 border-brand-green/25 bg-brand-green-wash p-6 text-center">
          <p className="text-lg font-black text-brand-green-ink">
            <T en="Anything else to ask?" ne="अरू केही सोध्नु छ?" />
          </p>
          <p className="mt-2 leading-7 text-brand-muted">
            <T
              en="Ring us — 10 in the morning to 7 in the evening."
              ne="फोन गर्नुहोस् — बिहान १० देखि बेलुका ७ बजेसम्म।"
            />
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
              <T en="Track your order" ne="अर्डर कहाँ पुग्यो हेर्ने" />
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
