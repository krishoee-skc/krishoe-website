import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminChangePasswordForm } from "@/components/admin/AdminAccessForms";
import { getAdminSession } from "@/lib/admin-auth";
import { getSessionAdminRole } from "@/lib/admin-role-permissions";
import { WORKER_PASSWORD_MIN } from "@/lib/worker-join";
import T from "@/components/T";

export const metadata: Metadata = { title: "Change Staff Password | KRISHOE" };

export default async function ChangeAdminPasswordPage() {
  const session = await getAdminSession();
  if (!session?.staffId) redirect("/admin/login");
  // A worker comes here from the worker sign-in with the code they were sent
  // on WhatsApp, and sets an eight-character password of their own.
  const worker = getSessionAdminRole(session) === "Worker";
  if (worker) {
    return (
      <main className="grid min-h-dvh place-items-center bg-brand-green-ink px-4 py-12">
        <section className="w-full max-w-md rounded-3xl bg-brand-paper p-6 shadow-2xl sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-gold-deep">KRISHOE · <T en="Worker" ne="कामदार" /></p>
          <h1 className="mt-3 text-3xl font-black text-brand-green-ink"><T en="Make your own password" ne="आफ्नो password बनाउनुहोस्" /></h1>
          <p className="mt-3 text-sm leading-6 text-brand-muted">
            <T
              en={`The code works once. Now make a password of at least ${WORKER_PASSWORD_MIN} characters that you will remember and others will not guess — not your name or your mobile number.`}
              ne={`सुरुको कोड एक पटकको मात्र हो। अब आफूले सम्झिने, अरूले अनुमान नगर्ने कम्तीमा ${WORKER_PASSWORD_MIN} अक्षरको password बनाउनुहोस् — आफ्नो नाम वा मोबाइल नम्बर होइन।`}
            />
          </p>
          <div className="mt-7"><AdminChangePasswordForm minLength={WORKER_PASSWORD_MIN} worker /></div>
        </section>
      </main>
    );
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-brand-green-ink px-4 py-12">
      <section className="w-full max-w-md rounded-3xl bg-brand-paper p-6 shadow-2xl sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-gold-deep">First-login protection</p>
        <h1 className="mt-3 text-3xl font-black text-brand-green-ink">Change temporary password</h1>
        <p className="mt-3 text-sm leading-6 text-brand-muted">Before using admin tools, replace the temporary password with one only you know.</p>
        <div className="mt-7"><AdminChangePasswordForm /></div>
      </section>
    </main>
  );
}
