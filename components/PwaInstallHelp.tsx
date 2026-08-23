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
 * Pages that already own the bottom of a phone screen: the admin dock, and the
 * shop's add-to-cart bar. The card clears those; everywhere else it can sit
 * where a thumb expects it.
 */
function bottomOffset(pathname: string) {
  const hasBottomBar =
    (pathname.startsWith("/admin") && !SIGN_IN_PATHS.includes(pathname))
    || pathname.startsWith("/product/");

  return hasBottomBar
    ? "bottom-[calc(6rem+env(safe-area-inset-bottom))] lg:bottom-4"
    : "bottom-[calc(1rem+env(safe-area-inset-bottom))]";
}

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
export default function PwaInstallHelp() {
  const { text } = useLanguage();
  const pathname = usePathname();
  const [platform, setPlatform] = useState<Platform>(null);
  const [visible, setVisible] = useState(false);
  const [installer, setInstaller] = useState<InstallPrompt | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const dismissed = window.sessionStorage.getItem("krishoe-install-help-dismissed") === "yes";
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

  if (!visible || !platform || SIGN_IN_PATHS.includes(pathname)) return null;

  const close = () => {
    window.sessionStorage.setItem("krishoe-install-help-dismissed", "yes");
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

  return (
    <aside
      className={`fixed inset-x-3 ${bottomOffset(pathname)} z-[60] mx-auto max-w-md rounded-2xl border border-brand-gold/40 bg-brand-green-ink p-4 text-white shadow-2xl lg:inset-x-auto lg:right-4 lg:mx-0 print:hidden`}
      aria-label={text("Install KRISHOE app", "KRISHOE app राख्ने")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* text-white spelled out, not inherited from the card. globals.css
              sets `p { color: var(--ink-body) }`, and a rule matching the
              element directly beats a colour inherited from a parent — so this
              heading rendered in dark body ink on a dark green card and could
              not be read. */}
          <p className="font-black text-white">
            {platform === "desktop" ? "KRISHOE computer मा राख्नुहोस्" : "KRISHOE फोनमा राख्नुहोस्"}
          </p>
          <p className="mt-1 text-sm leading-5 text-white/80">
            {installer
              ? "एक थिचाइमा — app जस्तै खुल्छ, छिटो चल्छ।"
              : platform === "ios"
                ? "In Safari, tap Share, then Add to Home Screen. Open the new KRISHOE icon for the app view."
                : platform === "desktop"
                  ? "In Chrome or Edge, click the Install icon in the address bar — or the three-dot menu, then Install."
                  : "In Chrome, open the three-dot menu and choose Install app or Add to Home screen."}
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label={text("Dismiss install help", "हटाउने")}
          className="shrink-0 text-lg leading-none text-white/70"
        >
          X
        </button>
      </div>

      {/* Only where the browser has actually offered it. A button that opens
          nothing is worse than the sentence it replaced. */}
      {installer ? (
        <button
          type="button"
          onClick={() => void install()}
          disabled={busy}
          className="mt-3 min-h-12 w-full rounded-xl bg-brand-gold px-4 text-sm font-black text-brand-green-ink disabled:opacity-60"
        >
          {busy ? "राख्दैछौँ…" : "📲 अहिले नै राख्नुहोस्"}
        </button>
      ) : null}
    </aside>
  );
}
