import type { Metadata } from "next";
import Link from "next/link";
import { AdminSetPasswordForm } from "@/components/admin/AdminAccessForms";
import { getValidAdminStaffToken } from "@/lib/admin-staff-security";

export const metadata: Metadata = { title: "Accept Staff Invitation | KRISHOE" };

export default async function AcceptAdminInvitationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token?.trim() ?? "";
  const valid = token ? await getValidAdminStaffToken(token, "invitation") : null;

  return (
    <main className="grid min-h-screen place-items-center bg-brand-green-ink px-4 py-12">
      <section className="w-full max-w-md rounded-3xl bg-brand-paper p-6 shadow-2xl sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-gold-deep">KRISHOE staff invitation</p>
        <h1 className="mt-3 text-3xl font-black text-brand-green-ink">Create your staff password</h1>
        <p className="mt-3 text-sm leading-6 text-brand-muted">This one-time invitation activates your assigned role and branch.</p>
        <div className="mt-7">
          {valid ? <AdminSetPasswordForm token={token} mode="invitation" /> : (
            <div className="grid gap-4 rounded-xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-800">
              This invitation is invalid, expired, or already used.
              <Link href="/admin/login" className="font-black underline">Back to sign in</Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
