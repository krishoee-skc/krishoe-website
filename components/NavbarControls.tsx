"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { HeartIcon, MenuIcon, ShoppingBagIcon, XIcon } from "@/components/Icons";
import { useCommerce } from "@/components/commerce/CommerceProvider";
import CommandSearch from "@/components/CommandSearch";
import { isActivePath, navLinks } from "@/components/nav-links";

type NavbarControlsProps = {
  isLoggedIn: boolean;
  isAdmin: boolean;
};

function CountBadge({ count }: { count: number }) {
  if (count === 0) {
    return null;
  }

  return (
    <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#D4AF37] px-1 text-[10px] font-black text-[#10231D]">
      {count}
    </span>
  );
}

export default function NavbarControls({ isLoggedIn, isAdmin }: NavbarControlsProps) {
  const pathname = usePathname();
  const { cartCount, wishlistCount } = useCommerce();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <CommandSearch />

      <Link
        href="/wishlist"
        aria-label="Open wishlist"
        className="relative grid h-10 w-10 place-items-center rounded-full border border-black/10 text-[#0B4D3B] transition hover:border-[#0B4D3B] hover:bg-[#F5F7F4]"
      >
        <HeartIcon className="h-5 w-5" />
        <CountBadge count={wishlistCount} />
      </Link>

      <Link
        href="/cart"
        aria-label="Open cart"
        className="relative grid h-10 w-10 place-items-center rounded-full border border-black/10 text-[#0B4D3B] transition hover:border-[#0B4D3B] hover:bg-[#F5F7F4]"
      >
        <ShoppingBagIcon className="h-5 w-5" />
        <CountBadge count={cartCount} />
      </Link>

      {isLoggedIn ? (
        <Link
          href={isAdmin ? "/admin" : "/account"}
          className="hidden h-10 items-center rounded-full bg-[#0B4D3B] px-5 text-sm font-semibold text-white transition hover:bg-[#D4AF37] hover:text-[#10231D] sm:inline-flex"
        >
          My Account
        </Link>
      ) : (
        <Link
          href="/account/login"
          className="hidden h-10 items-center rounded-full bg-[#0B4D3B] px-5 text-sm font-semibold text-white transition hover:bg-[#D4AF37] hover:text-[#10231D] sm:inline-flex"
        >
          Account
        </Link>
      )}

      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setIsOpen(true)}
        className="grid h-10 w-10 place-items-center rounded-full border border-black/10 text-[#0B4D3B] transition hover:border-[#0B4D3B] hover:bg-[#F5F7F4] lg:hidden"
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu overlay"
            className="absolute inset-0 bg-[#10231D]/55 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-[min(88vw,390px)] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-black tracking-[0.08em] text-[#0B4D3B]">KRISHOE</p>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#B98A2E]">
                  Premium menu
                </p>
              </div>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setIsOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full border border-black/10 text-[#0B4D3B]"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <nav className="mt-8 grid gap-1">
              {navLinks.map((item) => {
                const active = isActivePath(pathname, item.href);
                const Icon = item.Icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-4 py-3 text-lg font-semibold transition ${
                      active
                        ? "bg-[#F5F7F4] text-[#0B4D3B]"
                        : "text-[#10231D] hover:bg-[#F5F7F4] hover:text-[#0B4D3B]"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
              {isLoggedIn ? (
                <Link href={isAdmin ? "/admin" : "/account"} onClick={() => setIsOpen(false)} className="rounded-lg px-4 py-3 text-lg font-semibold text-[#10231D] transition hover:bg-[#F5F7F4] hover:text-[#0B4D3B]">
                  My Account
                </Link>
              ) : (
                <Link href="/account/login" onClick={() => setIsOpen(false)} className="rounded-lg px-4 py-3 text-lg font-semibold text-[#10231D] transition hover:bg-[#F5F7F4] hover:text-[#0B4D3B]">
                  Account
                </Link>
              )}
            </nav>

            <div className="mt-8 grid grid-cols-2 gap-3">
              <Link
                href="/wishlist"
                onClick={() => setIsOpen(false)}
                className="rounded-lg border border-black/10 p-4 text-sm font-semibold text-[#10231D]"
              >
                Wishlist
                <span className="mt-1 block text-2xl font-black text-[#0B4D3B]">{wishlistCount}</span>
              </Link>
              <Link
                href="/cart"
                onClick={() => setIsOpen(false)}
                className="rounded-lg border border-black/10 p-4 text-sm font-semibold text-[#10231D]"
              >
                Cart
                <span className="mt-1 block text-2xl font-black text-[#0B4D3B]">{cartCount}</span>
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
