"use client";

import { useLanguage } from "@/components/LanguageProvider";

/**
 * The one shape the language switch takes, wherever it appears.
 *
 * The shop has had a switch since the storefront was translated. The factory,
 * the admin screens and the worker portal never got one — on a phone or a
 * computer — so the people who use this app every day were the only ones with
 * no way to change its language. That is the wrong way round: the owner and the
 * workers read Nepali first, and they are the ones who are stuck.
 *
 * Both halves are always visible rather than one letter that toggles. A single
 * "ने" asks the reader to work out that it is a button and to guess what it
 * will do; two halves with one filled in are a switch anyone has seen before,
 * and they say what the other language is before it is chosen.
 *
 * `tone="dark"` is for the deep-green rails, where a green fill would vanish
 * into the ground and gold is what the eye finds.
 */
export default function LanguageSwitch({
  tone = "light",
  className = "",
}: {
  tone?: "light" | "dark";
  className?: string;
}) {
  const { language, setLanguage, text } = useLanguage();

  const base =
    "inline-flex items-center px-3.5 text-[13px] font-black leading-none transition duration-200";
  const activeFill = tone === "dark" ? "bg-brand-gold text-brand-green-ink" : "bg-brand-green text-white";
  const restingText = tone === "dark" ? "text-white/60 hover:text-white" : "text-brand-muted hover:text-brand-green-ink";

  return (
    <div
      role="group"
      aria-label={text("Language", "भाषा")}
      className={`inline-flex h-9 shrink-0 overflow-hidden rounded-full border border-brand-gold/70 ${className}`}
    >
      <button
        type="button"
        onClick={() => setLanguage("ne")}
        aria-pressed={language === "ne"}
        className={`${base} ${language === "ne" ? activeFill : restingText}`}
      >
        ने
      </button>
      <button
        type="button"
        onClick={() => setLanguage("en")}
        aria-pressed={language === "en"}
        className={`${base} ${language === "en" ? activeFill : restingText}`}
      >
        EN
      </button>
    </div>
  );
}
