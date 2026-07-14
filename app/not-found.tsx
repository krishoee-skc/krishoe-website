import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function NotFound() {
  return (
    <main className="bg-[#F5F7F4]">
      <Navbar />
      <section className="mx-auto flex min-h-[70vh] max-w-4xl flex-col items-center justify-center px-5 py-20 text-center md:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#B98A2E]">
          404 / KRISHOE
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-[#10231D] md:text-6xl">
          This page is not available.
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-[#5F6B66]">
          The link may have changed, or the product may no longer be active in the catalog.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/shop"
            className="inline-flex h-12 items-center rounded-full bg-[#0B4D3B] px-6 text-sm font-bold text-white transition hover:bg-[#D4AF37] hover:text-[#10231D]"
          >
            Shop collection
          </Link>
          <Link
            href="/contact"
            className="inline-flex h-12 items-center rounded-full border border-[#0B4D3B] px-6 text-sm font-bold text-[#0B4D3B] transition hover:bg-white"
          >
            Contact KRISHOE
          </Link>
        </div>
      </section>
      <Footer />
    </main>
  );
}
