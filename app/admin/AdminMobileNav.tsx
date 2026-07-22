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

  // Close the menu whenever the route changes, so tapping a link doesn't leave
  // the sheet hanging open over the new page.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur lg:hidden print:hidden">
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
        <nav
          aria-label="Admin"
          className="max-h-[70vh] overflow-auto border-t border-gray-100 px-3 pb-3 pt-2"
        >
          <div className="grid grid-cols-2 gap-2">
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
      ) : null}
    </div>
  );
}
