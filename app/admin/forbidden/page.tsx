import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Access denied | KRISHOE Admin" };

export default function AdminForbiddenPage() {
  return (
    <section className="grid min-h-[70vh] place-items-center p-5">
      <div className="w-full max-w-lg rounded-3xl border border-amber-200 bg-white p-7 text-center shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Permission required</p>
        <h1 className="mt-3 text-3xl font-black text-brand-green-ink">This page is not assigned to your role.</h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          Your account is signed in safely, but the Owner has not granted this module to your role.
        </p>
        <Link href="/admin" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-green px-5 font-black text-white">
          Go to allowed dashboard
        </Link>
      </div>
    </section>
  );
}
