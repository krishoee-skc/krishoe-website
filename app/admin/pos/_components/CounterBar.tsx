"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { useLanguage } from "@/components/LanguageProvider";

function onFullscreenChange(callback: () => void) {
  document.addEventListener("fullscreenchange", callback);
  return () => document.removeEventListener("fullscreenchange", callback);
}

function never() {
  return () => {};
}

/** The counter on a computer: ⛶ pressed, remembered on this device. */
const FULL_KEY = "krishoe-counter-full";
const FULL_EVENT = "krishoe-counter-full-change";

function readCounterFull() {
  try {
    return window.localStorage.getItem(FULL_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCounterFull(full: boolean) {
  try {
    if (full) window.localStorage.setItem(FULL_KEY, "1");
    else window.localStorage.removeItem(FULL_KEY);
  } catch {
    // Private window: it lasts until the page is left.
  }
  window.dispatchEvent(new Event(FULL_EVENT));
}

function onCounterFull(callback: () => void) {
  window.addEventListener(FULL_EVENT, callback);
  return () => window.removeEventListener(FULL_EVENT, callback);
}

/**
 * The one strip left above the counter bill.
 *
 * Its `data-counter-mode` is what turns the admin frame off: while it is on
 * the page, globals.css hides the sidebar, the top search row, the coloured
 * band and the phone's dock, so the shelf and the bill get the whole screen.
 * CSS rather than an effect, so the first paint is already full-screen — no
 * flash of the frame before it goes.
 *
 * ⛶ asks the browser for real full screen too (its own tabs and address bar
 * gone), where the browser allows it; Esc brings them back.
 *
 * `framed` is the counter bill on a computer (owner, 2026-10-31): the frame
 * and the menu stay, and this strip is a plain row, until ⛶ is pressed.
 */
type Words = { en: string; ne: string };

export default function CounterBar({
  title = { en: "🧾 Cut a bill", ne: "🧾 बिल काट्ने" },
  reportsHref = "/admin/pos?view=reports",
  reportsLabel = { en: "Reports", ne: "रिपोर्ट" },
  fromTransactions = false,
  framed = false,
}: {
  title?: Words;
  reportsHref?: string;
  reportsLabel?: Words;
  /** Opened from the Transactions page: the way back is to it, not the admin home. */
  fromTransactions?: boolean;
  /** Keeps the admin frame on a computer until ⛶ is pressed. */
  framed?: boolean;
} = {}) {
  const { text } = useLanguage();
  // Read from the browser, not copied into state: false on the server, the
  // real answer once the page is in the browser.
  const full = useSyncExternalStore(onFullscreenChange, () => Boolean(document.fullscreenElement), () => false);
  const canFull = useSyncExternalStore(never, () => Boolean(document.fullscreenEnabled), () => false);

  const counterFull = useSyncExternalStore(onCounterFull, readCounterFull, () => false);
  const showFramed = framed && !counterFull;
  const isFull = framed ? counterFull : full;

  // Esc leaves the browser's full screen: the menu comes back with it.
  useEffect(() => {
    if (!framed) return;
    const left = () => {
      if (!document.fullscreenElement) writeCounterFull(false);
    };
    document.addEventListener("fullscreenchange", left);
    return () => document.removeEventListener("fullscreenchange", left);
  }, [framed]);

  function toggleFull() {
    if (framed) writeCounterFull(!isFull);
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else if (!framed || !isFull) {
      void document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }

  return (
    <div
      data-counter-mode={showFramed ? "framed" : "full"}
      className={`sticky top-0 z-40 -mx-4 -mt-4 mb-3 flex items-center justify-between gap-2 bg-brand-green px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] text-sm font-black text-white max-md:-order-3 sm:-mx-6 sm:-mt-6 sm:px-6 print:hidden ${
        showFramed ? "md:!static md:!m-0 md:bg-transparent md:!p-0 md:text-brand-green-ink" : ""
      }`}
    >
      <Link
        href={fromTransactions ? "/admin/transactions" : "/admin"}
        className={`inline-flex min-h-10 items-center rounded-full px-2 hover:bg-white/10 ${showFramed && !fromTransactions ? "md:hidden" : ""}`}
        title={fromTransactions ? text("Back to Transactions", "कारोबारमा फर्कने") : text("Back to the admin", "Admin मा फर्कने")}
      >
        {fromTransactions ? "← Transactions" : "← Admin"}
      </Link>
      <span className="truncate">{text(title.en, title.ne)}</span>
      <span className="flex items-center gap-1">
        <Link
          href={reportsHref}
          className="inline-flex min-h-10 items-center rounded-full px-2 hover:bg-white/10"
          title={text(reportsLabel.en, reportsLabel.ne)}
        >
          📊 <span className="ml-1 hidden sm:inline">{text(reportsLabel.en, reportsLabel.ne)}</span>
        </Link>
        {canFull || framed ? (
          <button
            type="button"
            onClick={toggleFull}
            aria-label={isFull ? text("Leave full screen", "पूरा स्क्रिन बन्द") : text("Full screen", "पूरा स्क्रिन")}
            title={isFull ? text("Leave full screen (Esc)", "पूरा स्क्रिन बन्द (Esc)") : text("Full screen", "पूरा स्क्रिन")}
            className="hidden min-h-10 items-center rounded-full px-2 text-base hover:bg-white/10 md:inline-flex"
          >
            {isFull ? "🗗" : "⛶"}
          </button>
        ) : null}
      </span>
    </div>
  );
}
