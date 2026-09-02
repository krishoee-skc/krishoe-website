import type { Metadata } from "next";
import { AdminResetWithCodeForm, AdminSetPasswordForm } from "@/components/admin/AdminAccessForms";
import { getValidAdminStaffToken } from "@/lib/admin-staff-security";
import T from "@/components/T";

export const metadata: Metadata = { title: "Reset Staff Password | KRISHOE" };

/**
 * Reachable two ways on purpose. With a working token in the URL it sets the
 * password straight away; without one — a stale link, a link the mail client
 * broke, or someone who simply typed the address — it asks for the emailed code
 * instead of turning them away.
 */
export default async function AdminResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token?.trim() ?? "";
  const valid = token ? await getValidAdminStaffToken(token, "password_reset") : null;

  return (
    <main className="grid min-h-screen place-items-center bg-brand-green-ink px-4 py-12">
      <section className="w-full max-w-md rounded-3xl bg-brand-paper p-6 shadow-2xl sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-gold-deep">Secure recovery</p>
        <h1 className="mt-3 text-3xl font-black text-brand-green-ink">Choose a new password</h1>
        <p className="mt-3 text-sm leading-6 text-brand-muted">
          {valid ? (
            "Use a strong password that you do not use on another website."
          ) : (
            <T en="Enter the 6-digit code from your email and a new password." ne="Email मा आएको 6-digit कोड र नयाँ password हाल्नुहोस्।" />
          )}
        </p>
        {token && !valid ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            <T en="That link stopped working — but the code from your email works right now." ne="त्यो link चल्न छाड्यो — तर email मा आएको कोडले अहिल्यै हुन्छ।" />
          </p>
        ) : null}
        <div className="mt-7">
          {valid
            ? <AdminSetPasswordForm token={token} mode="password-reset" />
            : <AdminResetWithCodeForm />}
        </div>
      </section>
    </main>
  );
}
