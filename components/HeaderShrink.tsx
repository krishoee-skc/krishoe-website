"use client";

import { useEffect, useRef } from "react";

/**
 * Marks the shop's header once the page is scrolled (owner, 2026-10-07), so
 * the delivery strip folds away and the logo row tightens; back at the top it
 * is whole again. The look is in globals.css under `header[data-scrolled]`.
 *
 * Two thresholds, not one: folding the strip moves the page by its height, and
 * a single line would let that move flip it straight back.
 */
const FOLD_AT = 64;
const OPEN_AT = 8;

export default function HeaderShrink() {
  const mark = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const header = mark.current?.closest("header");
    if (!header) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const folded = header.dataset.scrolled === "true";
      const y = window.scrollY;
      if (!folded && y > FOLD_AT) header.dataset.scrolled = "true";
      else if (folded && y < OPEN_AT) delete header.dataset.scrolled;
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return <span ref={mark} hidden />;
}
