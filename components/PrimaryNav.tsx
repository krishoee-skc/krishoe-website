"use client";

import Image from "next/image";
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
    <nav className="hidden items-center gap-1 lg:flex">
      {navLinks.map((item) => {
        const active = isActivePath(pathname, item.href);
        const Icon = item.Icon;
        const linkClass = `group relative flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition ${
          active ? "text-brand-green" : "text-[#31413B] hover:text-brand-gold-deep"
        }`;
        const underline = (
          <span
            className={`pointer-events-none absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-brand-gold-bright transition ${
              active ? "opacity-100" : "opacity-0 group-hover:opacity-60"
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
                <Icon className="h-4 w-4" />
                {item.label}
                <ChevronDownIcon
                  className={`h-3.5 w-3.5 transition ${shopOpen ? "rotate-180" : ""}`}
                />
                {underline}
              </Link>

              {shopOpen ? (
                <div className="absolute left-1/2 top-full z-50 w-[min(92vw,660px)] -translate-x-1/2 pt-3">
                  <div className="rounded-2xl border border-black/10 bg-white p-3 shadow-2xl">
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
                      View all products
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          );
        }

        return (
          <Link key={item.href} href={item.href} className={linkClass}>
            <Icon className="h-4 w-4" />
            {item.label}
            {underline}
          </Link>
        );
      })}
    </nav>
  );
}
