"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCardIcon,
  HomeIcon,
  PackageIcon,
  SearchIcon,
  UserIcon,
} from "@/components/Icons";
import { canAccessAdminPath, type AdminRole } from "@/lib/admin-role-permissions";
import { useLanguage } from "@/components/LanguageProvider";
import { useKeyboardOpen } from "@/lib/use-keyboard-open";

/**
 * The jobs a thumb should reach without opening a menu.
 *
 * This used to be Home · POS · Buy · HR · Search. Purchasing and HR are not
 * daily work here — the shop has never recorded a purchase invoice, and the HR
 * module holds no attendance or payroll — while the two things done every day,
 * booking a worker's pairs and checking stock, were not on it at all.
 *
 * Labels are Nepali, because this bar is read at a glance while standing on the
 * factory floor.
 */
const links = [
  { href: "/admin", labelEn: "Home", labelNe: "घर", Icon: HomeIcon },
  { href: "/admin/factory/add-work", labelEn: "Add work", labelNe: "काम टिप्ने", Icon: UserIcon },
  { href: "/admin/pos", labelEn: "Bill", labelNe: "बिल", Icon: CreditCardIcon },
  { href: "/admin/stock", labelEn: "Stock", labelNe: "स्टक", Icon: PackageIcon },
  { href: "/admin/search", labelEn: "Search", labelNe: "खोज्ने", Icon: SearchIcon },
];

/**
 * "More" opens the whole menu from the bottom, where the thumb already is
 * (owner, 2026-10-01): the menu sat behind ☰ at the top of the screen.
 */
export const OPEN_ADMIN_MENU = "krishoe:open-admin-menu";

export default function AdminQuickDock({ adminRole }: { adminRole: AdminRole }) {
  const pathname = usePathname();
  const { language, text } = useLanguage();
  // Out of the way while typing: the dock sat between the keyboard and the
  // box being filled, on the screens where most typing happens.
  const keyboardOpen = useKeyboardOpen();
  const roleLinks = adminRole === "Factory"
    ? [{ href: "/admin/factory", labelEn: "Factory", labelNe: "कारखाना", Icon: PackageIcon }]
    : links;
  const visibleLinks = roleLinks.filter((link) => canAccessAdminPath(adminRole, link.href));

  if (pathname === "/admin/login") return null;

  return (
    <>
      <div data-admin-chrome className="h-[calc(5.25rem+env(safe-area-inset-bottom))] md:hidden print:hidden" aria-hidden />
      <nav
        data-admin-chrome
        aria-label="Admin quick actions"
        className={`fixed inset-x-3 bottom-[calc(0.65rem+env(safe-area-inset-bottom))] z-40 rounded-[1.5rem] border border-white/80 bg-brand-paper/90 p-1.5 shadow-[0_18px_55px_rgba(16,35,29,0.2)] backdrop-blur-xl transition-transform duration-200 md:hidden print:hidden ${keyboardOpen ? "translate-y-[150%]" : ""}`}
      >
        <div
          className="mx-auto grid max-w-md gap-1"
          style={{ gridTemplateColumns: `repeat(${visibleLinks.length + 1}, minmax(0, 1fr))` }}
        >
          {visibleLinks.map(({ href, labelEn, labelNe, Icon }) => {
            const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-black transition ${
                  active
                    ? "-translate-y-1 bg-brand-green text-white shadow-[0_10px_24px_rgba(11,77,59,0.25)]"
                    : "text-brand-muted-deep"
                }`}
              >
                <Icon className="h-5 w-5" />
                {language === "ne" ? labelNe : labelEn}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(OPEN_ADMIN_MENU))}
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-black text-brand-muted-deep"
          >
            <span aria-hidden="true" className="text-lg leading-5">☰</span>
            {text("More", "अरू")}
          </button>
        </div>
      </nav>
    </>
  );
}
