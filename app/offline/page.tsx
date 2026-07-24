import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-brand-mist px-5 py-16 text-center">
      <section className="w-full max-w-md rounded-[2rem] border border-black/10 bg-white p-8 shadow-[0_24px_80px_rgba(16,35,29,0.12)]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-green text-2xl text-white">
          K
        </div>
        <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-brand-gold-deep">
          KRISHOE Offline
        </p>
        <h1 className="mt-3 font-display text-4xl font-bold text-brand-green-ink">
          फेरि जोडिँदैछ…
        </h1>
        <p className="mt-4 text-sm font-medium leading-7 text-brand-muted">
          इन्टरनेट अहिले उपलब्ध छैन। जडान फर्किएपछि फेरि प्रयास गर्नुहोस्।
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-brand-green px-6 text-sm font-black text-white"
        >
          Try again
        </Link>
      </section>
    </main>
  );
}
