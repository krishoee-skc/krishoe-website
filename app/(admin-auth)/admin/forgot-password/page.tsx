import type { Metadata } from "next";
import { AdminForgotPasswordForm } from "@/components/admin/AdminAccessForms";
import T from "@/components/T";

export const metadata: Metadata = { title: "Forgot Staff Password | KRISHOE" };

export default async function AdminForgotPasswordPage({ searchParams }: { searchParams: Promise<{ for?: string }> }) {
  // A worker's version (owner, 2026-10-04): their words, eight characters, back to their sign-in.
  const forWorker = (await searchParams).for === "worker";
  return (
    <main className="grid min-h-dvh place-items-center bg-brand-green-ink px-4 py-12">
      <section className="w-full max-w-md rounded-3xl bg-brand-paper p-6 shadow-2xl sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-gold-deep">{forWorker ? <T en="Worker" ne="कामदार" /> : "Staff recovery"}</p>
        <h1 className="mt-3 text-3xl font-black text-brand-green-ink">{forWorker ? <T en="A new password by email" ne="Email बाट नयाँ password" /> : "Reset staff password"}</h1>
        <p className="mt-3 text-sm leading-6 text-brand-muted">
          <T
            en="You get both a 6-digit code and a link by email. Use whichever is easier. The code lasts 1 hour."
            ne="Email मा 6-digit कोड र एउटा link — दुवै आउँछ। जुन सजिलो हुन्छ त्यही चलाउनुहोस्। कोड १ घण्टा चल्छ।"
          />
        </p>
        {forWorker ? (
          <p className="mt-3 rounded-xl bg-brand-cream-soft px-4 py-3 text-sm font-bold text-brand-green-ink">
            <T en="No email on your account? Ask the owner — a new code comes on WhatsApp." ne="खातामा email छैन? मालिकलाई भन्नुहोस् — नयाँ कोड WhatsApp मा आउँछ।" />
          </p>
        ) : null}
        <div className="mt-7"><AdminForgotPasswordForm forWorker={forWorker} /></div>
      </section>
    </main>
  );
}
