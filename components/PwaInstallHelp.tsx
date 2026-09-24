"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

type Platform = "ios" | "android" | "desktop" | null;

/**
 * Chrome's own install event. It is not in the DOM types, and the only two
 * things anyone needs from it are here.
 */
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Signing in is the one thing this must never sit on top of.
 *
 * The card floats above the fold of the page, and on a sign-in screen — which
 * has no bottom bar to clear — it landed across the password field and half the
 * Unlock button, so the first thing a phone showed was a tip covering the form
 * it was tipping about. Installing before signing in is also backwards: the
 * icon is worth having once someone is using the app, not before they are in.
 */
const SIGN_IN_PATHS = [
  "/admin/login",
  "/admin/forgot-password",
  "/admin/reset-password",
  "/admin/accept-invite",
  "/admin/change-password",
  "/worker/login",
  "/account/login",
  "/account/register",
  "/account/reset-password",
  "/account/verify-email",
];

/**
 * The pages where a shopper is deciding or paying. A card about installing an
 * app, over the price, the Buy button or the order total, is the wrong thing at
 * the wrong moment — on a small phone it covered the shoe's name and price.
 */
function isBuyingPage(pathname: string) {
  return pathname.startsWith("/product/")
    || pathname === "/cart"
    || pathname.startsWith("/checkout")
    || pathname.startsWith("/order");
}

/**
 * Above the tab bar on a phone, where it used to overlap it: the tab bar is
 * 4.4rem tall from 0.65rem up, and the card sat at 1rem, across its top half.
 */
const BOTTOM_OFFSET = "bottom-[calc(6.25rem+env(safe-area-inset-bottom))] lg:bottom-4";

/** Pages seen, across visits. The offer waits for someone who is browsing. */
const VIEWS_KEY = "krishoe-page-views";
const VIEWS_BEFORE_ASKING = 3;

/**
 * Putting KRISHOE on the phone's home screen.
 *
 * This used to be instructions only: "open the three-dot menu and choose
 * Install app". Chrome offers a real one-press install through
 * beforeinstallprompt, and the event was going unused — so a shopper who would
 * have tapped a button was asked to go hunting in a browser menu instead, which
 * almost nobody does. Now Android gets the button and iOS keeps the words,
 * because Safari has no equivalent and Apple gives no way to ask.
 *
 * The device words stay in English — Share, Add to Home Screen, Install app —
 * because those are the labels printed on the phone's own menu, and translating
 * them sends the reader looking for something that is not there.
 */
/** Set the first time the shop is opened from the home screen. */
const INSTALLED_KEY = "krishoe-installed";

/** Set when the card is closed. Both outlive the tab, which is the point. */
const DISMISSED_KEY = "krishoe-install-help-dismissed";

