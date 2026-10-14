"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BellIcon } from "@/components/Icons";
import { useLanguage } from "@/components/LanguageProvider";
import type { BellItem } from "@/lib/admin-bell";

const dot: Record<BellItem["tone"], string> = {
  critical: "bg-brand-clay",
  warning: "bg-brand-gold-deep",
  info: "bg-brand-green",
};

/**
 * 🔔 — everything that waits, in one list (owner, 2026-10-14, the menu sample).
 * The number is how many lines there are to look at; each line opens the
 * screen where it is put right. Under the bar on a phone, a dropdown on a
 * computer.
 */
export default function AdminBell({ items }: { items: BellItem[] }) {
  const { text } = useLanguage();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const box = useRef<HTMLDivElement>(null);

  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onDown = (event: PointerEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const waiting = items.length;
  const label = waiting
    ? text(`${waiting} thing${waiting === 1 ? "" : "s"} waiting`, `${waiting} कुरा हेर्नुपर्ने`)
    : text("Nothing waiting", "हेर्नुपर्ने केही छैन");

  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={label}
        title={label}
        className="relative grid h-11 w-11 place-items-center rounded-xl border border-brand-green-line bg-brand-paper text-brand-green-ink transition hover:border-brand-green"
      >
        <BellIcon className="h-5 w-5" />
        {waiting > 0 ? (
          <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand-clay px-1 text-xs font-black leading-none text-white ring-2 ring-brand-paper">
            {waiting > 9 ? "9+" : waiting}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={text("What waits", "हेर्नुपर्ने")}
          className="fixed inset-x-2 top-[calc(4.5rem+env(safe-area-inset-top))] z-50 max-h-[70dvh] overflow-y-auto rounded-2xl border border-brand-green-line bg-brand-paper p-2 shadow-2xl md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-2 md:w-96"
        >
          <p className="px-2 pb-1 pt-1 text-xs font-black uppercase tracking-[0.12em] text-brand-muted-soft">
            {waiting ? text(`To look at · ${waiting}`, `हेर्नुपर्ने · ${waiting}`) : text("To look at", "हेर्नुपर्ने")}
          </p>
          {waiting === 0 ? (
            <p className="px-2 py-4 text-base font-bold text-brand-green">✓ {text("All clear — nothing waits.", "सबै ठीक — केही बाँकी छैन।")}</p>
          ) : (
            <ul className="grid gap-1">
              {items.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className="flex min-h-12 items-start gap-3 rounded-xl px-2.5 py-2 transition hover:bg-brand-green-wash">
                    <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dot[item.tone]}`} />
                    <span className="min-w-0 leading-snug">
                      <span className="block text-[0.9375rem] font-black text-brand-green-ink">{text(item.en, item.ne)}</span>
                      <span className="block text-sm text-brand-muted">{text(item.detailEn, item.detailNe)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
