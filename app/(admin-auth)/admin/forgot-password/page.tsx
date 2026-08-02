import type { Metadata } from "next";
import { AdminForgotPasswordForm } from "@/components/admin/AdminAccessForms";

export const metadata: Metadata = { title: "Forgot Staff Password | KRISHOE" };

export default function AdminForgotPasswordPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-brand-green-ink px-4 py-12">
      <section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-gold-deep">Staff recovery</p>
        <h1 className="mt-3 text-3xl font-black text-brand-green-ink">Reset staff password</h1>
        <p className="mt-3 text-sm leading-6 text-brand-muted">A one-time link will be sent if this is an active KRISHOE staff account.</p>
        <div className="mt-7"><AdminForgotPasswordForm /></div>
      </section>
    </main>
  );
}
