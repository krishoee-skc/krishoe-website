"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type MobilePlatform = "ios" | "android" | null;

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
    ? "bottom-[calc(6rem+env(safe-area-inset-bottom))]"
    : "bottom-[calc(1rem+env(safe-area-inset-bottom))]";
}

export default function PwaInstallHelp() {
  const pathname = usePathname();
  const [platform, setPlatform] = useState<MobilePlatform>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const dismissed = window.sessionStorage.getItem("krishoe-install-help-dismissed") === "yes";
    const agent = navigator.userAgent;
    const nextPlatform: MobilePlatform = /iPad|iPhone|iPod/.test(agent)
      ? "ios"
      : /Android/i.test(agent)
        ? "android"
        : null;

    const updateId = window.setTimeout(() => {
      setPlatform(nextPlatform);
      setVisible(Boolean(nextPlatform && !standalone && !dismissed));
    }, 0);

    return () => window.clearTimeout(updateId);
  }, []);

  if (!visible || !platform || SIGN_IN_PATHS.includes(pathname)) return null;

  const close = () => {
    window.sessionStorage.setItem("krishoe-install-help-dismissed", "yes");
    setVisible(false);
  };

  return (
    <aside
      className={`fixed inset-x-3 ${bottomOffset(pathname)} z-[60] mx-auto max-w-md rounded-2xl border border-brand-gold/40 bg-brand-green-ink p-4 text-white shadow-2xl lg:hidden print:hidden`}
      aria-label="Install KRISHOE app"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black">Add KRISHOE to your Home Screen</p>
          {/* Left in English on purpose: "Share" and "Add to Home Screen" are
              the words printed on the phone's own menu, and a translation would
              send the reader looking for a label that is not there. */}
          <p className="mt-1 text-sm leading-5 text-white/80">
            {platform === "ios"
              ? "In Safari, tap Share, then Add to Home Screen. Open the new KRISHOE icon for the app view."
              : "In Chrome, open the three-dot menu and choose Install app or Add to Home screen."}
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-lg font-black"
          aria-label="Dismiss install help"
        >
          X
        </button>
      </div>
    </aside>
  );
}
