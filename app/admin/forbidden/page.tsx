import Link from "next/link";
import type { Metadata } from "next";
import T from "@/components/T";

export const metadata: Metadata = { title: "Access denied | KRISHOE Admin" };

// In both languages (owner's sample 7घ, 2026-10-14): staff reading this were
// told in English only that a page was not theirs.
export default function AdminForbiddenPage() {
  return (
    <section className="grid min-h-[70vh] place-items-center p-5">
      <div className="w-full max-w-lg rounded-3xl border border-amber-200 bg-brand-paper p-7 text-center shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700"><T en="Permission required" ne="अनुमति चाहिन्छ" /></p>
        <h1 className="mt-3 text-3xl font-black text-brand-green-ink"><T en="This page is not assigned to your role." ne="यो पाना तपाईंको भूमिकामा छैन।" /></h1>
        <p className="mt-3 text-sm leading-6 text-brand-muted">
          <T
            en="Your account is signed in safely, but the Owner has not granted this module to your role. Ask the Owner if you need it."
            ne="तपाईंको खाता सुरक्षित रूपमा खुलेको छ, तर मालिकले यो भाग तपाईंको भूमिकालाई दिनुभएको छैन। चाहिए मालिकलाई सोध्नुहोस्।"
          />
        </p>
        <Link href="/admin" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-green px-5 font-black text-white">
          <T en="Go to allowed dashboard" ne="आफ्नो Dashboard मा जाने" />
        </Link>
      </div>
    </section>
  );
}
