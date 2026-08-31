"use client";

import type { MouseEvent } from "react";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * The first thing the keyboard reaches on every page.
 *
 * Without it, a person who cannot use a mouse — and anyone on a screen reader —
 * tabs through the whole header, the menu and the language switch before the
 * first product, on every single page. This lets the first Tab, then Enter,
 * jump straight to the content.
 *
 * It targets the page's own <main> rather than a fixed id, so it works on every
 * page without each one having to remember to carry the anchor. Hidden until it
 * is focused, so it costs the visual design nothing.
 */
export default function SkipToContent() {
  const { text } = useLanguage();

  function skip(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const main = document.querySelector("main");
    if (!main) return;
    // A <main> is not focusable on its own; make it so for this jump, so the
    // keyboard actually lands inside the content and not just scrolls to it.
    main.setAttribute("tabindex", "-1");
    (main as HTMLElement).focus();
    main.scrollIntoView();
  }

  return (
    <a
      href="#main"
      onClick={skip}
      className="sr-only rounded-lg font-bold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:bg-brand-green focus:px-4 focus:py-2 focus:text-sm focus:shadow-lg"
    >
      {text("Skip to content", "मुख्य सामग्रीमा जानुहोस्")}
    </a>
  );
}
