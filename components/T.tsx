"use client";

import { useLanguage } from "@/components/LanguageProvider";

/**
 * Renders one string in the reader's chosen language.
 *
 * The language lives in a client context, so a Server Component cannot call
 * `useLanguage()` directly. Dropping this tiny client island into the server
 * markup translates that one piece of text while the page around it stays
 * server-rendered — importantly, the shop category pages stay statically
 * prerendered. Reading the language from a cookie instead would let the server
 * translate directly, but it would opt those pages into dynamic rendering and
 * cost every shopper the fast static HTML they get today.
 */
export default function T({ en, ne }: { en: string; ne: string }) {
  const { text } = useLanguage();
  return <>{text(en, ne)}</>;
}
