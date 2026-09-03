import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminLoginForm from "@/components/AdminLoginForm";
import { getAdminSession } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Worker Login | KRISHOE",
  description: "Secure KRISHOE worker portal sign-in.",
};

export default async function WorkerLoginPage() {
  if (await getAdminSession()) redirect("/worker/dashboard");

  return (
    // The worker door of the same secure-terminal family as /enter and the admin
    // sign-in — a robotic KRISHOE monogram on a deep-green gradient with the soft
    // sandal texture — but wearing the worker door's sage-green accent, and with
    // no heavy photograph, so the fields load first on the cheapest phones. The
    // form (AdminLoginForm, portal="worker") is unchanged.
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[linear-gradient(180deg,#0b2e22,#0e3527_55%,#123f30)] px-5 py-14 text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-40 h-[55vh] bg-[radial-gradient(50%_100%_at_50%_0%,rgba(79,158,120,0.22),transparent)]" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cg transform='translate(20 22) rotate(-18)'%3E%3Cpath d='M6 2c8 0 12 5 12 14s-3 22-6 26-9 4-11 0-3-14-3-22S-2 2 6 2Z'/%3E%3Cpath d='M2 12c3-4 9-4 12 0'/%3E%3C/g%3E%3Cg transform='translate(78 74) rotate(20)'%3E%3Cpath d='M6 2c8 0 12 5 12 14s-3 22-6 26-9 4-11 0-3-14-3-22S-2 2 6 2Z'/%3E%3Cpath d='M2 12c3-4 9-4 12 0'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          backgroundSize: "120px 120px",
        }}
      />

      <div className="krishoe-enter relative z-10 flex w-full max-w-md flex-col items-center gap-5">
        <div className="flex items-center justify-center gap-3">
          <span className="krishoe-mono grid h-14 w-14 place-items-center overflow-hidden rounded-[15px] bg-[linear-gradient(150deg,#e3c684,#c9a24b)] font-tech text-2xl font-black leading-none text-[#0b2e22] shadow-[0_10px_28px_-10px_rgba(201,162,75,0.8),inset_0_1px_0_rgba(255,255,255,0.6)]">
            K
          </span>
          <span className="font-tech text-2xl font-black tracking-[0.14em] text-white sm:text-3xl">
            KRISHOE
          </span>
        </div>
        <p className="font-tech text-[10px] font-bold uppercase tracking-[0.32em] text-white/55">
          Walk with Authority
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#4f9e78]/40 bg-[#4f9e78]/20 px-3 py-1 font-tech text-[10px] font-bold uppercase tracking-[0.16em] text-[#a9e3c6]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-3 w-3">
            <rect x="4" y="11" width="16" height="9" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          Worker portal
        </span>

        <AdminLoginForm nextPath="/worker/dashboard" portal="worker" />

        <a href="/enter" className="font-tech text-[11px] font-bold uppercase tracking-[0.14em] text-[#a9e3c6] transition hover:text-white">
          ← All doors
        </a>
      </div>
    </main>
  );
}
