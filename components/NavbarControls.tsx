"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { HeartIcon, MenuIcon, ShoppingBagIcon, XIcon } from "@/components/Icons";
import { useCommerce } from "@/components/commerce/CommerceProvider";
import CommandSearch from "@/components/CommandSearch";
import ThemeToggle from "@/components/ThemeToggle";
import { isActivePath, navLinks } from "@/components/nav-links";
import { useLanguage } from "@/components/LanguageProvider";

type NavbarControlsProps = {
  isLoggedIn: boolean;
  isAdmin: boolean;
};

function CountBadge({ count }: { count: number }) {
  if (count === 0) {
    return null;
  }

  return (
    <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand-gold-bright px-1 text-[10px] font-black text-brand-green-ink">
      {count}
    </span>
  );
}

export default function NavbarControls({ isLoggedIn, isAdmin }: NavbarControlsProps) {
  const pathname = usePathname();
  const { cartCount, wishlistCount } = useCommerce();
  const [isOpen, setIsOpen] = useState(false);
  const { language, setLanguage, text } = useLanguage();
  const mobileLabels: Record<string, string> = {
    Home: "गृह",
    Shop: "पसल",
    "Our Story": "हाम्रो कथा",
    Contact: "सम्पर्क",
  };

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div className="flex shrink-0 items-center gap-2">
      <CommandSearch />

      {/* The theme toggle crowds the phone bar, and the search and cart here
          double up on the bottom tab bar — keep the top bar to brand + wishlist
          + cart + menu on phones, and move the toggle into the menu drawer. */}
      <span className="hidden lg:block">
        <ThemeToggle />
      </span>

      <Link
        href="/wishlist"
        aria-label="Open wishlist"
        className="relative hidden h-10 w-10 place-items-center rounded-full border border-black/10 text-brand-green transition hover:border-brand-green hover:bg-brand-mist lg:grid"
      >
        <HeartIcon className="h-5 w-5" />
        <CountBadge count={wishlistCount} />
      </Link>

      <Link
        href="/cart"
        aria-label="Open cart"
        className="relative grid h-10 w-10 place-items-center rounded-full border border-black/10 text-brand-green transition hover:border-brand-green hover:bg-brand-mist"
      >
        <ShoppingBagIcon className="h-5 w-5" />
        <CountBadge count={cartCount} />
      </Link>

      {isLoggedIn ? (
        <Link
          href={isAdmin ? "/admin" : "/account"}
          className="hidden h-10 items-center rounded-full bg-brand-green px-5 text-sm font-semibold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink sm:inline-flex"
        >
          My Account
        </Link>
      ) : (
        <Link
          href="/account/login"
          className="hidden h-10 items-center rounded-full bg-brand-green px-5 text-sm font-semibold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink sm:inline-flex"
        >
          Account
        </Link>
      )}

      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setIsOpen(true)}
        className="grid h-10 w-10 place-items-center rounded-full border border-black/10 text-brand-green transition hover:border-brand-green hover:bg-brand-mist lg:hidden"
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu overlay"
            className="absolute inset-0 bg-brand-green-ink/55 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-[min(90vw,390px)] overflow-y-auto bg-white px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))] shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-black tracking-[0.08em] text-brand-green">KRISHOE</p>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold-deep">
                  Premium menu
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setIsOpen(false)}
                  className="grid h-10 w-10 place-items-center rounded-full border border-black/10 text-brand-green"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>
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
                        ? "bg-brand-mist text-brand-green"
                        : "text-brand-green-ink hover:bg-brand-mist hover:text-brand-green"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {language === "ne" ? mobileLabels[item.label] ?? item.label : item.label}
                  </Link>
                );
              })}
              {isLoggedIn ? (
                <Link href={isAdmin ? "/admin" : "/account"} onClick={() => setIsOpen(false)} className="rounded-lg px-4 py-3 text-lg font-semibold text-brand-green-ink transition hover:bg-brand-mist hover:text-brand-green">
                  {text("My Account", "मेरो खाता")}
                </Link>
              ) : (
                <Link href="/account/login" onClick={() => setIsOpen(false)} className="rounded-lg px-4 py-3 text-lg font-semibold text-brand-green-ink transition hover:bg-brand-mist hover:text-brand-green">
                  {text("Account", "खाता")}
                </Link>
              )}
            </nav>

            <div className="mt-8 grid grid-cols-2 gap-3">
              <Link
                href="/wishlist"
                onClick={() => setIsOpen(false)}
                className="rounded-lg border border-black/10 p-4 text-sm font-semibold text-brand-green-ink"
              >
                {text("Wishlist", "मनपर्ने")}
                <span className="mt-1 block text-2xl font-black text-brand-green">{wishlistCount}</span>
              </Link>
              <Link
                href="/cart"
                onClick={() => setIsOpen(false)}
                className="rounded-lg border border-black/10 p-4 text-sm font-semibold text-brand-green-ink"
              >
                {text("Cart", "कार्ट")}
                <span className="mt-1 block text-2xl font-black text-brand-green">{cartCount}</span>
              </Link>
            </div>
            <div className="mt-5 rounded-2xl border border-black/10 bg-brand-mist p-3">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-brand-muted">
                {text("Language", "भाषा")}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLanguage("en")}
                  className={`min-h-11 rounded-xl text-sm font-black ${
                    language === "en" ? "bg-brand-green text-white" : "bg-white text-brand-green-ink"
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage("ne")}
                  className={`min-h-11 rounded-xl text-sm font-black ${
                    language === "ne" ? "bg-brand-green text-white" : "bg-white text-brand-green-ink"
                  }`}
                >
                  नेपाली
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
