"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAdminAction } from "@/app/admin/login/actions";
import ThemeToggle from "@/components/ThemeToggle";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/Icons";
import { useSidebar } from "@/components/admin/SidebarProvider";
import { adminNavLinks } from "@/app/admin/nav-links";
import { canAccessAdminPath, type AdminRole } from "@/lib/admin-role-permissions";

export default function AdminNav({
  adminRole,
  adminName,
  adminEmail,
  branchId,
}: {
  adminRole: AdminRole;
  adminName?: string;
  adminEmail?: string;
  branchId?: string;
}) {
  const pathname = usePathname();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const links = adminNavLinks.filter((link) => canAccessAdminPath(adminRole, link.href));

  return (
    <div className={`hidden border-r bg-white transition-all duration-300 lg:block print:hidden ${isCollapsed ? "lg:w-20" : "lg:w-[280px]"}`}>
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-[60px] items-center justify-between gap-2 border-b px-6">
          {!isCollapsed && (
            <Link href="/admin" className="flex items-center gap-2 font-semibold">
              <span className="">KRISHOE Admin</span>
            </Link>
          )}
          <div className="flex items-center gap-2">
            {!isCollapsed && <ThemeToggle />}
            <button
              onClick={toggleSidebar}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="rounded-lg p-2 hover:bg-gray-100 transition"
              aria-label="Toggle sidebar"
            >
              {isCollapsed ? (
                <ChevronRightIcon className="h-4 w-4" />
              ) : (
                <ChevronLeftIcon className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
        {!isCollapsed && (
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
        )}
        <div className="flex-1 overflow-auto py-2">
          <nav className={`grid items-start text-sm font-medium ${isCollapsed ? "px-2" : "px-4"}`}>
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                title={isCollapsed ? label : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary ${
                  pathname === href ? "bg-gray-100 text-primary" : "text-gray-500"
                } ${isCollapsed ? "justify-center" : ""}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!isCollapsed && <span>{label}</span>}
              </Link>
            ))}
          </nav>
        </div>
        <form action={logoutAdminAction} className={`border-t p-4 ${isCollapsed ? "flex justify-center" : ""}`}>
          <button
            type="submit"
            title={isCollapsed ? "Sign out" : undefined}
            className={`flex items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-brand-clay transition hover:border-brand-clay hover:bg-red-50 ${
              isCollapsed ? "w-full" : "w-full"
            }`}
          >
            {isCollapsed ? <span className="text-lg">→</span> : "Sign out"}
          </button>
        </form>
      </div>
    </div>
  );
}
