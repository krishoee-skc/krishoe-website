"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * Asks once, on a first visit, which language the shop should speak.
 *
 * The shop opens in English and the switch sits inside the menu, several taps
 * and a scroll away. So a customer in Narayangadh met an English page, had no
 * way of knowing a Nepali one existed, and left — the translation was there and
 * almost nobody ever saw it.
 *
 * Detecting from the browser would be the obvious fix and it does not work
 * here: most Nepali phones are set to English while their owners would rather
 * read Nepali. The phone reports the setting, not the preference. So this asks,
 * because a question is never wrong the way a guess can be.
 *
 * It asks once. A choice — or a dismissal — is remembered, and the card never
 * appears again. It waits a few seconds first and sits over the delivery strip, so it
 * interrupts nobody who is already reading, and it is not a modal: a shopper
 * who ignores it can carry on shopping in English, which is what a foreign or
 * wholesale visitor will want anyway.
 */

const ASKED_KEY = "krishoe-language-asked";
const SAVED_KEY = "krishoe-language";

/** Long enough that the page has drawn and the reader has settled. */
const DELAY_MS = 2500;

export default function LanguageInvite() {
  const { setLanguage } = useLanguage();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let timer: number | undefined;

    try {
      // Already answered, or already chose a language some other way.
      if (window.localStorage.getItem(ASKED_KEY)) return;
      if (window.localStorage.getItem(SAVED_KEY)) return;
      timer = window.setTimeout(() => setShow(true), DELAY_MS);
    } catch {
      // A browser with storage blocked is not worth a broken page; it simply
      // never sees the card.
    }

    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  if (!show) return null;

  const answer = (choice: "en" | "ne" | null) => {
    try {
      window.localStorage.setItem(ASKED_KEY, "1");
    } catch {
      // Nothing to do; the card closes either way.
    }
    if (choice) setLanguage(choice);
    setShow(false);
  };

  // One slim line, not a card (owner, 2026-10-07): the card covered the first
  // shoes on a phone and the hero's buttons on a laptop. Same question, a third
  // of the height. Up top on a phone and tablet (owner, 2026-10-21, the website
  // sample, 3): at the foot it sat on the tab bar and with it hid a quarter of
  // the first screen, the "Cash on delivery" cards with it. Up top it covers
  // the delivery strip and the header's own top padding — 44px, the height of
  // a phone's buttons (globals.css), with a shadow for its edge so a border
  // adds nothing — not the logo; from a laptop up it stays at the foot on the
  // right.
  return (
    <div
      role="region"
      aria-label="भाषा छान्नुहोस् · Choose language"
      className="fixed inset-x-0 top-0 z-[60] flex items-center gap-2 bg-brand-paper pl-3 pr-1.5 pt-[env(safe-area-inset-top)] shadow-[0_1px_0_rgba(201,162,75,0.45),0_4px_12px_rgba(11,77,59,0.12)] lg:inset-x-auto lg:bottom-6 lg:right-6 lg:top-auto lg:max-w-md lg:rounded-full lg:border lg:border-brand-gold/40 lg:py-1.5 lg:shadow-[0_10px_30px_rgba(11,77,59,0.18)]"
    >
      <span className="text-lg leading-none" aria-hidden="true">
        🇳🇵
      </span>
      <p className="m-0 min-w-0 flex-1 truncate text-sm font-black leading-5 text-brand-green-ink">
        नेपालीमा हेर्नुहुन्छ?
        <span className="sr-only"> Read this shop in Nepali?</span>
      </p>
      <button
        type="button"
        onClick={() => answer("ne")}
        className="min-h-9 flex-none rounded-full lg:min-h-10 bg-brand-green px-4 text-sm font-black text-white"
      >
        नेपाली
      </button>
      <button
        type="button"
        onClick={() => answer("en")}
        className="min-h-9 flex-none rounded-full lg:min-h-10 border border-brand-green/30 px-3 text-sm font-black text-brand-green-ink"
      >
        English
      </button>
      <button
        type="button"
        onClick={() => answer(null)}
        aria-label="बन्द गर्ने · Close"
        className="grid h-9 w-9 flex-none place-items-center rounded-full lg:h-10 lg:w-10 text-base leading-none text-brand-muted hover:bg-brand-mist"
      >
        ✕
      </button>
    </div>
  );
}
