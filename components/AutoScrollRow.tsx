"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A row of cards that moves on by itself, one card at a time, on a screen
 * where it scrolls sideways (owner, 2026-10-01: "reviews that move"). A touch,
 * a hover or a keyboard focus stops it, and it waits a while before moving
 * again; it never moves for someone who asked their phone for less motion, and
 * does nothing where the cards already fit.
 */
export default function AutoScrollRow({
  children,
  className,
  everyMs = 4500,
}: {
  children: ReactNode;
  className?: string;
  everyMs?: number;
}) {
  const row = useRef<HTMLDivElement>(null);
  const heldUntil = useRef(0);

  useEffect(() => {
    const element = row.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const hold = () => {
      heldUntil.current = Date.now() + 8000;
    };
    element.addEventListener("pointerdown", hold);
    element.addEventListener("pointerenter", hold);
    element.addEventListener("focusin", hold);

    const id = window.setInterval(() => {
      if (Date.now() < heldUntil.current || document.hidden) return;
      if (element.scrollWidth <= element.clientWidth + 4) return;
      const card = element.firstElementChild as HTMLElement | null;
      const step = card ? card.offsetWidth + 16 : element.clientWidth * 0.8;
      const atEnd = element.scrollLeft + element.clientWidth >= element.scrollWidth - 8;
      element.scrollTo({ left: atEnd ? 0 : element.scrollLeft + step, behavior: "smooth" });
    }, everyMs);

    return () => {
      window.clearInterval(id);
      element.removeEventListener("pointerdown", hold);
      element.removeEventListener("pointerenter", hold);
      element.removeEventListener("focusin", hold);
    };
  }, [everyMs]);

  return (
    <div ref={row} className={className}>
      {children}
    </div>
  );
}
