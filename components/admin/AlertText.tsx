"use client";

import { useLanguage } from "@/components/LanguageProvider";

/**
 * One alert's words, in the language the reader chose.
 *
 * The alerts are computed on the server, where the language is unknowable — the
 * choice lives in the reader's own browser storage. So each alert arrives
 * carrying both halves and this tiny island picks between them, which is the
 * same arrangement the storefront uses for its hand-written pairs.
 *
 * Small on purpose. Making the whole alerts page a client component to read one
 * boolean would push every alert's data through the browser and cost the page
 * its server rendering; this ships three lines of logic instead.
 */
export default function AlertText({ en, ne }: { en: string; ne: string }) {
  const { language } = useLanguage();
  return <>{language === "ne" && ne.trim() ? ne : en}</>;
}
