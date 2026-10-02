import Image from "next/image";
import T from "@/components/T";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/Icons";

/**
 * Who makes the shoes, in a breath (owner, 2026-10-02: "little, but sweet").
 * It used to say it three times over — four promise tiles that repeated "Why
 * KRISHOE" word for word, a "promise" card on the photo, a "Factory Direct"
 * badge — under a two-line headline. Now: the photo, one line, one short
 * paragraph, the two ways on.
 */
export default function About() {
  return (
    <section className="relative isolate overflow-hidden bg-[linear-gradient(135deg,#F8F5EC_0%,#FFFFFF_48%,#EEF5F1_100%)] py-8 md:py-20 sm:py-28">
      <div
        className="pointer-events-none absolute -left-32 top-10 h-80 w-80 rounded-full bg-brand-gold-bright/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-brand-green/10 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 md:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
        <div className="relative mx-auto w-full max-w-md lg:max-w-xl">
          <div className="absolute -inset-3 rounded-[2rem] border border-brand-gold-bright/25 sm:-inset-5" aria-hidden />
          <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-brand-green-ink shadow-[0_30px_90px_rgba(16,35,29,0.24)] sm:rounded-[2rem]">
            <Image
              src="/images/about-craftsmanship-v3.webp"
              alt="Footwear artisan inspecting a carefully finished shoe beside a premium collection"
              fill
              sizes="(min-width: 1024px) 44vw, (min-width: 640px) 70vw, 92vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,45,34,0.22),transparent_40%,rgba(8,45,34,0.16))]" />
            <div className="absolute left-4 top-4 rounded-full border border-white/25 bg-brand-green-ink/80 px-4 py-2 text-xs font-black text-white shadow-lg backdrop-blur sm:left-6 sm:top-6">
              <T en="Made in Nepal" ne="नेपालमै बनेको" />
            </div>
          </div>
        </div>

        <div className="lg:py-6">
          <p className="text-sm font-bold text-brand-gold-deep">
            <T en="About KRISHOE" ne="KRISHOE बारे" />
          </p>

          <h2 className="mt-2 max-w-3xl font-display text-2xl font-black tracking-tight text-brand-green-ink md:text-4xl leading-tight">
            <T en="From our floor to your feet." ne="हाम्रो कारखानाबाट तपाईंको खुट्टासम्म।" />
          </h2>

          <p className="mt-4 max-w-2xl text-base leading-7 text-brand-muted-deep md:text-lg md:leading-8">
            <T
              en="A small family workshop in Chitwan, making the sandals people wear every day — and a shop where somebody answers when you call."
              ne="KRISHOE नेपालकै जुत्ता कारखाना र पसल हो — चितवनको सानो पारिवारिक कारखाना, जहाँ दिनहुँ लगाउने स्यान्डल बन्छन्, र फोन गर्दा मान्छे बोल्छ।"
            />
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/shop"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand-green px-6 text-sm font-black text-white shadow-[0_14px_35px_rgba(11,77,59,0.22)] transition hover:-translate-y-0.5 hover:bg-brand-green-ink"
            >
              <T en="See the shoes" ne="जुत्ता हेर्ने" />
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/about"
              className="inline-flex h-12 items-center justify-center rounded-full border border-brand-green px-6 text-sm font-black text-brand-green transition hover:bg-brand-green-wash"
            >
              <T en="Read our story" ne="हाम्रो कथा पढ्ने" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
