import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, CheckIcon } from "@/components/Icons";

const promises = [
  {
    title: "Made in Nepal",
    detail: "Designed and made in our own workshop.",
  },
  {
    title: "Factory direct",
    detail: "Straight from our floor to your feet.",
  },
  {
    title: "Quality checked",
    detail: "Every pair is inspected before dispatch.",
  },
  {
    title: "Easy exchange",
    detail: "Human support when the fit is not right.",
  },
];

export default function About() {
  return (
    <section className="relative isolate overflow-hidden bg-[linear-gradient(135deg,#F8F5EC_0%,#FFFFFF_48%,#EEF5F1_100%)] py-20 sm:py-28">
      <div
        className="pointer-events-none absolute -left-32 top-10 h-80 w-80 rounded-full bg-brand-gold-bright/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-brand-green/10 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 md:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
        <div className="relative mx-auto w-full max-w-xl">
          <div className="absolute -inset-3 rounded-[2rem] border border-brand-gold-bright/25 sm:-inset-5" aria-hidden />
          <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-brand-green-ink shadow-[0_30px_90px_rgba(16,35,29,0.24)] sm:rounded-[2rem]">
            <Image
              src="/images/about-craftsmanship.webp"
              alt="Footwear artisan inspecting a carefully finished shoe beside a premium collection"
              fill
              sizes="(min-width: 1024px) 44vw, (min-width: 640px) 70vw, 92vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,45,34,0.22),transparent_40%,rgba(8,45,34,0.16))]" />

            <div className="absolute left-4 top-4 rounded-full border border-white/25 bg-brand-green-ink/80 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white shadow-lg backdrop-blur sm:left-6 sm:top-6">
              Made in Nepal
            </div>

            <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/20 bg-white/90 p-4 shadow-xl backdrop-blur-md sm:inset-x-6 sm:bottom-6 sm:p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-gold-deep">
                The KRISHOE promise
              </p>
              <p className="mt-1 text-lg font-black text-brand-green-ink sm:text-xl">
                Thoughtful design. Dependable finishing.
              </p>
            </div>
          </div>

          <div className="absolute -bottom-5 -right-2 grid h-24 w-24 place-items-center rounded-full border-4 border-white bg-brand-gold-bright text-center shadow-xl sm:-right-8 sm:h-28 sm:w-28">
            <span className="text-xs font-black uppercase leading-4 tracking-[0.12em] text-brand-green-ink">
              Factory
              <br />
              Direct
            </span>
          </div>
        </div>

        <div className="lg:py-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-green-line bg-white/75 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-brand-green shadow-sm backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-brand-gold-bright" />
            About KRISHOE
          </div>

          <h2 className="mt-6 max-w-3xl font-display text-4xl font-bold leading-[1.02] tracking-tight text-brand-green-ink sm:text-5xl lg:text-6xl">
            नेपाली हातले बनेको,
            <span className="mt-1 block text-brand-green">नेपाली पाइतालाई।</span>
          </h2>

          <p className="mt-6 max-w-2xl text-lg font-semibold leading-8 text-brand-muted-deep">
            KRISHOE is a Nepali footwear maker and shop. We bring design,
            production, and service together so every pair feels considered—from
            the first cut to the final step.
          </p>
          <p className="mt-4 max-w-2xl text-base leading-7 text-brand-muted">
            Comfortable everyday silhouettes, dependable finishing, honest
            factory-direct value, and people you can talk to when you need help.
            जुत्ता मात्र होइन, भरोसा।
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {promises.map((promise) => (
              <div
                key={promise.title}
                className="group flex gap-3 rounded-2xl border border-black/10 bg-white/75 p-4 shadow-[0_12px_35px_rgba(16,35,29,0.06)] backdrop-blur transition hover:-translate-y-0.5 hover:border-brand-green-line hover:shadow-[0_18px_45px_rgba(16,35,29,0.10)]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-green-wash text-brand-green">
                  <CheckIcon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-black text-brand-green-ink">
                    {promise.title}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-brand-muted">
                    {promise.detail}
                  </span>
                </span>
              </div>
            ))}
          </div>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/shop"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand-green px-6 text-sm font-black text-white shadow-[0_14px_35px_rgba(11,77,59,0.22)] transition hover:-translate-y-0.5 hover:bg-brand-green-ink"
            >
              Explore the collection
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/about"
              className="inline-flex h-12 items-center justify-center rounded-full border border-brand-green px-6 text-sm font-black text-brand-green transition hover:bg-brand-green-wash"
            >
              Read our story
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
