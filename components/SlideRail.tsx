"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/Icons";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * A row that slides sideways (owner, 2026-10-02: "every collection, and they
 * slide"). A finger moves it on a phone; on a wider screen ‹ › buttons appear,
 * but only while there is more to see in that direction. It never moves by
 * itself — a row of doors that drifts away is hard to tap.
 */
export default function SlideRail({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { text } = useLanguage();
  const row = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ left: false, right: false });

  useEffect(() => {
    const element = row.current;
    if (!element) return;
    const measure = () =>
      setMore({
        left: element.scrollLeft > 4,
        right: element.scrollLeft + element.clientWidth < element.scrollWidth - 4,
      });
    measure();
    element.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      element.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, []);

  const slide = (direction: 1 | -1) => {
    const element = row.current;
    if (!element) return;
    element.scrollBy({ left: direction * element.clientWidth * 0.8, behavior: "smooth" });
  };

  const arrow = "absolute top-[38%] z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-brand-green-line bg-brand-paper text-brand-green-ink shadow-md transition hover:border-brand-green hover:text-brand-green";
  return (
    <div className="relative">
      <div ref={row} className={`flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}>
        {children}
      </div>
      {more.left ? (
        <button type="button" onClick={() => slide(-1)} aria-label={text("Previous", "अघिल्लो")} className={`${arrow} -left-2 md:grid`}>
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
      ) : null}
      {more.right ? (
        <button type="button" onClick={() => slide(1)} aria-label={text("Next", "अर्को")} className={`${arrow} -right-2 md:grid`}>
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      ) : null}
    </div>
  );
}
