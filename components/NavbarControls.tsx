"use client";

import Link from "next/link";
import LanguageSwitch from "@/components/LanguageSwitch";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { HeartIcon, MenuIcon, ShoppingBagIcon, XIcon } from "@/components/Icons";
import { useCommerce } from "@/components/commerce/CommerceProvider";
import CommandSearch from "@/components/CommandSearch";
import ThemeToggle from "@/components/ThemeToggle";
import { isActivePath, navLinks } from "@/components/nav-links";
import { businessContact } from "@/lib/seo";
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

/**
 * The shelves, for the menu drawer.
 *
 * Kept to the ones the shop actually sells today. A category with nothing in it
 * is a shopper tapping through to an empty page, which reads as a shop that has
 * closed rather than one that has not stocked that shelf yet.
 */
const DRAWER_CATEGORIES = [
  { slug: "ladies-sandals", emoji: "👡", en: "Ladies sandals", ne: "महिलाको सयडल" },
  { slug: "ladies-slippers", emoji: "🩴", en: "Ladies slippers", ne: "महिलाको चप्पल" },
  { slug: "casual-shoes", emoji: "👞", en: "Casual shoes", ne: "दैनिक जुत्ता" },
  { slug: "kids-collection", emoji: "👶", en: "Kids", ne: "बच्चाको" },
  { slug: "new-arrivals", emoji: "✨", en: "New arrivals", ne: "नयाँ आएका" },
] as const;

