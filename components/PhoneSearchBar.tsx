"use client";

import { SearchIcon } from "@/components/Icons";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * A search box always in view at the top of the home page and the shop, on a
 * phone (owner's shop sample, 9, 2026-10-26 — Novo keeps one under its logo).
 *
 * It is the same search as the header's and the tab bar's: pressing it opens
 * the one search panel (CommandSearch) through the event the tab bar already
 * sends, so there is still one place where a shoe is looked for.
 */
export default function PhoneSearchBar() {
  const { text } = useLanguage();
  return (
    <div data-phone-search className="px-4 pt-3 md:hidden">
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("krishoe:open-search"))}
        className="flex min-h-11 w-full items-center gap-2.5 rounded-full border border-black/10 bg-brand-paper px-4 text-left text-sm text-brand-muted shadow-sm"
      >
        <SearchIcon className="h-5 w-5 shrink-0 text-brand-green" />
        {text("Search sandals, colour, size…", "चप्पल, रङ, साइज खोज्नुहोस्…")}
      </button>
    </div>
  );
}
