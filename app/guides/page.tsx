import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import T from "@/components/T";
import { guides } from "@/lib/guides";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Footwear guides",
  description:
    "Simple KRISHOE guides to buying footwear in Nepal — how to choose sandals and slippers, and how to measure your foot for the right size.",
  path: "/guides",
});

/**
 * The guides index. These pages exist to be found by a shopper searching a
 * question, not a product — "how to choose sandals", "shoe size Nepal" — and to
 * walk them from the answer to the shelf. Kept deliberately plain: a shopper
 * who came for an answer should get it, then a clear way into the shop.
 */
export default function GuidesPage() {
  return (
    <main className="bg-brand-paper">
      <Navbar />

      <section className="bg-brand-green-ink py-16 text-white">
        <div className="mx-auto max-w-5xl px-5 md:px-8">
          <p className="text-sm font-bold uppercase tracking-[0.28em] text-brand-gold-bright">
            <T en="KRISHOE Guides" ne="KRISHOE Guides" />
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-white md:text-5xl">
            <T
              en="Buy footwear that lasts — with a little know-how"
              ne="टिक्ने जुत्ता किन्नुहोस् — अलिकति जानकारीसाथ"
            />
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-white/80">
            <T
              en="Short, honest guides from the people who make the shoes — so you buy the right pair the first time."
              ne="जुत्ता बनाउनेहरूबाट छोटो, इमानदार guide — ताकि तपाईं पहिलो पटकमै ठीक जोडी किन्नुहोस्।"
            />
          </p>
        </div>
      </section>

      <section className="py-14">
        <div className="mx-auto grid max-w-5xl gap-6 px-5 md:grid-cols-2 md:px-8">
          {guides.map((guide) => (
            <Link
              key={guide.slug}
              href={`/guides/${guide.slug}`}
              className="group rounded-2xl border border-black/10 bg-brand-mist p-7 transition hover:border-brand-gold/60 hover:shadow-lg"
            >
              <span className="text-4xl" aria-hidden>
                {guide.emoji}
              </span>
              <h2 className="mt-4 text-xl font-black text-brand-green-ink group-hover:text-brand-green">
                <T en={guide.title.en} ne={guide.title.ne} />
              </h2>
              <p className="mt-2 text-sm leading-7 text-brand-muted">
                <T en={guide.summary.en} ne={guide.summary.ne} />
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-brand-green">
                <T en="Read the guide" ne="Guide पढ्नुहोस्" /> →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}
