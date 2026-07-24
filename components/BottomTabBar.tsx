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
    `group relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px] font-black transition duration-300 ${
      active
        ? "-translate-y-1 bg-brand-green text-white shadow-[0_10px_24px_rgba(11,77,59,0.28)]"
        : "text-brand-muted-deep hover:bg-brand-mist"
    }`;

  const iconBubble = (tone: string, active: boolean) =>
    `grid h-7 w-7 place-items-center rounded-xl transition ${active ? "bg-white/18" : tone}`;

  const isHome = pathname === "/";
  const isShop = pathname === "/shop" || pathname.startsWith("/shop/");
  const isCart = pathname === "/cart";
  const isAccount = pathname.startsWith("/account");

  return (
    <>
      {/* Spacer keeps page content clear of the fixed bar (only where the bar
          shows — it is absent on admin and on desktop). */}
      <div className="h-[calc(5rem+env(safe-area-inset-bottom))] lg:hidden" aria-hidden />

      <nav
        aria-label="Primary"
        className="fixed inset-x-3 bottom-[calc(0.65rem+env(safe-area-inset-bottom))] z-40 rounded-[1.6rem] border border-white/80 bg-white/88 shadow-[0_18px_55px_rgba(47,28,46,0.22)] backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1 p-1.5">
          <Link href="/" className={tabClass(isHome)} aria-current={isHome ? "page" : undefined}>
            <span className={iconBubble("bg-[#FFE4D5] text-[#B74D68]", isHome)}>
              <HomeIcon className="h-[18px] w-[18px]" />
            </span>
            {text("Home", "गृह")}
          </Link>

          <Link href="/shop" className={tabClass(isShop)} aria-current={isShop ? "page" : undefined}>
            <span className={iconBubble("bg-[#DDF3E6] text-brand-green", isShop)}>
              <ShoppingBagIcon className="h-[18px] w-[18px]" />
            </span>
            {text("Shop", "पसल")}
          </Link>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("krishoe:open-search"))}
            className={tabClass(false)}
            aria-label="Open search"
          >
            <span className={iconBubble("bg-[#EEE5FF] text-[#7451A8]", false)}>
              <SearchIcon className="h-[18px] w-[18px]" />
            </span>
            {text("Search", "खोज")}
          </button>

          <Link href="/cart" className={tabClass(isCart)} aria-current={isCart ? "page" : undefined}>
            <span className={`relative ${iconBubble("bg-[#FFF0BF] text-[#8B6718]", isCart)}`}>
              <ShoppingCartIcon className="h-[18px] w-[18px]" />
              {cartCount > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#E84C79] px-1 text-[9px] font-black text-white">
                  {cartCount}
                </span>
              ) : null}
            </span>
            {text("Cart", "कार्ट")}
          </Link>

          <Link href="/account" className={tabClass(isAccount)} aria-current={isAccount ? "page" : undefined}>
            <span className={iconBubble("bg-[#F8DFEF] text-[#A83E70]", isAccount)}>
              <UserIcon className="h-[18px] w-[18px]" />
            </span>
            {text("Account", "खाता")}
          </Link>
        </div>
      </nav>
    </>
  );
}
