"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCardIcon,
  HomeIcon,
  InfoIcon,
  PackageIcon,
  PlusIcon,
  UserIcon,
} from "@/components/Icons";

const factoryLinks = [
  { href: "/admin/factory", label: "Overview", Icon: HomeIcon },
  { href: "/admin/factory/add-work", label: "Add work", Icon: PlusIcon },
  { href: "/admin/factory/workers", label: "Workers", Icon: UserIcon },
  { href: "/admin/factory/ledger", label: "Piece ledger", Icon: CreditCardIcon },
  { href: "/admin/factory/reports", label: "Reports", Icon: InfoIcon },
  { href: "/admin/factory/salary", label: "Staff salary", Icon: PackageIcon },
] as const;

export default function FactoryNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-30 border-b border-brand-gold-bright/20 bg-white/95 shadow-[0_10px_35px_rgba(16,35,29,0.06)] backdrop-blur-xl lg:top-0 print:hidden">
      <div className="mx-auto w-full max-w-[1600px] px-3 py-2.5 sm:px-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-maroon text-sm font-black text-white shadow-[0_8px_18px_rgba(104,30,35,0.22)]">
              K
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-brand-green-ink sm:text-base">
                Factory workspace
              </p>
              <p className="hidden truncate text-xs text-brand-muted-deep sm:block">
                Production, piece wages and staff salary
              </p>
            </div>
          </div>

          <Link
            href="/admin/factory/add-work"
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-brand-maroon px-3.5 text-xs font-black text-white shadow-[0_8px_20px_rgba(104,30,35,0.18)] transition hover:-translate-y-0.5 hover:bg-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-bright"
          >
            <PlusIcon className="h-4 w-4" />
            Quick entry
          </Link>
        </div>

        <nav
          aria-label="Factory sections"
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {factoryLinks.map(({ href, label, Icon }) => {
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
                    : "border-black/10 bg-white text-brand-muted-deep hover:border-brand-green/40 hover:bg-brand-green-wash hover:text-brand-green"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
