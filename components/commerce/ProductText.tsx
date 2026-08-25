"use client";

import { useLanguage } from "@/components/LanguageProvider";

/**
 * A shoe's own words, in the language the shopper chose.
 *
 * Everything else on this site is a hand-written pair decided when the page was
 * built. A product's name and description are not — they come out of the
 * database, they change when the owner edits them, and until now the database
 * held one of each. So a shopper who pressed ने read a fully Nepali shop with
 * "close shoes" and "jeans shoes" sitting in the middle of it.
 *
 * The Nepali is optional and will be empty for a while. Falling back to the
 * English name is exactly what the shop did before the column existed, so a
 * half-filled catalogue reads no worse than today's and improves one shoe at a
 * time as the owner types.
 */
export default function ProductText({
  en,
  ne,
  className,
}: {
  en: string;
  ne?: string;
  className?: string;
}) {
  const { language } = useLanguage();
  const shown = language === "ne" && ne?.trim() ? ne : en;

  return className ? <span className={className}>{shown}</span> : <>{shown}</>;
}
