"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAdminAction } from "@/app/admin/login/actions";
import ThemeToggle from "@/components/ThemeToggle";
import { adminNavLinks } from "@/app/admin/nav-links";

export default function AdminNav({
  adminRole,
  adminName,
  adminEmail,
  branchId,
}: {
  adminRole: string;
  adminName?: string;
  adminEmail?: string;
  branchId?: string;
}) {
  const pathname = usePathname();

  return (
    <div className="hidden border-r bg-white lg:block print:hidden">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-[60px] items-center justify-between gap-2 border-b px-6">
          <Link href="/admin" className="flex items-center gap-2 font-semibold">
            <span className="">KRISHOE Admin</span>
          </Link>
          {/* The admin is where the owner spends the evening, so the switch
              belongs here too, not only on the shop. */}
          <ThemeToggle />
        </div>
        <div className="px-4 pt-4">
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">
              Admin role
            </p>
            <p className="mt-1 text-sm font-black text-emerald-950">{adminRole}</p>
            {adminName ? (
              <p className="mt-1 text-xs font-semibold text-emerald-800">{adminName}</p>
            ) : null}
            {adminEmail ? (
              <p className="truncate text-xs text-emerald-700">{adminEmail}</p>
            ) : null}
            {branchId ? (
              <p className="mt-1 truncate text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                {branchId}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex-1 overflow-auto py-2">
          <nav className="grid items-start px-4 text-sm font-medium">
            {adminNavLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary ${
                  pathname === href ? "bg-gray-100 text-primary" : "text-gray-500"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <form action={logoutAdminAction} className="border-t p-4">
          <button
            type="submit"
            className="flex w-full items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-brand-clay transition hover:border-brand-clay hover:bg-red-50"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
