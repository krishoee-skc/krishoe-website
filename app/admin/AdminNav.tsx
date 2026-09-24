"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAdminAction } from "@/app/admin/login/actions";
import { ChevronLeftIcon, ChevronRightIcon, LogOutIcon } from "@/components/Icons";
import { useSidebar } from "@/components/admin/SidebarProvider";
import AdminIdentityCard from "@/components/admin/AdminIdentityCard";
import WorkspaceSwitch from "@/app/admin/WorkspaceSwitch";
import { useAdminWorkspace } from "@/app/admin/useAdminWorkspace";
import { useLanguage } from "@/components/LanguageProvider";
import { TABLET_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { type AdminRole } from "@/lib/admin-role-permissions";
import type { AttentionLevel } from "@/app/admin/nav-attention";

export default function AdminNav({
  attention,
  adminRole,
  adminName,
  adminEmail,
  branchId,
  branchName,
  branchType,
  seesAllBranches,
  branchCount,
  branchSwitch,
}: {
  /** Which links the shop's own checks say want looking at. */
  attention?: Map<string, AttentionLevel>;
  adminRole: AdminRole;
  adminName?: string;
  adminEmail?: string;
  branchId?: string;
  branchName?: string;
  branchType?: string;
  seesAllBranches?: boolean;
  branchCount?: number;
  branchSwitch?: React.ReactNode;
}) {
  const pathname = usePathname();
  const { isCollapsed: chosenCollapsed, toggleSidebar } = useSidebar();
  // On a tablet the sidebar is a rail of icons, always. The phone's top bar
  // and bottom dock were drawn on a tablet too, wasting its width on a layout
  // made for a screen half the size; the full sidebar does not fit beside a
  // form at 768px. The rail does, and every screen stays one tap away.
  const onTablet = useMediaQuery(TABLET_QUERY);
  const isCollapsed = chosenCollapsed || onTablet;
  const { workspace, chooseWorkspace, groups } = useAdminWorkspace(adminRole, pathname);
  const { language, text } = useLanguage();

  return (
    <div className={`hidden overflow-hidden border-r border-admin-border bg-admin-sidebar transition-all duration-300 md:block md:w-20 lg:overflow-visible print:hidden dark:border-admin-border-dark dark:bg-admin-sidebar-dark ${chosenCollapsed ? "lg:w-20" : "lg:w-[240px]"}`}>
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
              <span className="truncate text-xl font-black tracking-wide text-brand-green-ink dark:text-white">
                KRISHOE
              </span>
            )}
          </Link>
          <button
            onClick={toggleSidebar}
            hidden={onTablet}
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
            <AdminIdentityCard
              adminRole={adminRole}
              adminName={adminName}
              adminEmail={adminEmail}
              branchId={branchId}
              branchName={branchName}
              branchType={branchType}
              seesAllBranches={seesAllBranches}
              branchCount={branchCount}
              branchSwitch={branchSwitch}
            />
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
          <nav className={`grid items-start gap-5 font-medium ${isCollapsed ? "px-2" : "px-3"}`}>
            {groups.map((group) => (
              <div key={group.id} className="grid gap-1.5">
                {!isCollapsed && (
                  <p className="px-3 pb-1 text-[11px] font-black uppercase tracking-[0.14em] text-brand-muted-soft dark:text-white/60">
                    {text(group.titleEn, group.titleNe)}
                  </p>
                )}
                {group.links.map(({ href, label, nepali, icon: Icon }) => {
                  const isActive = pathname === href;
                  const needs = attention?.get(href);
                  return (
                    <Link
                      key={`${group.id}-${href}`}
                      href={href}
                      title={isCollapsed ? text(label, `${nepali} · ${label}`) : undefined}
                      className={`flex items-center gap-3 rounded-md px-3 py-2 transition-all duration-200 ${
                        isActive
                          ? "bg-admin-primary/10 text-admin-primary dark:bg-admin-primary/20 dark:text-admin-primary-light border-l-4 border-admin-accent"
                          : "text-brand-muted hover:text-brand-green-ink hover:bg-admin-hover dark:text-white/60 dark:hover:text-white dark:hover:bg-admin-hover-dark"
                      } ${isCollapsed ? "justify-center" : ""}`}
                    >
                      {/* The icon carries the dot when this screen wants
                          looking at, so the mark survives the collapsed menu
                          where the label is gone. */}
                      <span className="relative shrink-0">
                        <Icon className="h-5 w-5" />
                        {needs ? (
                          <span
                            aria-hidden="true"
                            className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-admin-sidebar dark:ring-admin-sidebar-dark ${
                              needs === "critical"
                                ? "bg-brand-clay"
                                : needs === "warning"
                                  ? "bg-brand-gold-deep"
                                  : "bg-brand-green"
                            }`}
                          />
                        ) : null}
                      </span>
                      {/* On the Nepali side the Nepali name leads and the
                          English stays small underneath — the owner has learned
                          to look for "Factory Entry" and losing it would be a
                          downgrade. On the English side there is no Nepali at
                          all, which is the whole point of the switch. */}
                      {!isCollapsed && (
                        <span className="grid leading-tight">
                          <span className="text-sm">{language === "ne" ? nepali : label}</span>
                          {language === "ne" ? (
                            <span className="text-[11px] text-brand-muted-soft dark:text-white/60">
                              {label}
                            </span>
                          ) : null}
                        </span>
                      )}
                      {/* The dot is colour only. Said in words too, or the
                          app's one prompt to act is invisible to anyone not
                          reading colour. */}
                      {needs ? (
                        <span className="sr-only">
                          {text("Needs attention", "ध्यान दिनुपर्ने")}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* The language toggle now lives in the top row beside the search, so
            the shop's two words sit up top and the menu foot stays open. */}

        {/* Sign out.
            A quiet row rather than a button. It used to be a full-width
            bordered slab with padding above and below, costing about sixty
            pixels — a whole menu row — to the one action on this screen nobody
            comes here to perform. It keeps its place at the foot, where people
            look for it and where flex-1 above already pins it, but reads at the
            weight of a caption and only turns red when pointed at.

            min-h-11 so losing the slab does not make it harder to hit on a
            phone: 44px is the tap target the rest of the admin holds to. */}
        <div className="border-t border-admin-border px-3 py-1.5 dark:border-admin-border-dark">
          <form action={logoutAdminAction} className="w-full">
            <button
              type="submit"
              title={isCollapsed ? "Sign out" : undefined}
              className={`flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-xs font-bold text-brand-muted transition hover:bg-red-50 hover:text-red-600 dark:text-white/50 dark:hover:bg-red-950/20 dark:hover:text-red-400 ${
                isCollapsed ? "justify-center" : ""
              }`}
            >
              <LogOutIcon className="h-4 w-4 shrink-0" />
              {!isCollapsed && <span>Sign out</span>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
