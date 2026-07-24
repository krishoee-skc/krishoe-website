"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAdminAction } from "@/app/admin/login/actions";
import ThemeToggle from "@/components/ThemeToggle";
import { HomeIcon, MenuIcon, XIcon } from "@/components/Icons";
import { adminNavLinks } from "@/app/admin/nav-links";

// Phone navigation for the admin. The desktop sidebar is `hidden lg:block`, so
// below 1024px there was no way to move between pages or get home — a real
// problem because the owner runs the shop from a phone. This sticky top bar
// gives a permanent home link and a full menu one tap away, and hides on
// desktop (lg:) where the sidebar takes over, and on paper (print:).
export default function AdminMobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

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

  return (
    <div className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden print:hidden">
      <div className="flex h-14 items-center justify-between gap-2 px-4">
        <Link href="/admin" className="flex items-center gap-2 font-black text-brand-green-ink">
          <HomeIcon className="h-5 w-5" />
          KRISHOE Admin
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="grid h-11 w-11 place-items-center rounded-lg border border-gray-200 text-brand-green-ink transition hover:border-brand-green"
          >
            {open ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-x-0 bottom-0 top-[calc(3.5rem+env(safe-area-inset-top))] z-50 bg-brand-green-ink/45 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Close admin menu overlay"
            className="absolute inset-0"
            onClick={() => setOpen(false)}
          />
          <nav
            aria-label="Admin"
            className="absolute inset-x-0 top-0 max-h-[min(82vh,720px)] overflow-y-auto rounded-b-2xl border-t border-gray-100 bg-white px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl"
          >
          <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
            {adminNavLinks.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2 text-sm font-bold transition ${
                    active
                      ? "border-brand-green bg-brand-green-wash text-brand-green"
                      : "border-gray-200 text-brand-green-ink hover:border-brand-green"
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </div>

          <form action={logoutAdminAction} className="mt-3">
            <button
              type="submit"
              className="flex min-h-12 w-full items-center justify-center rounded-lg border border-gray-200 px-3 text-sm font-bold text-brand-clay transition hover:border-brand-clay hover:bg-red-50"
            >
              Sign out
            </button>
          </form>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
