import type { Metadata } from "next";
import Link from "next/link";
import { AdminSetPasswordForm } from "@/components/admin/AdminAccessForms";
import { getValidAdminStaffToken } from "@/lib/admin-staff-security";

export const metadata: Metadata = { title: "Reset Staff Password | KRISHOE" };

export default async function AdminResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token?.trim() ?? "";
  const valid = token ? await getValidAdminStaffToken(token, "password_reset") : null;

  return (
    <main className="grid min-h-screen place-items-center bg-brand-green-ink px-4 py-12">
      <section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-gold-deep">Secure recovery</p>
        <h1 className="mt-3 text-3xl font-black text-brand-green-ink">Choose a new password</h1>
        <p className="mt-3 text-sm leading-6 text-brand-muted">Use a strong password that you do not use on another website.</p>
        <div className="mt-7">
          {valid ? <AdminSetPasswordForm token={token} mode="password-reset" /> : (
            <div className="grid gap-4 rounded-xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-800">
              This reset link is invalid, expired, or already used.
              <Link href="/admin/forgot-password" className="font-black underline">Request a new link</Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
