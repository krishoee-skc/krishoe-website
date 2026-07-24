"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, SearchIcon, ShoppingBagIcon, ShoppingCartIcon, UserIcon } from "@/components/Icons";
import { useCommerce } from "@/components/commerce/CommerceProvider";
import { useLanguage } from "@/components/LanguageProvider";

// App-style bottom navigation for phones/tablets. Hidden on desktop (lg+) and
// on the admin area. Most customers shop from mobile, so the key destinations
// stay one thumb-tap away.
export default function BottomTabBar() {
  const pathname = usePathname();
  const { cartCount } = useCommerce();
  const { text } = useLanguage();

  if (pathname.startsWith("/admin")) {
    return null;
  }

  const tabClass = (active: boolean) =>
    `relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-bold transition ${
      active ? "bg-brand-green-wash text-brand-green" : "text-brand-muted-deep"
    }`;

  const isHome = pathname === "/";
  const isShop = pathname === "/shop" || pathname.startsWith("/shop/");
  const isCart = pathname === "/cart";
  const isAccount = pathname.startsWith("/account");

  return (
    <>
      {/* Spacer keeps page content clear of the fixed bar (only where the bar
          shows — it is absent on admin and on desktop). */}
      <div className="h-[calc(4rem+env(safe-area-inset-bottom))] lg:hidden" aria-hidden />

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1 px-2 py-1">
          <Link href="/" className={tabClass(isHome)} aria-current={isHome ? "page" : undefined}>
            <HomeIcon className="h-5 w-5" />
            {text("Home", "गृह")}
          </Link>

          <Link href="/shop" className={tabClass(isShop)} aria-current={isShop ? "page" : undefined}>
            <ShoppingBagIcon className="h-5 w-5" />
            {text("Shop", "पसल")}
          </Link>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("krishoe:open-search"))}
            className={tabClass(false)}
            aria-label="Open search"
          >
            <SearchIcon className="h-5 w-5" />
            {text("Search", "खोज")}
          </button>

          <Link href="/cart" className={tabClass(isCart)} aria-current={isCart ? "page" : undefined}>
            <span className="relative">
              <ShoppingCartIcon className="h-5 w-5" />
              {cartCount > 0 ? (
                <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-gold-bright px-1 text-[9px] font-black text-brand-green-ink">
                  {cartCount}
                </span>
              ) : null}
            </span>
            {text("Cart", "कार्ट")}
          </Link>

          <Link href="/account" className={tabClass(isAccount)} aria-current={isAccount ? "page" : undefined}>
            <UserIcon className="h-5 w-5" />
            {text("Account", "खाता")}
          </Link>
        </div>
      </nav>
    </>
  );
}
