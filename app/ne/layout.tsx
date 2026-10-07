import type { ReactNode } from "react";
import LanguageProvider from "@/components/LanguageProvider";

/**
 * The Nepali pages (owner, 2026-10-01): the same shelves as the English site,
 * built in Nepali on the server so a search engine reads them in Nepali. Only
 * the wording changes — the pages, prices and stock are the English pages' own.
 */
export default function NepaliLayout({ children }: { children: ReactNode }) {
  // lang="ne" in the HTML the server sends (owner, 2026-10-07). The root
  // <html> says "en" for every page and only the browser corrected it, after
  // the page ran — a search engine or a screen reader reading the sent page
  // took the Nepali for English. A wrapper that draws nothing (`contents`)
  // carries it, so these pages can stay prebuilt.
  return (
    <div lang="ne" className="contents">
      <LanguageProvider initialLanguage="ne">{children}</LanguageProvider>
    </div>
  );
}
