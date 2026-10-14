import type { Metadata } from "next";
import Link from "next/link";
import { AdminSetPasswordForm } from "@/components/admin/AdminAccessForms";
import { getValidAdminStaffToken } from "@/lib/admin-staff-security";
import T from "@/components/T";

export const metadata: Metadata = { title: "Accept Staff Invitation | KRISHOE" };

export default async function AcceptAdminInvitationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token?.trim() ?? "";
  const valid = token ? await getValidAdminStaffToken(token, "invitation") : null;

  // The first KRISHOE page a new staff member sees, in both languages
  // (owner's sample 8, 2026-10-14); the password form inside already was.
  return (
    <main className="grid min-h-dvh place-items-center bg-brand-green-ink px-4 py-12">
      <section className="w-full max-w-md rounded-3xl bg-brand-paper p-6 shadow-2xl sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-gold-deep">KRISHOE · <T en="Staff invitation" ne="staff को निम्तो" /></p>
        <h1 className="mt-3 text-3xl font-black text-brand-green-ink"><T en="Create your staff password" ne="आफ्नो password बनाउनुहोस्" /></h1>
        <p className="mt-3 text-sm leading-6 text-brand-muted">
          <T
            en="This one-time invitation opens the role and branch given to you."
            ne="यो एक पटकको निम्तोले तपाईंलाई दिइएको भूमिका र शाखा खोल्छ।"
          />
        </p>
        <div className="mt-7">
          {valid ? <AdminSetPasswordForm token={token} mode="invitation" /> : (
            <div className="grid gap-4 rounded-xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-800">
              <T
                en="This invitation is invalid, expired, or already used. Ask the shop for a new one."
                ne="यो निम्तो मिलेन, पुरानो भयो वा पहिल्यै प्रयोग भइसक्यो। पसलसँग नयाँ निम्तो माग्नुहोस्।"
              />
              <Link href="/admin/login" className="font-black underline"><T en="Back to sign in" ne="login मा फर्कने" /></Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
