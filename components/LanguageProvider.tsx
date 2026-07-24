"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Language = "en" | "ne";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  text: (english: string, nepali: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export default function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem("krishoe-language");
    if (saved !== "ne") return;

    const restorePreference = window.setTimeout(() => setLanguage("ne"), 0);
    return () => window.clearTimeout(restorePreference);
  }, []);

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
