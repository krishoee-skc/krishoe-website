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
 * appears again. It waits a few seconds first and sits at the bottom, so it
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
  // shoes on a phone and the hero's buttons on a laptop. Same question, same
  // place, a third of the height.
  return (
    <div
      role="region"
      aria-label="भाषा छान्नुहोस् · Choose language"
      // Above the tab bar (and the buy bar on a product page), not across it:
      // at bottom-3 the two sat on the same strip of a phone.
      className="fixed inset-x-3 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-2 rounded-full border border-brand-gold/40 bg-brand-paper py-1.5 pl-3 pr-1.5 shadow-[0_10px_30px_rgba(11,77,59,0.18)] md:inset-x-auto md:right-6 lg:bottom-6"
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
        className="min-h-10 flex-none rounded-full bg-brand-green px-4 text-sm font-black text-white"
      >
        नेपाली
      </button>
      <button
        type="button"
        onClick={() => answer("en")}
        className="min-h-10 flex-none rounded-full border border-brand-green/30 px-3 text-sm font-black text-brand-green-ink"
      >
        English
      </button>
      <button
        type="button"
        onClick={() => answer(null)}
        aria-label="बन्द गर्ने · Close"
        className="grid h-10 w-10 flex-none place-items-center rounded-full text-base leading-none text-brand-muted hover:bg-brand-mist"
      >
        ✕
      </button>
    </div>
  );
}
