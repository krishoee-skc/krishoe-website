"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
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
 * (2026-10-29: never on a shoe, the cart or checkout; it goes by itself on a
 * scroll or after ten seconds, and stops asking after two unanswered showings.)
 *
 * It asks once. A choice — or a dismissal — is remembered, and the card never
 * appears again. It waits a few seconds first and hangs under the header, so it
 * interrupts nobody who is already reading, and it is not a modal: a shopper
 * who ignores it can carry on shopping in English, which is what a foreign or
 * wholesale visitor will want anyway.
 */

const ASKED_KEY = "krishoe-language-asked";
const SAVED_KEY = "krishoe-language";
/** How many times the card has shown itself and gone unanswered. */
const SHOWN_KEY = "krishoe-language-shown";

/** Long enough that the page has drawn and the reader has settled. */
const DELAY_MS = 2500;
/** It steps aside by itself after this long, or on a scroll (UI/UX audit 4). */
const STAY_MS = 10_000;
/** Unanswered this many times, it stops asking; the header switch remains. */
const MAX_SHOWINGS = 2;

/**
 * The buying pages are left alone (UI/UX audit 4, 2026-10-29): there the card
 * covered the shoe's name and the checkout heading at the moment that matters
 * most. It waits for the next shop page instead.
 */
export function quietPage(pathname: string) {
  return /^\/(product\/|cart$|checkout)/.test(pathname);
}

export default function LanguageInvite() {
  const { setLanguage } = useLanguage();
  const pathname = usePathname() ?? "";
  const [show, setShow] = useState(false);
  const [top, setTop] = useState(64);
  const [arrow, setArrow] = useState(72);

  // Once up, it goes by itself — on a scroll, or after STAY_MS — and that
  // counts as one showing; a reader who scrolls past it twice has said enough.
  useEffect(() => {
    if (!show) return;
    const startY = window.scrollY;
    const away = () => {
      setShow(false);
      try {
        const shown = Number(window.localStorage.getItem(SHOWN_KEY) ?? "0") + 1;
        window.localStorage.setItem(SHOWN_KEY, String(shown));
        if (shown >= MAX_SHOWINGS) window.localStorage.setItem(ASKED_KEY, "1");
      } catch {
        // Nothing to remember it in; it simply goes.
      }
    };
    const onScroll = () => {
      if (Math.abs(window.scrollY - startY) > 120) away();
    };
    const timer = window.setTimeout(away, STAY_MS);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [show]);

  useEffect(() => {
    let timer: number | undefined;

    try {
      // Already answered, or already chose a language some other way.
      if (window.localStorage.getItem(ASKED_KEY)) return;
      if (window.localStorage.getItem(SAVED_KEY)) return;
      timer = window.setTimeout(() => {
        if (quietPage(window.location.pathname)) return;
        // Just under the header, wherever its height has settled.
        const header = document.querySelector(".krs-header");
        // Below the phone's search box too, where the home page has one.
        const search = document.querySelector<HTMLElement>("[data-phone-search]");
        const above = search && search.offsetParent !== null ? search : header;
        setTop(Math.round((above?.getBoundingClientRect().bottom ?? 56) + 8));
        // The arrow points at whichever language switch the header is showing.
        const edge = window.innerWidth >= 1024 ? 24 : 8;
        const switches = Array.from(document.querySelectorAll<HTMLElement>('.krs-header [role="group"]'));
        const shown = switches.find((element) => element.offsetParent !== null);
        if (shown) {
          const box = shown.getBoundingClientRect();
          setArrow(Math.max(12, Math.round(window.innerWidth - (box.left + box.width / 2) - edge - 6)));
        }
        setShow(true);
      }, DELAY_MS);
    } catch {
      // A browser with storage blocked is not worth a broken page; it simply
      // never sees the card.
    }

    return () => {
      if (timer) window.clearTimeout(timer);
    };
    // Again on each new page, so a first visit that lands on a shoe is asked
    // on the next shop page instead.
  }, [pathname]);

  // Going to a buying page while it is up puts it out of sight there too.
  if (!show || quietPage(pathname)) return null;

  const answer = (choice: "en" | "ne" | null) => {
    try {
      window.localStorage.setItem(ASKED_KEY, "1");
    } catch {
      // Nothing to do; the card closes either way.
    }
    if (choice) setLanguage(choice);
    setShow(false);
  };

  // A small bubble hanging from the header, under the language switch, on a
  // phone and a laptop alike (owner's shop sample, 5, 2026-10-26). As a strip
  // across the top it covered the logo on a phone, and at the foot on a laptop
  // it covered the "Cash on delivery" card. Here it covers only the top right
  // corner of the page below, points at the switch it is asking about, and the
  // question, the answers and the once-only memory are all as before.
  return (
    <div
      role="region"
      aria-label="भाषा छान्नुहोस् · Choose language"
      style={{ top, ["--arrow" as string]: `${arrow}px` }}
      className="fixed right-2 z-[60] flex max-w-[calc(100vw-1rem)] items-center gap-1.5 rounded-2xl border border-brand-gold/50 bg-brand-paper py-1 pl-3 pr-1 shadow-[0_10px_30px_rgba(11,77,59,0.18)] before:absolute before:-top-1.5 before:right-[var(--arrow)] before:h-3 before:w-3 before:rotate-45 before:border-l before:border-t before:border-brand-gold/50 before:bg-brand-paper lg:right-6"
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
