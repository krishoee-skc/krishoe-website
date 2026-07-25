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

const links = [
  { href: "/admin", label: "Home", Icon: HomeIcon },
  { href: "/admin/pos", label: "POS", Icon: CreditCardIcon },
  { href: "/admin/purchasing", label: "Buy", Icon: PackageIcon },
  { href: "/admin/hr", label: "HR", Icon: UserIcon },
  { href: "/admin/search", label: "Search", Icon: SearchIcon },
];

export default function AdminQuickDock() {
  const pathname = usePathname();

  if (pathname === "/admin/login") return null;

  return (
    <>
      <div className="h-[calc(5.25rem+env(safe-area-inset-bottom))] lg:hidden print:hidden" aria-hidden />
      <nav
        aria-label="Admin quick actions"
        className="fixed inset-x-3 bottom-[calc(0.65rem+env(safe-area-inset-bottom))] z-40 rounded-[1.5rem] border border-white/80 bg-white/90 p-1.5 shadow-[0_18px_55px_rgba(16,35,29,0.2)] backdrop-blur-xl lg:hidden print:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {links.map(({ href, label, Icon }) => {
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
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
