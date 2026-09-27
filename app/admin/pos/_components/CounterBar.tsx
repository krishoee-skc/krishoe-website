"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useLanguage } from "@/components/LanguageProvider";

function onFullscreenChange(callback: () => void) {
  document.addEventListener("fullscreenchange", callback);
  return () => document.removeEventListener("fullscreenchange", callback);
}

function never() {
  return () => {};
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
 */
type Words = { en: string; ne: string };

export default function CounterBar({
  title = { en: "🧾 Cut a bill", ne: "🧾 बिल काट्ने" },
  reportsHref = "/admin/pos?view=reports",
  reportsLabel = { en: "Reports", ne: "रिपोर्ट" },
}: {
  title?: Words;
  reportsHref?: string;
  reportsLabel?: Words;
} = {}) {
  const { text } = useLanguage();
  // Read from the browser, not copied into state: false on the server, the
  // real answer once the page is in the browser.
  const full = useSyncExternalStore(onFullscreenChange, () => Boolean(document.fullscreenElement), () => false);
  const canFull = useSyncExternalStore(never, () => Boolean(document.fullscreenEnabled), () => false);

  function toggleFull() {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  return (
    <div
      data-counter-mode
      className="sticky top-0 z-40 -mx-4 -mt-4 mb-3 flex items-center justify-between gap-2 bg-brand-green px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] text-sm font-black text-white max-md:-order-3 sm:-mx-6 sm:-mt-6 sm:px-6 print:hidden"
    >
      <Link
        href="/admin"
        className="inline-flex min-h-10 items-center rounded-full px-2 hover:bg-white/10"
        title={text("Back to the admin", "Admin मा फर्कने")}
      >
        ← Admin
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
        {canFull ? (
          <button
            type="button"
            onClick={toggleFull}
            aria-label={full ? text("Leave full screen", "पूरा स्क्रिन बन्द") : text("Full screen", "पूरा स्क्रिन")}
            title={full ? text("Leave full screen (Esc)", "पूरा स्क्रिन बन्द (Esc)") : text("Full screen", "पूरा स्क्रिन")}
            className="hidden min-h-10 items-center rounded-full px-2 text-base hover:bg-white/10 md:inline-flex"
          >
            {full ? "🗗" : "⛶"}
          </button>
        ) : null}
      </span>
    </div>
  );
}
