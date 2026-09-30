"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";

type Language = "en" | "ne";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  text: (english: string, nepali: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * Restores the saved language before the browser paints, not after.
 *
 * The server sends English, because the pages a shopper lands on are
 * prerendered and the server cannot know one reader from another. The choice
 * lives in localStorage, which only the browser can read — so the first paint
 * is always English and the Nepali arrives a moment later.
 *
 * How long that moment lasts is the whole difference. Restoring in useEffect,
 * behind a setTimeout, put it two frames away: a shopper who chose Nepali
 * watched every page arrive in English and turn over in front of them, which
 * reads like a page that cannot make up its mind. A layout effect runs after
 * hydration but before paint, so React re-renders in Nepali and the browser
 * draws once. The English is still what hydrates — that is what keeps the
 * markup matching and the pages static — it is simply never shown.
 *
 * useLayoutEffect does not exist during server rendering, so the server takes
 * useEffect and never runs either.
 */
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * `initialLanguage` is for the Nepali pages under /ne (owner, 2026-10-01): they
 * are built in Nepali on the server, so a search engine reads them in Nepali —
 * the saved choice cannot reach a crawler. There the page's own language wins
 * over the saved one; everywhere else nothing changes.
 */
export default function LanguageProvider({
  children,
  initialLanguage,
}: {
  children: React.ReactNode;
  initialLanguage?: Language;
}) {
  const [language, setLanguage] = useState<Language>(initialLanguage ?? "en");

  useIsomorphicLayoutEffect(() => {
    if (initialLanguage) return;
    const saved = window.localStorage.getItem("krishoe-language");
    if (saved !== "ne") return;

    setLanguage("ne");
  }, [initialLanguage]);

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem("krishoe-language", language);
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      text: (english: string, nepali: string) => (language === "ne" ? nepali : english),
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
