"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { OPEN_ADMIN_MENU } from "@/app/admin/AdminQuickDock";
import { OPEN_SEARCH_EVENT } from "@/app/admin/AdminCommandBar";
import { logoutAdminAction } from "@/app/admin/login/actions";
import { shortcutForPath, shortcutLink, togglePin, usePins, useRecent } from "@/app/admin/admin-shortcuts";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageSwitch from "@/components/LanguageSwitch";
import AdminTextSize from "@/components/admin/AdminTextSize";
import { SearchIcon } from "@/components/Icons";
import WorkspaceSwitch from "@/app/admin/WorkspaceSwitch";
import { useAdminWorkspace } from "@/app/admin/useAdminWorkspace";
import { useLanguage } from "@/components/LanguageProvider";
import { canAccessAdminPath, type AdminRole } from "@/lib/admin-role-permissions";
import { adminNavTone, adminNavToneClasses } from "@/app/admin/nav-links";

/**
 * The phone's whole menu, from the bottom (owner, 2026-10-14, the menu sample).
 *
 * The dock's "More" sits under the thumb, and the menu used to drop from the
 * top of the screen, under a bar of its own — the thumb pressed at the bottom
 * and then reached for the top. It now rises from where it was pressed: search
 * first, the ★ favourites and the screens opened lately, then the two sides'
 * pages as tiles, and the look and Sign out at the foot. The phone's top bar
 * itself is the shared one in the layout.
 */
export default function AdminMobileNav({
  counts,
  adminRole,
}: {
  /** How many things wait behind a link (workers' photos), as a number. */
  counts?: Record<string, number>;
  adminRole: AdminRole;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // The thumb bar's "More" opens this menu.
  useEffect(() => {
    const openMenu = () => setOpen(true);
    window.addEventListener(OPEN_ADMIN_MENU, openMenu);
    return () => window.removeEventListener(OPEN_ADMIN_MENU, openMenu);
  }, []);
  const [lastPath, setLastPath] = useState(pathname);
  const { workspace, chooseWorkspace, groups } = useAdminWorkspace(adminRole, pathname);
  const { language, text } = useLanguage();
  const pins = usePins().filter((href) => canAccessAdminPath(adminRole, href));
  const recent = useRecent().filter((href) => canAccessAdminPath(adminRole, href));
  const here = shortcutForPath(pathname);

  // Close the menu whenever the route changes, so tapping a link doesn't leave
  // the sheet hanging open over the new page. Done as a render-time state
  // adjustment (React's sanctioned pattern) rather than an effect.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!open) return null;

  const name = (href: string) => {
    const link = shortcutLink(href);
    return link ? (language === "ne" ? link.nepali : link.label) : href;
  };
  const chip = "inline-flex min-h-11 shrink-0 items-center rounded-full border px-3.5 text-sm font-black";
  const footButton = "grid h-11 w-full place-items-center rounded-xl border border-brand-green-line bg-brand-paper px-1 text-sm font-black text-brand-green-ink";

  return (
    <div data-admin-chrome className="fixed inset-0 z-50 md:hidden print:hidden">
      <button
        type="button"
        aria-label={text("Close the menu", "मेनु बन्द गर्ने")}
        className="absolute inset-0 bg-brand-green-ink/45 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <nav
        aria-label="Admin"
        className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-3xl border-t border-brand-green-line bg-brand-paper px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 shadow-2xl"
      >
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-brand-green-line" aria-hidden="true" />
        <div className="mb-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              window.dispatchEvent(new CustomEvent(OPEN_SEARCH_EVENT, { detail: { q: "" } }));
            }}
            className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-brand-green-line bg-brand-paper px-3.5 text-left text-brand-muted"
          >
            <SearchIcon className="h-5 w-5 shrink-0 text-brand-green" />
            <span className="truncate text-sm font-semibold">{text("Find a page, shoe or customer…", "पाना, जुत्ता, ग्राहक खोज्नुहोस्…")}</span>
          </button>
        </div>

        {/* ★ Favourites, and a ☆ for the screen that is open. */}
        <p className="px-1 pb-1.5 pt-1 text-xs font-black uppercase tracking-[0.14em] text-brand-gold-deep">★ {text("Favourites", "मनपर्ने")}</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {pins.map((href) => (
            <Link key={`pin-${href}`} href={href} className={`${chip} border-brand-gold/40 bg-brand-gold-wash text-brand-green-ink dark:text-white`}>
              ★ {name(href)}
            </Link>
          ))}
          {here ? (
            <button type="button" onClick={() => togglePin(here.href)} className={`${chip} border-dashed border-brand-green-line text-brand-muted`}>
              {pins.includes(here.href) ? text("★ Remove", "★ हटाउने") : text("☆ Add", "☆ थप्ने")}
            </button>
          ) : null}
        </div>

        {recent.length > 0 ? (
          <>
            <p className="px-1 pb-1.5 pt-2 text-xs font-black uppercase tracking-[0.14em] text-brand-muted-soft">{text("Opened lately", "हालै खोलेका")}</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
              {recent.map((href) => (
                <Link key={`recent-${href}`} href={href} className={`${chip} border-brand-green-line bg-brand-paper text-brand-green-ink`}>
                  {name(href)}
                </Link>
              ))}
            </div>
          </>
        ) : null}

        <div className="mt-3">
          <WorkspaceSwitch workspace={workspace} onChoose={chooseWorkspace} />
        </div>

        {/* Every page of the side on show, in one grid of tiles, as the sample
            draws it; the colour of each icon still says which part it is. */}
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {groups.map((group) =>
          group.links.map(({ href, label, nepali, icon: Icon }) => {
            const active = pathname === href;
            const waiting = counts?.[href] ?? 0;
            return (
              <Link
                key={`${group.id}-${href}`}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-[5.25rem] flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 py-2 text-center text-sm font-black leading-tight transition ${
                  active
                    ? "border-brand-green bg-brand-green-wash text-brand-green"
                    : "border-transparent bg-brand-mist text-brand-green-ink"
                }`}
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                    adminNavToneClasses[adminNavTone(group.id)][active ? "active" : "tile"]
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span>{language === "ne" ? nepali : label}</span>
                {waiting > 0 ? (
                  <span className="absolute right-1.5 top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand-clay px-1 text-xs font-black text-white">
                    {waiting > 99 ? "99+" : waiting}
                  </span>
                ) : null}
              </Link>
            );
          }),
          )}
        </div>

        {/* The look and Sign out, at the foot where the thumb already is. */}
        {/* Four equal buttons, as the sample draws them: अ अक्षर · नेपाली · 🌙 · बाहिर. */}
        <div className="mt-4 grid grid-cols-4 gap-1.5 border-t border-brand-green-line pt-3">
          <AdminTextSize single className={footButton}>{text("Aa size", "अ अक्षर")}</AdminTextSize>
          <LanguageSwitch single className="w-full justify-center px-1" />
          <ThemeToggle className={footButton} />
          <form action={logoutAdminAction}>
            <button type="submit" className={`${footButton} w-full text-brand-clay`}>
              {text("Sign out", "बाहिर")}
            </button>
          </form>
        </div>
      </nav>
    </div>
  );
}
