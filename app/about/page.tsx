import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhyChoose from "@/components/WhyChoose";
import Testimonials from "@/components/Testimonials";

export const metadata: Metadata = {
  title: "About KRISHOE | Walk with Authority",
  description: "Learn about KRISHOE premium footwear, curation standards, comfort focus, and Nepal-ready collections.",
};

export default function AboutPage() {
  return (
    <main className="bg-white">
      <Navbar />
      <section className="relative isolate overflow-hidden bg-brand-green-ink py-20 text-white">
        <Image
          src="/images/hero-banner.png"
          alt="KRISHOE premium footwear"
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(16,35,29,0.95),rgba(16,35,29,0.68))]" />
        <div className="relative mx-auto max-w-7xl px-5 md:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-gold-bright">
            About KRISHOE
          </p>
          <h1 className="mt-5 max-w-4xl text-5xl font-black leading-[0.96] tracking-tight md:text-7xl">
            Premium footwear with a confident Nepal-ready finish.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/78">
            KRISHOE curates footwear around comfort, polish, and everyday
            authority. The collection is focused enough to feel selective and
            broad enough to serve real daily wardrobes.
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 md:grid-cols-3 md:px-8">
          {[
            ["Curation", "Every pair is selected for silhouette, finish, and repeat-wear comfort."],
            ["Service", "The buying flow is built around inquiry, sizing support, and clean communication."],
            ["Growth", "The catalog is structured to connect with CMS, inventory, and checkout systems."],
          ].map(([title, text]) => (
            <article key={title} className="rounded-lg border border-black/10 bg-[#F9FAF8] p-6">
              <p className="text-2xl font-black text-brand-green-ink">{title}</p>
              <p className="mt-3 text-sm leading-7 text-brand-muted">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <WhyChoose />

      <section className="bg-brand-green-ink py-20 text-white">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 px-5 md:flex-row md:items-center md:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-bright">
              Experience
            </p>
            <h2 className="mt-3 max-w-3xl text-4xl font-black tracking-tight md:text-6xl">
              A premium shop should feel useful, not loud.
            </h2>
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
