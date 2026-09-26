"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { usePathname } from "next/navigation";
import {
  CreditCardIcon,
  HomeIcon,
  InfoIcon,
  PackageIcon,
  PlusIcon,
  UserIcon,
} from "@/components/Icons";

/**
 * One name per screen, in the words the factory already uses.
 *
 * These are the owner's own words, taken from the search index and the home
 * board — "काम टिप्ने", not "Add work". The menu here said the English while
 * every other way into the same screen said the Nepali, so the one thing the
 * factory does most had two names depending on which door you came through.
 * The English is kept beside it, quietly, for the staff who learned the screens
 * that way.
 */
export const factoryLinks = [
  { href: "/admin/factory", label: "कारखाना", english: "Overview", Icon: HomeIcon },
  { href: "/admin/factory/add-work", label: "काम टिप्ने", english: "Add work", Icon: PlusIcon },
  { href: "/admin/factory/workers", label: "कामदार", english: "Workers", Icon: UserIcon },
  { href: "/admin/factory/worker-portal-qr", label: "QR पोस्टर", english: "Worker QR", Icon: UserIcon },
  { href: "/admin/factory/items", label: "item र दर", english: "Items", Icon: PackageIcon },
  { href: "/admin/factory/ledger", label: "कामदारको खाता", english: "Piece ledger", Icon: CreditCardIcon },
  { href: "/admin/factory/reports", label: "रिपोर्ट", english: "Reports", Icon: InfoIcon },
  { href: "/admin/factory/salary", label: "तलब", english: "Staff salary", Icon: PackageIcon },
] as const;

export default function FactoryNav() {
  const pathname = usePathname();
  const { text } = useLanguage();

  return (
    // On a phone: the row of sections only, and it scrolls away with the page.
    // Sticky with its title row it was 121px under a 57px top bar and above a
    // 94px dock — 41% of a small phone, before the form began — and its title
    // and maroon "Add work" repeated the band above and the dock below.
    // On a computer too, since 2026-09-26: the owner found the "K · Factory"
    // title row and its "Add work" button said again what the green chip and
    // the "काम टिप्ने" chip in this row already say.
    <header className="z-30 border-b border-brand-gold-bright/20 bg-brand-paper/95 shadow-[0_10px_35px_rgba(16,35,29,0.06)] backdrop-blur-xl lg:sticky lg:top-0 print:hidden">
      <div className="mx-auto w-full max-w-[1600px] px-3 py-2.5 sm:px-5">
        <nav
          aria-label="Factory sections"
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {factoryLinks.map(({ href, label, english, Icon }) => {
            const active =
              href === "/admin/factory" ? pathname === href : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 text-xs font-black transition sm:text-sm ${
                  active
                    ? "border-brand-green bg-brand-green text-white shadow-[0_7px_18px_rgba(11,77,59,0.2)]"
                    : "border-black/10 bg-brand-paper text-brand-muted-deep hover:border-brand-green/40 hover:bg-brand-green-wash hover:text-brand-green"
                }`}
              >
                <Icon className="h-4 w-4" />
                {text(english, label)}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
