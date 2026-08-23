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

  return (
    <div
      role="dialog"
      aria-label="भाषा छान्नुहोस् · Choose language"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border border-brand-gold/40 bg-white p-4 shadow-[0_18px_50px_rgba(11,77,59,0.22)] md:inset-x-auto md:right-6 md:bottom-6"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none" aria-hidden="true">
          🇳🇵
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-black leading-6 text-brand-green-ink">
            नेपालीमा हेर्नुहुन्छ?
          </p>
          <p className="mt-0.5 text-sm text-brand-muted">Read this shop in Nepali?</p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => answer("ne")}
              className="min-h-11 rounded-xl bg-brand-green px-3 text-sm font-black text-white"
            >
              नेपाली
            </button>
            <button
              type="button"
              onClick={() => answer("en")}
              className="min-h-11 rounded-xl border border-brand-green/30 bg-white px-3 text-sm font-black text-brand-green-ink"
            >
              English
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => answer(null)}
          aria-label="बन्द गर्ने · Close"
          className="-mr-1 -mt-1 rounded-lg px-2 py-1 text-lg leading-none text-brand-muted hover:bg-brand-mist"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
