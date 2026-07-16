import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function NotFound() {
  return (
    <main className="bg-brand-mist">
      <Navbar />
      <section className="mx-auto flex min-h-[70vh] max-w-4xl flex-col items-center justify-center px-5 py-20 text-center md:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
          404 / KRISHOE
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-brand-green-ink md:text-6xl">
          This page is not available.
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-brand-muted">
          The link may have changed, or the product may no longer be active in the catalog.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/shop"
            className="inline-flex h-12 items-center rounded-full bg-brand-green px-6 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink"
          >
            Shop collection
          </Link>
          <Link
            href="/contact"
            className="inline-flex h-12 items-center rounded-full border border-brand-green px-6 text-sm font-bold text-brand-green transition hover:bg-white"
          >
            Contact KRISHOE
          </Link>
        </div>
      </section>
      <Footer />
    </main>
  );
}
