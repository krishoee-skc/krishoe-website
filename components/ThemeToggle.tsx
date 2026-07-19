"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "krishoe-theme";

// Runs before the first paint, inlined in <head>. Without it the page renders
// light, then flips to dark once React has hydrated — a white flash on every
// navigation, which is worse at night than having no dark mode at all.
//
// Kept as a string because it has to be a <script>, and deliberately tiny: it
// runs on the critical path for every page in the shop.
export const themeBootScript = `(function(){try{var s=localStorage.getItem("${THEME_STORAGE_KEY}");var d=s?s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

// The class on <html> is the single source of truth — the boot script sets it
// before React exists, and the toggle writes to it. So the theme is read as an
// external store rather than mirrored into state, which is what keeps the two
// from disagreeing.
function currentTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributeFilter: ["class"] });
  return () => observer.disconnect();
}

// The server has no way to know the visitor's theme, so it renders neither
// icon. React swaps in the right one once it can read the class.
function themeOnServer(): Theme | null {
  return null;
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path strokeLinecap="round" d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />
    </svg>
  );
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, currentTheme, themeOnServer);

  const toggle = () => {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    // Nothing sets state here: flipping the class is what the store observes.
    document.documentElement.classList.toggle("dark", next === "dark");

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private browsing refuses storage. The theme still applies for this
      // visit; it just will not be remembered, which is not worth failing over.
    }
  };

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light mode" : "Dark mode"}
      className="grid h-10 w-10 place-items-center rounded-full border border-black/10 text-brand-green transition hover:border-brand-green hover:bg-brand-mist"
    >
      {/* Before the effect runs, theme is null and neither icon is shown, so the
          button renders as an empty circle of the right size rather than
          flickering the wrong icon. */}
      {theme === null ? null : isDark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
    </button>
  );
}
