"use client";

import Image from "next/image";
import T from "@/components/T";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { categories } from "@/lib/products";
import { ChevronDownIcon } from "@/components/Icons";
import { isActivePath, navLinks } from "@/components/nav-links";

export default function PrimaryNav() {
  const pathname = usePathname();
  const [shopOpen, setShopOpen] = useState(false);

  return (
    <nav className="hidden items-center gap-7 lg:flex xl:gap-9">
      {navLinks.map((item) => {
        const active = isActivePath(pathname, item.href);
        // item.Icon is still carried for the phone menu, which keeps its icons —
        // a drawer of large touch targets reads better with them. The desktop
        // row does not.
        // No icon, and no wrapping. A picture beside every word reads as an
        // app's tab bar; a shop's nav is words. whitespace-nowrap is what stops
        // "Our Story" breaking onto a second line and leaving the row visibly
        // uneven, which is what it did.
        const linkClass = `group relative flex items-center gap-1.5 whitespace-nowrap py-2 text-[11px] font-bold uppercase tracking-[0.2em] transition ${
          active ? "text-brand-green-ink" : "text-brand-muted hover:text-brand-green-ink"
        }`;
        // Gold appears twice in this header, and this is one: a hairline under
        // the page you are on. Kept to a hairline so it reads as a mark rather
        // than a highlighter.
        const underline = (
          <span
            className={`pointer-events-none absolute inset-x-0 -bottom-1 h-px bg-brand-gold-bright transition ${
              active ? "opacity-100" : "opacity-0 group-hover:opacity-70"
            }`}
          />
        );

        if (item.hasMegaMenu) {
          return (
            <div
              key={item.href}
              className="relative"
              onMouseEnter={() => setShopOpen(true)}
              onMouseLeave={() => setShopOpen(false)}
            >
              <Link
                href={item.href}
                className={linkClass}
                aria-expanded={shopOpen}
                onClick={() => setShopOpen(false)}
              >
                {item.label}
                <ChevronDownIcon
                  className={`h-3 w-3 transition ${shopOpen ? "rotate-180" : ""}`}
                />
                {underline}
              </Link>

              {shopOpen ? (
                <div className="absolute left-1/2 top-full z-50 w-[min(92vw,660px)] -translate-x-1/2 pt-3">
                  <div className="rounded-2xl border border-black/10 bg-brand-paper p-3 shadow-2xl">
                    <div className="grid grid-cols-2 gap-1.5">
                      {categories.map((category) => (
                        <Link
                          key={category.slug}
                          href={`/shop/${category.slug}`}
                          onClick={() => setShopOpen(false)}
                          className="group flex items-center gap-3 rounded-xl p-2 transition hover:bg-brand-mist"
                        >
                          <Image
                            src={category.image}
                            alt={category.title}
                            width={56}
                            height={56}
                            className="h-14 w-14 shrink-0 rounded-lg object-cover"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-brand-green-ink group-hover:text-brand-green">
                              {category.title}
                            </span>
                            <span className="block truncate text-xs text-brand-muted-deep">
                              {category.description}
                            </span>
                          </span>
                        </Link>
                      ))}
                    </div>
                    <Link
                      href="/shop"
                      onClick={() => setShopOpen(false)}
                      className="mt-1.5 flex items-center justify-center rounded-xl bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink"
                    >
                      <T en="View all products" ne="सबै जुत्ता हेर्ने" />
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          );
        }

        return (
          <Link key={item.href} href={item.href} className={linkClass}>
            {item.label}
            {underline}
          </Link>
        );
      })}
    </nav>
  );
}
