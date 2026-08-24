"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAdminAction } from "@/app/admin/login/actions";
import { ChevronLeftIcon, ChevronRightIcon, LogOutIcon } from "@/components/Icons";
import { useSidebar } from "@/components/admin/SidebarProvider";
import WorkspaceSwitch from "@/app/admin/WorkspaceSwitch";
import { useAdminWorkspace } from "@/app/admin/useAdminWorkspace";
import { type AdminRole } from "@/lib/admin-role-permissions";

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
  const { workspace, chooseWorkspace, groups } = useAdminWorkspace(adminRole, pathname);

  return (
    <div className={`hidden border-r border-admin-border bg-admin-sidebar transition-all duration-300 lg:block print:hidden dark:border-admin-border-dark dark:bg-admin-sidebar-dark ${isCollapsed ? "lg:w-20" : "lg:w-[280px]"}`}>
      <div className="flex h-full max-h-screen flex-col gap-0">
        {/* Header with Logo */}
        <div className="flex h-16 items-center justify-between gap-2 border-b border-admin-border px-4 dark:border-admin-border-dark">
          {/* The shop's own mark, not a letter in a gradient box. It stays
              when the sidebar collapses, where the header used to hold nothing
              but the toggle arrow. */}
          <Link href="/admin" className="flex min-w-0 items-center gap-2.5">
            <Image
              src="/images/logo-mark.png"
              alt={isCollapsed ? "KRISHOE" : ""}
              width={80}
              height={80}
              preload
              className="h-10 w-10 shrink-0"
            />
            {!isCollapsed && (
              <span className="truncate text-xl font-black tracking-wide text-gray-900 dark:text-white">
                KRISHOE
              </span>
            )}
          </Link>
          <button
            onClick={toggleSidebar}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="rounded-lg p-2 hover:bg-admin-hover dark:hover:bg-admin-hover-dark transition-colors"
            aria-label="Toggle sidebar"
          >
            {isCollapsed ? (
              <ChevronRightIcon className="h-4 w-4" />
            ) : (
              <ChevronLeftIcon className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Admin Info Card */}
        {!isCollapsed && (
          <div className="border-b border-admin-border px-4 py-4 dark:border-admin-border-dark">
            <div className="rounded-lg border border-admin-primary/20 bg-gradient-to-br from-admin-primary/5 to-admin-accent/5 px-3 py-3 dark:from-admin-primary/10 dark:to-admin-accent/10">
              <p className="text-xs font-bold uppercase tracking-wider text-admin-primary dark:text-admin-primary-light">
                Admin Role
              </p>
              <p className="mt-2 text-base font-bold text-gray-900 dark:text-white">{adminRole}</p>
              {adminName ? (
                <p className="mt-2 text-sm font-semibold text-gray-700 dark:text-gray-300">{adminName}</p>
              ) : null}
              {adminEmail ? (
                <p className="truncate text-xs text-gray-600 dark:text-gray-400">{adminEmail}</p>
              ) : null}
              {branchId ? (
                <p className="mt-2 truncate text-xs font-semibold uppercase tracking-wider text-admin-accent dark:text-admin-accent-light">
                  {branchId}
                </p>
              ) : null}
            </div>
          </div>
        )}

        {/* Which half of the business this menu is showing. */}
        <div className={`border-b border-admin-border pb-3 pt-3 dark:border-admin-border-dark ${isCollapsed ? "px-2" : "px-3"}`}>
          <WorkspaceSwitch
            workspace={workspace}
            onChoose={chooseWorkspace}
            compact={isCollapsed}
          />
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-auto py-4">
          <nav className={`grid items-start gap-4 font-medium ${isCollapsed ? "px-2" : "px-3"}`}>
            {groups.map((group) => (
              <div key={group.id} className="grid gap-1">
                {!isCollapsed && (
                  <p className="px-3 pb-1 text-[11px] font-black uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
                    {group.title}
                  </p>
                )}
                {group.links.map(({ href, label, nepali, icon: Icon }) => {
                  const isActive = pathname === href;
                  return (
                    <Link
                      key={`${group.id}-${href}`}
                      href={href}
                      title={isCollapsed ? `${label} · ${nepali}` : undefined}
                      className={`flex items-center gap-3 rounded-md px-3 py-2 transition-all duration-200 ${
                        isActive
                          ? "bg-admin-primary/10 text-admin-primary dark:bg-admin-primary/20 dark:text-admin-primary-light border-l-4 border-admin-primary"
                          : "text-gray-600 hover:text-gray-900 hover:bg-admin-hover dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-admin-hover-dark"
                      } ${isCollapsed ? "justify-center" : ""}`}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {/* English name kept as the heading — it is what the owner
                          has already learned to look for — with the Nepali
                          underneath for anyone reading the menu for the first
                          time. */}
                      {!isCollapsed && (
                        <span className="grid leading-tight">
                          <span className="text-sm">{label}</span>
                          <span className="text-[11px] text-gray-400 dark:text-gray-500">{nepali}</span>
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Logout Button */}
        <div className="border-t border-admin-border px-3 py-3 dark:border-admin-border-dark">
          <form action={logoutAdminAction} className="w-full">
            <button
              type="submit"
              title={isCollapsed ? "Sign out" : undefined}
              className={`w-full flex items-center justify-center gap-2 rounded-md border border-admin-border bg-white px-3 py-2 text-sm font-semibold text-red-600 transition-all hover:bg-red-50 hover:border-red-200 dark:border-admin-border-dark dark:bg-admin-sidebar-dark dark:text-red-400 dark:hover:bg-red-950/20 ${
                isCollapsed ? "p-2" : ""
              }`}
            >
              <LogOutIcon className="h-4 w-4" />
              {!isCollapsed && <span>Sign out</span>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
