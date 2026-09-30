import type { ReactNode } from "react";
import LanguageProvider from "@/components/LanguageProvider";

/**
 * The Nepali pages (owner, 2026-10-01): the same shelves as the English site,
 * built in Nepali on the server so a search engine reads them in Nepali. Only
 * the wording changes — the pages, prices and stock are the English pages' own.
 */
export default function NepaliLayout({ children }: { children: ReactNode }) {
  return <LanguageProvider initialLanguage="ne">{children}</LanguageProvider>;
}
