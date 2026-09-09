"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * Four pages instead of one long scroll.
 *
 * Wages & kharcha was eighteen sections on a single page — six CSV buttons,
 * four summary cards, an audit board, and eleven forms, in the order they were
 * built rather than the order they are used. The three things needed daily sat
 * below five forms that have never been used once (Work Orders, handovers,
 * QC postings, material recipes and cost cards are all empty), so paying
 * workers on Saturday meant scrolling past every one of them.
 *
 * The factory side already reads well this way: a small nav across the top and
 * one job per page. This is the same shape, named for the work rather than for
 * the tables — the owner opens "Payments" on Saturday, not "worker_payments".
 */

const links = [
  { href: "/admin/operations/production-accounts", en: "This week", ne: "हप्ता" },
  { href: "/admin/operations/production-accounts/payments", en: "Payments", ne: "भुक्तानी" },
  { href: "/admin/operations/production-accounts/rates", en: "Wage rates", ne: "दर" },
  { href: "/admin/operations/production-accounts/lots", en: "Lots & cost", ne: "लट र लागत" },
] as const;

export default function WagesNav() {
  const pathname = usePathname();
  const { text } = useLanguage();

  return (
    <nav aria-label={text("Wages sections", "ज्यालाका भाग")} className="flex flex-wrap gap-2">
      {links.map((link) => {
        // The week page is the parent path, so it would match every child
        // without an exact test.
        const active =
          link.href === "/admin/operations/production-accounts"
            ? pathname === link.href
            : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-10 items-center rounded-full px-4 text-xs font-black transition ${
              active
                ? "bg-brand-green text-white shadow-[0_6px_16px_rgba(18,99,74,0.22)]"
                : "border border-brand-green-line bg-brand-paper text-brand-green-ink hover:border-brand-green"
            }`}
          >
            {text(link.en, link.ne)}
          </Link>
        );
      })}
    </nav>
  );
}