export default function PwaInstallHelp() {
  const { text } = useLanguage();
  const pathname = usePathname();
  const [platform, setPlatform] = useState<Platform>(null);
  const [visible, setVisible] = useState(false);
  const [installer, setInstaller] = useState<InstallPrompt | null>(null);
  const [busy, setBusy] = useState(false);
  const [views, setViews] = useState(0);
  const [languageSettled, setLanguageSettled] = useState(false);
  const [howTo, setHowTo] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));

    // Running from the home screen is proof it was installed. Written down,
    // because Safari cannot be asked later: a browser tab has no way to know
    // whether this site is sitting on the home screen beside it, so without
    // this the shop keeps offering to install something already installed.
    if (standalone) {
      try {
        window.localStorage.setItem(INSTALLED_KEY, "yes");
      } catch {
        // Storage blocked. The card will ask again; that is the lesser harm.
      }
    }

    // localStorage, not session. The owner had a dozen Safari tabs open, and
    // sessionStorage is per tab — the card had been dismissed and came back
    // with every new one, on a phone where the app was already installed.
    let remembered = false;
    try {
      remembered =
        window.localStorage.getItem(DISMISSED_KEY) === "yes" ||
        window.localStorage.getItem(INSTALLED_KEY) === "yes";
    } catch {
      remembered = false;
    }
    const dismissed = remembered;
    const agent = navigator.userAgent;
    // Desktop counts. Chrome and Edge on Windows install a PWA the same way
    // Android does, and the card was hidden there twice over — `lg:hidden` in
    // the markup and a platform check that returned null for anything that was
    // not a phone. The owner runs the shop from a computer at the desk.
    const nextPlatform: Platform = /iPad|iPhone|iPod/.test(agent)
      ? "ios"
      : /Android/i.test(agent)
        ? "android"
        : "desktop";

    const updateId = window.setTimeout(() => {
      setPlatform(nextPlatform);
      setVisible(Boolean(nextPlatform && !standalone && !dismissed));
    }, 0);

    // Caught and kept, not left to Chrome's own strip at the bottom of the
    // screen, which most people close without reading.
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstaller(event as InstallPrompt);
    };
    // Once it is on the home screen there is nothing left to offer.
    const onInstalled = () => {
      try {
        window.localStorage.setItem(INSTALLED_KEY, "yes");
      } catch {
        // Nothing to do; the card is closing regardless.
      }
      setVisible(false);
      setInstaller(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.clearTimeout(updateId);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Counted per page, and read with whether the language question is done:
  // one card at a time at the foot of the screen, and the language one first.
  // It asked on the very first page of a first visit, over the first thing a
  // shopper saw, and alongside the language card and the tab bar.
  useEffect(() => {
    let count = 0;
    let settled = true;
    try {
      count = Number(window.localStorage.getItem(VIEWS_KEY) ?? "0") + 1;
      window.localStorage.setItem(VIEWS_KEY, String(count));
      settled = Boolean(
        window.localStorage.getItem("krishoe-language-asked") || window.localStorage.getItem("krishoe-language"),
      );
    } catch {
      // Storage blocked: never counted, never asked. The menu still installs.
    }
    const id = window.setTimeout(() => {
      setViews(count);
      setLanguageSettled(settled);
    }, 0);
    return () => window.clearTimeout(id);
  }, [pathname]);

  if (
    !visible
    || !platform
    || SIGN_IN_PATHS.includes(pathname)
    || isBuyingPage(pathname)
    || views < VIEWS_BEFORE_ASKING
    || !languageSettled
  ) return null;

  const close = () => {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "yes");
    } catch {
      // Nothing to do; the card closes either way.
    }
    setVisible(false);
  };

  const install = async () => {
    if (!installer) return;
    setBusy(true);
    try {
      await installer.prompt();
      const { outcome } = await installer.userChoice;
      // Spent either way: Chrome will not let the same event be shown twice.
      setInstaller(null);
      if (outcome === "accepted") setVisible(false);
    } finally {
      setBusy(false);
    }
  };

  // One line, not a card. The card was 135–155px tall — on a small phone a
  // quarter of the screen — and said everything at once. Now the one-tap
  // button where the browser offers it; elsewhere "How?" opens the words.
  const instructions = platform === "ios"
    ? "In Safari, tap Share, then Add to Home Screen. Open the new KRISHOE icon for the app view."
    : platform === "desktop"
      ? "In Chrome or Edge, click the Install icon in the address bar — or the three-dot menu, then Install."
      : "In Chrome, open the three-dot menu and choose Install app or Add to Home screen.";

  return (
    <>
    {/* Room for the bar at the end of the page. It floats over the last
        80px of whatever is on screen, and at the foot of a page that was the
        footer's last line — Privacy, Terms and the staff door could not be
        tapped. On a phone only; the desktop card sits in a corner. */}
    <div aria-hidden="true" className="max-lg:h-20 print:hidden" />
    <aside
      className={`fixed inset-x-3 ${BOTTOM_OFFSET} z-[60] mx-auto max-w-md rounded-2xl border border-brand-gold/40 bg-brand-green-ink px-3 py-2 text-white shadow-xl lg:inset-x-auto lg:right-4 lg:mx-0 print:hidden`}
      aria-label={text("Install KRISHOE app", "KRISHOE app राख्ने")}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-xl leading-none">📲</span>
        {/* text-white spelled out, not inherited from the card. globals.css
            sets `p { color: var(--ink-body) }`, and a rule matching the
            element directly beats a colour inherited from a parent — so this
            heading rendered in dark body ink on a dark green card and could
            not be read. */}
        <p className="min-w-0 flex-1 text-sm font-black leading-5 text-white">
          {platform === "desktop"
            ? text("Put KRISHOE on this computer", "KRISHOE computer मा राख्नुहोस्")
            : text("Put KRISHOE on your phone", "KRISHOE फोनमा राख्नुहोस्")}
        </p>
        {/* Only where the browser has actually offered it. A button that opens
            nothing is worse than the sentence it replaced. */}
        {installer ? (
          <button
            type="button"
            onClick={() => void install()}
            disabled={busy}
            className="min-h-11 shrink-0 rounded-xl bg-brand-gold px-4 text-sm font-black text-brand-green-ink disabled:opacity-60"
          >
            {busy ? text("Adding…", "राख्दैछौँ…") : text("📲 Add it now", "📲 अहिले नै राख्नुहोस्")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setHowTo((open) => !open)}
            aria-expanded={howTo}
            className="min-h-11 shrink-0 rounded-xl border border-white/30 px-3 text-sm font-bold text-white"
          >
            {text("How?", "कसरी?")}
          </button>
        )}
        <button
          type="button"
          onClick={close}
          aria-label={text("Dismiss install help", "हटाउने")}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg leading-none text-white/80 hover:bg-white/10"
        >
          ✕
        </button>
      </div>
      {howTo && !installer ? (
        <p className="mt-1 pl-8 pr-2 text-sm leading-5 text-white/85">{instructions}</p>
      ) : null}
    </aside>
    </>
  );
}
