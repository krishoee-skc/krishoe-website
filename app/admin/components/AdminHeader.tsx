"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BellIcon, MenuIcon, XIcon, ChevronDownIcon, LogOutIcon, SettingsIcon } from "@/components/Icons";
import { logoutAdminAction } from "@/app/admin/login/actions";
import ThemeToggle from "@/components/ThemeToggle";

export default function AdminHeader({
  adminName,
  adminEmail,
  adminRole,
  onMenuToggle,
}: {
  adminName?: string;
  adminEmail?: string;
  adminRole: string;
  onMenuToggle: () => void;
}) {
  const pathname = usePathname();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const breadcrumbs = pathname
    .split("/")
    .filter((part) => part && part !== "admin")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1));

  return (
    <header className="sticky top-0 z-40 border-b border-admin-border bg-white shadow-xs dark:border-admin-border-dark dark:bg-admin-sidebar-dark">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left: Breadcrumb & Search */}
        <div className="flex flex-1 items-center gap-4">
          <button
            onClick={onMenuToggle}
            className="lg:hidden rounded-md p-2 hover:bg-admin-hover dark:hover:bg-admin-hover-dark"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Link href="/admin" className="hover:text-admin-primary dark:hover:text-admin-primary-light">
              Admin
            </Link>
            {breadcrumbs.map((crumb) => (
              <div key={crumb} className="flex items-center gap-2">
                <span>/</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{crumb}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Actions & Profile */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <button className="relative rounded-lg p-2 hover:bg-admin-hover dark:hover:bg-admin-hover-dark transition-colors">
            <BellIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500"></span>
          </button>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Profile Menu */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-admin-hover dark:hover:bg-admin-hover-dark transition-colors"
            >
              <div className="hidden sm:flex flex-col items-end">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{adminName || "Admin"}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{adminRole}</p>
              </div>
              <ChevronDownIcon className={`h-4 w-4 text-gray-600 dark:text-gray-400 transition-transform ${showProfileMenu ? "rotate-180" : ""}`} />
            </button>

            {/* Dropdown Menu */}
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-56 rounded-lg border border-admin-border bg-white shadow-lg dark:border-admin-border-dark dark:bg-admin-sidebar-dark animate-slide-in">
                <div className="border-b border-admin-border px-4 py-3 dark:border-admin-border-dark">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{adminName || "Admin"}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{adminEmail}</p>
                  <p className="mt-1 inline-block rounded-full bg-admin-primary/10 px-2 py-1 text-xs font-semibold text-admin-primary dark:text-admin-primary-light">
                    {adminRole}
                  </p>
                </div>
                <nav className="p-2">
                  <Link
                    href="/admin/settings"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-admin-hover dark:text-gray-300 dark:hover:bg-admin-hover-dark transition-colors"
                    onClick={() => setShowProfileMenu(false)}
                  >
                    <SettingsIcon className="h-4 w-4" />
                    Settings
                  </Link>
                </nav>
                <form action={logoutAdminAction} className="border-t border-admin-border p-2 dark:border-admin-border-dark">
                  <button
                    type="submit"
                    className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20 transition-colors"
                  >
                    <LogOutIcon className="h-4 w-4" />
                    Sign out
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
