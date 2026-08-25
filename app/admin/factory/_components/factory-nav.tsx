"use client";

import Link from "next/link";
import LanguageSwitch from "@/components/LanguageSwitch";
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
const factoryLinks = [
  { href: "/admin/factory", label: "कारखाना", english: "Overview", Icon: HomeIcon },
  { href: "/admin/factory/add-work", label: "काम टिप्ने", english: "Add work", Icon: PlusIcon },
  { href: "/admin/factory/workers", label: "कामदार", english: "Workers", Icon: UserIcon },
  { href: "/admin/factory/items", label: "item र दर", english: "Items", Icon: PackageIcon },
  { href: "/admin/factory/ledger", label: "कामदारको खाता", english: "Piece ledger", Icon: CreditCardIcon },
  { href: "/admin/factory/reports", label: "रिपोर्ट", english: "Reports", Icon: InfoIcon },
  { href: "/admin/factory/salary", label: "तलब", english: "Staff salary", Icon: PackageIcon },
] as const;

export default function FactoryNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-30 border-b border-brand-gold-bright/20 bg-brand-paper/95 shadow-[0_10px_35px_rgba(16,35,29,0.06)] backdrop-blur-xl lg:top-0 print:hidden">
      <div className="mx-auto w-full max-w-[1600px] px-3 py-2.5 sm:px-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-maroon text-sm font-black text-white shadow-[0_8px_18px_rgba(104,30,35,0.22)]">
              K
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-brand-green-ink sm:text-base">
                कारखाना
              </p>
              <p className="hidden truncate text-xs text-brand-muted-deep sm:block">
                उत्पादन, ज्याला र तलब · Production, piece wages and staff salary
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitch />
          <Link
            href="/admin/factory/add-work"
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-brand-maroon px-3.5 text-xs font-black text-white shadow-[0_8px_20px_rgba(104,30,35,0.18)] transition hover:-translate-y-0.5 hover:bg-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-bright"
          >
            <PlusIcon className="h-4 w-4" />
            काम टिप्ने
          </Link>
          </div>
        </div>

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
                {label}
                <span
                  className={`hidden text-[11px] font-semibold lg:inline ${
                    active ? "text-white/70" : "text-brand-muted"
                  }`}
                >
                  {english}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
