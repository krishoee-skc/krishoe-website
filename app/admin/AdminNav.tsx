"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAdminAction } from "@/app/admin/login/actions";
import { ChevronLeftIcon, ChevronRightIcon, LogOutIcon } from "@/components/Icons";
import { useSidebar } from "@/components/admin/SidebarProvider";
import WorkspaceSwitch from "@/app/admin/WorkspaceSwitch";
import { useAdminWorkspace } from "@/app/admin/useAdminWorkspace";
import { useLanguage } from "@/components/LanguageProvider";
import { TABLET_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { canAccessAdminPath, type AdminRole } from "@/lib/admin-role-permissions";
import type { AttentionLevel } from "@/app/admin/nav-attention";
import { adminNavGroups, adminNavTone, adminNavToneClasses, type AdminNavLink, type AdminNavTone } from "@/app/admin/nav-links";
import { shortcutLink, usePins } from "@/app/admin/admin-shortcuts";
import { AdminAccountPanel, AdminAvatar, type AdminIdentity } from "@/app/admin/AdminAccount";
import { useEffect, useRef, useState } from "react";

export default function AdminNav({
  attention,
  counts,
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
  /** How many things wait behind a link, shown as a number (workers' photos). */
  counts?: Record<string, number>;
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
  const pins = usePins();
  const pinnedLinks = pins.flatMap((href): Array<{ link: AdminNavLink; tone: AdminNavTone }> => {
    const link = shortcutLink(href);
    if (!link || !canAccessAdminPath(adminRole, href)) return [];
    const group = adminNavGroups.find((candidate) => candidate.links.some((entry) => entry.href === href));
    return [{ link, tone: adminNavTone(group?.id ?? "everywhere") }];
  });
  const identity: AdminIdentity = { adminRole, adminName, adminEmail, branchId, branchName, branchType, seesAllBranches, branchCount, branchSwitch };
  const [accountOpen, setAccountOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const accountBox = useRef<HTMLDivElement>(null);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setAccountOpen(false);
  }
  useEffect(() => {
    if (!accountOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountOpen(false);
    };
    const onDown = (event: PointerEvent) => {
      if (accountBox.current && !accountBox.current.contains(event.target as Node)) setAccountOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [accountOpen]);

  return (
    <div data-admin-chrome className={`hidden overflow-hidden border-r border-admin-border bg-admin-sidebar transition-all duration-300 md:sticky md:top-0 md:h-dvh md:self-start md:block md:w-20 lg:overflow-visible print:hidden dark:border-admin-border-dark dark:bg-admin-sidebar-dark ${chosenCollapsed ? "lg:w-20" : "lg:w-[240px]"}`}>
      {/* The menu stays on screen (owner, 2026-10-01): it used to scroll away
          with a long page, leaving a blank strip under Sign out and sending
          him back to the top to open another page. The sidebar is sticky and
          the full height of the screen; the names scroll inside it. */}
      <div className="flex h-full flex-col gap-0">
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

        {/* The identity card that sat here (role, branch, chooser) moved to
            the round initials at the foot (owner, 2026-10-14): it took a menu
            row's room all day for something read once. */}

        {/* Which half of the business this menu is showing. */}
        <div className={`border-b border-admin-border pb-2.5 pt-2.5 dark:border-admin-border-dark ${isCollapsed ? "px-2" : "px-3"}`}>
          <WorkspaceSwitch
            workspace={workspace}
            onChoose={chooseWorkspace}
            compact={isCollapsed}
          />
        </div>

        {/* ★ Favourites (owner, 2026-10-14): the screens this person pinned with
            the ☆ beside a page's name, above the groups, on whichever side. */}
        {pinnedLinks.length > 0 ? (
          <div className={`border-b border-admin-border py-2 dark:border-admin-border-dark ${isCollapsed ? "px-2" : "px-3"}`}>
            {!isCollapsed && (
              <p className="px-3 pb-0.5 text-xs font-black uppercase tracking-[0.14em] text-brand-gold-deep dark:text-[#E8C467]">
                ★ {text("Favourites", "मनपर्ने")}
              </p>
            )}
            <div className="grid gap-0.5">
              {pinnedLinks.map(({ link, tone }) => {
                const isActive = pathname === link.href;
                const Icon = link.icon;
                return (
                  <Link
                    key={`pin-${link.href}`}
                    href={link.href}
                    title={isCollapsed ? text(link.label, `${link.nepali} · ${link.label}`) : undefined}
                    className={`flex min-h-10 items-center gap-3 rounded-md px-2 py-0.5 font-bold transition-all duration-200 ${
                      isActive
                        ? "bg-admin-primary/10 text-admin-primary dark:bg-admin-primary/20 dark:text-admin-primary-light"
                        : "text-brand-green-ink hover:bg-admin-hover dark:text-white/85 dark:hover:bg-admin-hover-dark"
                    } ${isCollapsed ? "justify-center" : ""}`}
                  >
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] ${adminNavToneClasses[tone][isActive ? "active" : "tile"]}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    {!isCollapsed && <span className="truncate text-[1.0625rem]">{language === "ne" ? link.nepali : link.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Navigation Links */}
        {/* Bigger, darker, closer rows (owner, 2026-09-29): 19px names in the
            ink colour, rows about 40px apart. With the one-line card above,
            all eleven pages fit without scrolling this box on his screen. */}
        <div className="flex-1 overflow-auto py-2.5">
          <nav className={`grid items-start gap-3 ${isCollapsed ? "px-2" : "px-3"}`}>
            {groups.map((group) => (
              <div key={group.id} className="grid gap-0.5">
                {!isCollapsed && (
                  <p className="px-3 pb-0.5 text-xs font-black uppercase tracking-[0.14em] text-brand-muted-soft dark:text-white/60">
                    {text(group.titleEn, group.titleNe)}
                  </p>
                )}
                {group.links.map(({ href, label, nepali, icon: Icon }) => {
                  const isActive = pathname === href;
                  const needs = attention?.get(href);
                  const waiting = counts?.[href] ?? 0;
                  return (
                    <Link
                      key={`${group.id}-${href}`}
                      href={href}
                      title={isCollapsed ? text(label, `${nepali} · ${label}`) : undefined}
                      className={`flex min-h-10 items-center gap-3 rounded-md px-2 py-0.5 font-bold transition-all duration-200 ${
                        isActive
                          ? "bg-admin-primary/10 text-admin-primary dark:bg-admin-primary/20 dark:text-admin-primary-light border-l-4 border-admin-accent"
                          : "text-brand-green-ink hover:bg-admin-hover dark:text-white/85 dark:hover:text-white dark:hover:bg-admin-hover-dark"
                      } ${isCollapsed ? "justify-center" : ""}`}
                    >
                      {/* The icon carries the dot when this screen wants
                          looking at, so the mark survives the collapsed menu
                          where the label is gone. */}
                      {/* The group's colour on a soft tile, filled for the
                          page that is open, so a narrow menu of icons alone
                          still says which part of the business each is. */}
                      <span
                        className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-[10px] transition-colors ${
                          adminNavToneClasses[adminNavTone(group.id)][isActive ? "active" : "tile"]
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        {waiting > 0 && isCollapsed ? (
                          <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-brand-clay px-1 text-center text-xs font-black leading-5 text-white ring-2 ring-admin-sidebar dark:ring-admin-sidebar-dark">
                            {waiting > 99 ? "99+" : waiting}
                          </span>
                        ) : needs ? (
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
                          <span className="text-[1.1875rem]">{language === "ne" ? nepali : label}</span>
                          {language === "ne" ? (
                            <span className="text-xs font-semibold text-brand-muted-soft dark:text-white/60">
                              {label}
                            </span>
                          ) : null}
                        </span>
                      )}
                      {waiting > 0 && !isCollapsed ? (
                        <span className="ml-auto rounded-full bg-brand-clay px-2 py-0.5 text-sm font-black leading-5 text-white">
                          {waiting > 99 ? "99+" : waiting}
                        </span>
                      ) : null}
                      {waiting > 0 ? <span className="sr-only">{text(`${waiting} waiting`, `${waiting} बाँकी`)}</span> : null}
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
          {/* A soft fade at the foot says more names wait below, where the
              browser's own small arrow was the only sign. */}
          <div aria-hidden="true" className="pointer-events-none sticky -bottom-2.5 -mt-6 h-6 bg-gradient-to-t from-admin-sidebar to-transparent dark:from-admin-sidebar-dark" />
        </div>

        {/* You, at the foot (owner, 2026-10-14, the menu sample): the round
            initials, the role and the branch on one quiet row. Pressed, it
            opens who is signed in, the branch chooser, the text size, the
            language, light or dark, a full or narrow menu — and Sign out.
            Fixed to the screen rather than the rail, so a narrow menu does
            not clip it. */}
        <div ref={accountBox} className="border-t border-admin-border px-2 py-1.5 dark:border-admin-border-dark">
          {accountOpen ? (
            <div
              role="dialog"
              aria-label={text("Your account and settings", "तपाईंको खाता र सेटिङ")}
              className={`fixed bottom-3 z-50 max-h-[85vh] w-80 overflow-y-auto rounded-2xl border border-brand-green-line bg-brand-paper p-3 shadow-2xl dark:bg-admin-sidebar-dark ${isCollapsed ? "left-[5.5rem]" : "left-[15.5rem]"}`}
            >
              <AdminAccountPanel identity={identity} showMenuStyle={!onTablet}>
                {/* Sign out.
                    A quiet row rather than a button: it used to be a bordered
                    slab costing a whole menu row to the one action nobody comes
                    here to perform. It reads at the weight of a caption and only
                    turns red when pointed at; min-h-11 keeps it 44px to hit. */}
                <form action={logoutAdminAction} className="w-full">
                  <button
                    type="submit"
                    className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-sm font-bold text-brand-muted transition hover:bg-red-50 hover:text-red-600 dark:text-white/60 dark:hover:bg-red-950/20 dark:hover:text-red-400"
                  >
                    <LogOutIcon className="h-4 w-4 shrink-0" />
                    <span>{text("Sign out", "बाहिर निस्कने")}</span>
                  </button>
                </form>
              </AdminAccountPanel>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setAccountOpen((value) => !value)}
            aria-expanded={accountOpen}
            aria-label={text("Your account and settings", "तपाईंको खाता र सेटिङ")}
            title={isCollapsed ? text("Your account and settings", "तपाईंको खाता र सेटिङ") : undefined}
            className={`flex min-h-12 w-full items-center gap-2.5 rounded-md px-1.5 text-left transition hover:bg-admin-hover dark:hover:bg-admin-hover-dark ${isCollapsed ? "justify-center" : ""}`}
          >
            <AdminAvatar identity={identity} className="h-9 w-9 text-xs" />
            {!isCollapsed && (
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate text-sm font-black text-brand-green-ink dark:text-white">
                  {adminRole}{adminRole === "Owner" ? " 👑" : ""}
                </span>
                <span className="truncate text-xs font-semibold text-brand-muted dark:text-white/60">
                  {seesAllBranches ? text("All branches", "सबै शाखा") : branchName || branchId || ""}
                </span>
              </span>
            )}
            {!isCollapsed && <span aria-hidden="true" className="text-lg font-black text-brand-muted-soft">⋯</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
