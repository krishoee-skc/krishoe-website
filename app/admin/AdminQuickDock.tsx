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

export default function AdminQuickDock({ adminRole }: { adminRole: AdminRole }) {
  const pathname = usePathname();
  const { language } = useLanguage();
  const roleLinks = adminRole === "Factory"
    ? [{ href: "/admin/factory", labelEn: "Factory", labelNe: "कारखाना", Icon: PackageIcon }]
    : links;
  const visibleLinks = roleLinks.filter((link) => canAccessAdminPath(adminRole, link.href));

  if (pathname === "/admin/login") return null;

  return (
    <>
      <div className="h-[calc(5.25rem+env(safe-area-inset-bottom))] lg:hidden print:hidden" aria-hidden />
      <nav
        aria-label="Admin quick actions"
        className="fixed inset-x-3 bottom-[calc(0.65rem+env(safe-area-inset-bottom))] z-40 rounded-[1.5rem] border border-white/80 bg-brand-paper/90 p-1.5 shadow-[0_18px_55px_rgba(16,35,29,0.2)] backdrop-blur-xl lg:hidden print:hidden"
      >
        <div
          className="mx-auto grid max-w-md gap-1"
          style={{ gridTemplateColumns: `repeat(${Math.max(1, visibleLinks.length)}, minmax(0, 1fr))` }}
        >
          {visibleLinks.map(({ href, labelEn, labelNe, Icon }) => {
            const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-black transition ${
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
        </div>
      </nav>
    </>
  );
}
