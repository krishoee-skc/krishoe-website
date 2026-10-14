"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAdminAction } from "@/app/admin/login/actions";
import { LogOutIcon, XIcon } from "@/components/Icons";
import LanguageSwitch from "@/components/LanguageSwitch";
import { useLanguage } from "@/components/LanguageProvider";
import ThemeToggle from "@/components/ThemeToggle";
import AdminIdentityCard from "@/components/admin/AdminIdentityCard";
import AdminTextSize from "@/components/admin/AdminTextSize";
import { useSidebar } from "@/components/admin/SidebarProvider";
import { type AdminRole } from "@/lib/admin-role-permissions";

/**
 * Who is signed in, and how the admin looks to them (owner, 2026-10-14, the
 * menu sample): the identity card and branch chooser, the text size, the
 * language, light or dark, and on a computer a full or a narrow menu. It sat
 * as a card at the top of the sidebar all day, taking a menu row's room for
 * something read once; now it waits behind the round initials.
 */
export type AdminIdentity = {
  adminRole: AdminRole;
  adminName?: string;
  adminEmail?: string;
  branchId?: string;
  branchName?: string;
  branchType?: string;
  seesAllBranches?: boolean;
  branchCount?: number;
  branchSwitch?: React.ReactNode;
};

/** The round mark: the first letters of the name, or of the role. */
export function initialsOf(name: string | undefined, role: string) {
  const words = (name?.trim() || role).split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "•";
}

export function AdminAvatar({ identity, className = "h-11 w-11 text-sm" }: { identity: AdminIdentity; className?: string }) {
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full border-2 border-admin-accent bg-gradient-to-br from-brand-green to-brand-green-ink font-black text-admin-accent-light ${className}`}>
      {initialsOf(identity.adminName, identity.adminRole)}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm font-black text-brand-muted dark:text-white/70">{label}</span>
      {children}
    </div>
  );
}

/** The settings rows; the caller adds its own sign-out at the foot. */
export function AdminAccountPanel({
  identity,
  showMenuStyle = false,
  children,
}: {
  identity: AdminIdentity;
  showMenuStyle?: boolean;
  children?: React.ReactNode;
}) {
  const { text } = useLanguage();
  const { isCollapsed, toggleSidebar } = useSidebar();

  return (
    <div className="grid gap-3">
      <AdminIdentityCard {...identity} />
      <Row label={text("Text size", "अक्षर")}>
        <AdminTextSize />
      </Row>
      <Row label={text("Language", "भाषा")}>
        <LanguageSwitch compact />
      </Row>
      <Row label={text("Light or dark", "उज्यालो वा अँध्यारो")}>
        <ThemeToggle />
      </Row>
      {showMenuStyle ? (
        <Row label={text("Menu", "मेनु")}>
          <div className="flex overflow-hidden rounded-xl border border-brand-green-line" role="group" aria-label={text("Menu", "मेनु")}>
            {[
              { collapsed: false, en: "Full", ne: "पूरा" },
              { collapsed: true, en: "Icons", ne: "सानो" },
            ].map((option) => (
              <button
                key={option.en}
                type="button"
                aria-pressed={isCollapsed === option.collapsed}
                onClick={() => {
                  if (isCollapsed !== option.collapsed) toggleSidebar();
                }}
                className={`min-h-11 px-3 text-sm font-black ${isCollapsed === option.collapsed ? "bg-brand-green text-white" : "bg-brand-paper text-brand-green-ink"}`}
              >
                {text(option.en, option.ne)}
              </button>
            ))}
          </div>
        </Row>
      ) : null}
      {children}
    </div>
  );
}

/**
 * The phone's round initials in the top bar, and the sheet they open from the
 * bottom, where the thumb is.
 */
export function AdminProfileButton({ identity }: { identity: AdminIdentity }) {
  const { text } = useLanguage();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-label={text("Your account and settings", "तपाईंको खाता र सेटिङ")}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
      >
        <AdminAvatar identity={identity} className="h-10 w-10 text-sm" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-[60]">
          <button type="button" aria-label={text("Close", "बन्द")} onClick={() => setOpen(false)} className="absolute inset-0 bg-brand-green-ink/45 backdrop-blur-sm" />
          <div
            role="dialog"
            aria-label={text("Your account and settings", "तपाईंको खाता र सेटिङ")}
            className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-brand-paper px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 shadow-2xl"
          >
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-brand-green-line" aria-hidden="true" />
            <div className="mb-2 flex items-center justify-between">
              <p className="text-lg font-black text-brand-green-ink">{text("You and the look", "तपाईं र देखावट")}</p>
              <button type="button" onClick={() => setOpen(false)} aria-label={text("Close", "बन्द")} className="grid h-11 w-11 place-items-center rounded-full text-brand-muted">
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <AdminAccountPanel identity={identity}>
              <form action={logoutAdminAction}>
                <button type="submit" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-brand-clay/40 text-base font-black text-brand-clay">
                  <LogOutIcon className="h-4 w-4" />
                  {text("Sign out", "बाहिर निस्कने")}
                </button>
              </form>
            </AdminAccountPanel>
          </div>
        </div>
      ) : null}
    </>
  );
}
