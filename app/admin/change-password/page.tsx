import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminChangePasswordForm } from "@/components/admin/AdminAccessForms";
import { getAdminSession } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "Change Staff Password | KRISHOE" };

export default async function ChangeAdminPasswordPage() {
  const session = await getAdminSession();
  if (!session?.staffId) redirect("/admin/login");

  return (
    <main className="grid min-h-screen place-items-center bg-brand-green-ink px-4 py-12">
      <section className="w-full max-w-md rounded-3xl bg-brand-paper p-6 shadow-2xl sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-gold-deep">First-login protection</p>
        <h1 className="mt-3 text-3xl font-black text-brand-green-ink">Change temporary password</h1>
        <p className="mt-3 text-sm leading-6 text-brand-muted">Before using admin tools, replace the temporary password with one only you know.</p>
        <div className="mt-7"><AdminChangePasswordForm /></div>
      </section>
    </main>
  );
}