export default function NavbarControls({ isLoggedIn, isAdmin }: NavbarControlsProps) {
  const pathname = usePathname();
  const { cartCount, wishlistCount } = useCommerce();
  const [isOpen, setIsOpen] = useState(false);
  const { language, text } = useLanguage();
  const mobileLabelsNe: Record<string, string> = {
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
    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
      <CommandSearch />

      {/* The theme toggle crowds the phone bar, and the search and cart here
          double up on the bottom tab bar — keep the top bar to brand + wishlist
          + cart + menu on phones, and move the toggle into the menu drawer. */}
      {/* Desktop only. The phone bar is three controls wide and adding a
          fourth crowded it — the note above had already said so, and the shop
          looked worse for a day. On a phone the switch is the first thing in
          the menu drawer instead, one tap from here, and a first-time visitor
          is asked outright by LanguageInvite before they ever go looking.

          The same component the admin, factory and worker screens use, so one
          control cannot end up spelled five ways across the app. It used to be
          a single "ने" here — two letters, and the reader who needs them most
          is the one who cannot read them. */}
      <LanguageSwitch className="hidden lg:inline-flex" compact />

      <span className="hidden lg:block">
        <ThemeToggle />
      </span>

      <Link
        href="/wishlist"
        aria-label={text("Open wishlist", "मन परेका जुत्ता खोल्ने")}
        className="relative hidden h-10 w-10 place-items-center rounded-full border border-black/[0.09] text-brand-green-ink transition duration-200 hover:border-brand-gold/60 hover:text-brand-green lg:grid"
      >
        <HeartIcon className="h-5 w-5" />
        <CountBadge count={wishlistCount} />
      </Link>

      <Link
        href="/cart"
        aria-label={text("Open cart", "कार्ट खोल्ने")}
        className="relative grid h-10 w-10 place-items-center rounded-full border border-black/[0.09] text-brand-green-ink transition duration-200 hover:border-brand-gold/60 hover:text-brand-green"
      >
        <ShoppingBagIcon className="h-5 w-5" />
        <CountBadge count={cartCount} />
      </Link>

      {isLoggedIn ? (
        <Link
          href={isAdmin ? "/admin" : "/account"}
          className="hidden h-10 items-center rounded-full border border-brand-green/25 px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-green-ink transition duration-200 hover:border-brand-gold hover:text-brand-green sm:inline-flex"
        >
          {text("My Account", "मेरो खाता")}
        </Link>
      ) : (
        <Link
          href="/account/login"
          className="hidden h-10 items-center rounded-full border border-brand-green/25 px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-green-ink transition duration-200 hover:border-brand-gold hover:text-brand-green sm:inline-flex"
        >
          {text("Account", "खाता")}
        </Link>
      )}

      <button
        type="button"
        aria-label={text("Open menu", "मेनु खोल्ने")}
        onClick={() => setIsOpen(true)}
        className="grid h-10 w-10 place-items-center rounded-full border border-black/10 text-brand-green transition duration-200 hover:border-brand-green hover:bg-brand-mist hover:shadow-md lg:hidden"
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={text("Close menu overlay", "मेनु बन्द गर्ने")}
            className="absolute inset-0 bg-brand-green-ink/55 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-0 h-dvh w-[min(90vw,390px)] overflow-y-auto bg-brand-paper px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))] shadow-2xl dark:bg-brand-green-ink">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-black tracking-[0.08em] text-brand-green">KRISHOE</p>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold-deep">
                  {text("Premium menu", "मेनु")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <button
                  type="button"
                  aria-label={text("Close menu", "मेनु बन्द गर्ने")}
                  onClick={() => setIsOpen(false)}
                  className="grid h-10 w-10 place-items-center rounded-full border border-black/10 text-brand-green"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* First, not last. It used to sit below the wishlist and cart
                tiles, off the bottom of a phone screen, which is how a shop
                with a Nepali translation looked like a shop without one. */}
            <div className="mt-6">
              <LanguageSwitch className="w-full [&>button]:min-h-12 [&>button]:flex-1 [&>button]:justify-center" />
            </div>

            <nav className="mt-6 grid gap-1">
              {navLinks.map((item) => {
                const active = isActivePath(pathname, item.href);
                const Icon = item.Icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-4 py-3 text-lg font-semibold transition duration-200 ${
                      active
                        ? "bg-brand-mist text-brand-green shadow-md"
                        : "text-brand-green-ink hover:bg-brand-mist hover:text-brand-green hover:shadow-md"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {language === "ne" ? mobileLabelsNe[item.label] ?? item.label : item.label}
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

            {/* What a shopper opens a menu for. The four links above are the
                same four on the bottom tab bar, so until now the drawer
                repeated what was already one tap away and offered nothing
                else — a shelf of shoes is what someone is actually looking
                for. */}
            <div className="mt-7">
              <p className="px-1 text-xs font-black uppercase tracking-[0.18em] text-brand-gold-deep">
                {text("Shop by category", "किसिम अनुसार")}
              </p>
              <div className="mt-2 grid gap-1">
                {DRAWER_CATEGORIES.map((entry) => (
                  <Link
                    key={entry.slug}
                    href={`/shop/${entry.slug}`}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-base font-semibold text-brand-green-ink transition hover:bg-brand-mist hover:text-brand-green"
                  >
                    <span aria-hidden="true">{entry.emoji}</span>
                    {text(entry.en, entry.ne)}
                  </Link>
                ))}
              </div>
            </div>

            {/* The questions a first-time buyer has before they will part with
                money: can I send it back, who are these people, and is there
                someone to talk to. */}
            <div className="mt-7">
              <p className="px-1 text-xs font-black uppercase tracking-[0.18em] text-brand-gold-deep">
                {text("Before you buy", "किन्नुअघि")}
              </p>
              <div className="mt-2 grid gap-1">
                <Link
                  href="/return-policy"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-base font-semibold text-brand-green-ink transition hover:bg-brand-mist hover:text-brand-green"
                >
                  <span aria-hidden="true">📜</span>
                  {text("Return policy", "फिर्ता नीति")}
                </Link>
                <Link
                  href="/track-order"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-base font-semibold text-brand-green-ink transition hover:bg-brand-mist hover:text-brand-green"
                >
                  <span aria-hidden="true">📦</span>
                  {text("Track an order", "अर्डर खोज्ने")}
                </Link>
                <Link
                  href="/wholesale"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-base font-semibold text-brand-green-ink transition hover:bg-brand-mist hover:text-brand-green"
                >
                  <span aria-hidden="true">🏪</span>
                  {text("Wholesale", "थोकमा किन्ने")}
                </Link>
              </div>
            </div>

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

            {/* A phone number, because that is what gets used here. A shopper
                who cannot find one on a shop they have not bought from before
                assumes there is nobody behind it. */}
            <div className="mt-7 rounded-2xl border border-black/[0.07] bg-brand-mist p-4">
              <a
                href={`tel:${businessContact.phoneTel}`}
                className="flex items-center gap-3 text-base font-black text-brand-green-ink"
              >
                <span aria-hidden="true">📞</span>
                {businessContact.phoneDisplay}
              </a>
              <a
                // businessContact.whatsappNumber is already bare digits with the
                // country code. Stripping it again here was how this link ended
                // up as wa.me/ with no number at all.
                href={`https://wa.me/${businessContact.whatsappNumber}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 flex items-center gap-3 text-base font-black text-brand-green-ink"
              >
                <span aria-hidden="true">💬</span>
                WhatsApp
              </a>
              <p className="mt-3 flex items-start gap-3 text-sm leading-6 text-brand-muted">
                <span aria-hidden="true">📍</span>
                {text(
                  "Kamalnagar, Narayangadh, Chitwan",
                  "कमलनगर, नारायणगढ, चितवन",
                )}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
