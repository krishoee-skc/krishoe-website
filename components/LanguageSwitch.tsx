"use client";

import { useLanguage } from "@/components/LanguageProvider";

/**
 * The one shape the language switch takes, wherever it appears.
 *
 * The shop has had a switch since the storefront was translated. The factory,
 * the admin screens and the worker portal never got one — on a phone or a
 * computer — so the people who use this app every day were the only ones with
 * no way to change its language. That is the wrong way round: the owner and the
 * workers read Nepali first, and they were the ones stuck.
 *
 * It said "ने" and "EN". Two letters ask a reader who does not read Devanagari
 * to work out that "ने" is a button and then to guess what it will do — which
 * is precisely the reader the button exists for. It says नेपाली and ENGLISH
 * now, with a tick on whichever is running, so the control names both the
 * language you are in and the one you would be going to.
 *
 * Both halves are always visible rather than one label that toggles, for the
 * same reason: a single word leaves the reader to guess whether it describes
 * the current state or the action.
 *
 * `tone="dark"` is for the deep-green rails, where a green fill would vanish
 * into the ground and gold is what the eye finds.
 */
export default function LanguageSwitch({
  tone = "light",
  compact = false,
  className = "",
}: {
  tone?: "light" | "dark";
  /** Narrow bars shorten the English; the Nepali stays whole either way. */
  compact?: boolean;
  className?: string;
}) {
  const { language, setLanguage, text } = useLanguage();

  const base =
    "inline-flex items-center gap-1.5 px-3 text-[13px] font-black leading-none transition duration-200 sm:px-3.5";
  const activeFill =
    tone === "dark" ? "bg-brand-gold text-brand-green-ink" : "bg-brand-green text-white";
  const restingText =
    tone === "dark" ? "text-white/60 hover:text-white" : "text-brand-muted hover:text-brand-green-ink";

  return (
    <div
      role="group"
      aria-label={text("Language", "भाषा")}
      className={`inline-flex h-10 shrink-0 overflow-hidden rounded-full border border-brand-gold/70 ${className}`}
    >
      <button
        type="button"
        onClick={() => setLanguage("ne")}
        aria-pressed={language === "ne"}
        className={`${base} ${language === "ne" ? activeFill : restingText}`}
      >
        {language === "ne" ? <TickIcon /> : null}
        नेपाली
      </button>
      <button
        type="button"
        onClick={() => setLanguage("en")}
        aria-pressed={language === "en"}
        className={`${base} ${language === "en" ? activeFill : restingText}`}
      >
        {language === "en" ? <TickIcon /> : null}
        {compact ? "ENG" : "ENGLISH"}
      </button>
    </div>
  );
}

/** Marks the language that is running, so neither half has to be guessed at. */
function TickIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3 w-3 shrink-0"
    >
      <path d="m4 12.5 5 5L20 7" />
    </svg>
  );
}
