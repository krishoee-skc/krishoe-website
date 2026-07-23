import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhyChoose from "@/components/WhyChoose";
import Testimonials from "@/components/Testimonials";

export const metadata: Metadata = {
  title: "Our Story | KRISHOE — Made in Nepal",
  description:
    "KRISHOE is a Nepali footwear factory and shop. We design, make, and sell our own shoes — from our factory floor straight to your feet, at an honest price.",
};

// The story only claims what is true of the shop: its own factory, its own
// designs, direct prices, easy exchange, and that reviews shape what gets made
// next. No invented history, no invented numbers.
export default function AboutPage() {
  return (
    <main className="bg-white">
      <Navbar />

      <section className="relative isolate overflow-hidden bg-brand-green-ink py-20 text-white">
        <Image
          src="/images/hero-banner.png"
          alt="KRISHOE footwear, made in Nepal"
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(16,35,29,0.95),rgba(16,35,29,0.68))]" />
        <div className="relative mx-auto max-w-7xl px-5 md:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-gold-bright">
            हाम्रो कथा — Our Story
          </p>
          <h1 className="mt-5 max-w-4xl text-5xl font-black leading-[0.96] tracking-tight md:text-7xl">
            Made in Nepal. हाम्रै हातले, हाम्रै कारखानामा।
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/78">
            KRISHOE is a Nepali footwear factory and shop. We design our own
            shoes, make them in our own workshop, and sell them ourselves —
            so every pair carries the care of the hands that made it.
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 md:grid-cols-3 md:px-8">
          {[
            [
              "हाम्रै कारखाना",
              "Our own factory",
              "Every pair is cut, stitched, and finished by Nepali hands in our own workshop. When you buy KRISHOE, you stand with Nepali craft.",
            ],
            [
              "इमानदार मूल्य",
              "Honest factory price",
              "No middlemen. Shoes travel from our factory floor straight to your feet — so the price you pay is the fair one.",
            ],
            [
              "सजिलो सेवा",
              "Easy, human service",
              "Order on WhatsApp or Viber, get a clear bill, and exchange easily if something isn't right. Buying shoes should feel simple.",
            ],
          ].map(([nepali, english, text]) => (
            <article key={english} className="rounded-lg border border-black/10 bg-[#F9FAF8] p-6">
              <p className="text-2xl font-black text-brand-green-ink">{nepali}</p>
              <p className="mt-1 text-sm font-bold uppercase tracking-[0.18em] text-brand-gold-deep">
                {english}
              </p>
              <p className="mt-3 text-sm leading-7 text-brand-muted">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-brand-mist py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
            हाम्रो वाचा — Our Promise
          </p>
          <h2 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-brand-green-ink md:text-5xl">
            जुत्ता मात्र होइन, भरोसा।
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              [
                "१",
                "Checked before it leaves",
                "हरेक जोडी कारखानाबाट निस्कनु अघि जाँचिन्छ। A pair that isn't good enough for our own family doesn't leave the workshop.",
              ],
              [
                "२",
                "Easy exchange",
                "मिलेन भने सजिलै साट्नुहोस्। Our return policy is written for customers, not against them.",
              ],
              [
                "३",
                "We listen, then we make",
                "तपाईंको प्रतिक्रियाले नै हाम्रो अर्को design जन्माउँछ। Every review is read, and the next batch is better for it.",
              ],
            ].map(([number, title, text]) => (
              <article key={title} className="rounded-lg border border-black/10 bg-white p-6 shadow-sm">
                <p className="grid h-10 w-10 place-items-center rounded-full bg-brand-green text-lg font-black text-white">
                  {number}
                </p>
                <p className="mt-4 text-xl font-black text-brand-green-ink">{title}</p>
                <p className="mt-3 text-sm leading-7 text-brand-muted">{text}</p>
              </article>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/return-policy"
              className="inline-flex h-12 items-center rounded-full border border-brand-green px-6 text-sm font-bold text-brand-green transition hover:bg-brand-green hover:text-white"
            >
              Read our return policy
            </Link>
            <Link
              href="/contact"
              className="inline-flex h-12 items-center rounded-full border border-black/10 px-6 text-sm font-bold text-brand-green-ink transition hover:border-brand-green hover:text-brand-green"
            >
              Talk to us
            </Link>
          </div>
        </div>
      </section>

      <WhyChoose />

      <section className="bg-brand-green-ink py-20 text-white">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 px-5 md:flex-row md:items-center md:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-bright">
              KRISHOE
            </p>
            <h2 className="mt-3 max-w-3xl text-4xl font-black tracking-tight md:text-6xl">
              नेपाली पाइला, नेपाली जुत्तामा।
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-white/78">
              Every KRISHOE pair keeps a Nepali workshop running and a Nepali
              craftsperson working. Walk with that.
            </p>
          </div>
          <Link
            href="/shop"
            className="inline-flex h-12 w-fit items-center rounded-full bg-brand-gold-bright px-6 text-sm font-black text-brand-green-ink transition hover:bg-white"
          >
            Shop KRISHOE
          </Link>
        </div>
      </section>

      <Testimonials />
      <Footer />
    </main>
  );
}
