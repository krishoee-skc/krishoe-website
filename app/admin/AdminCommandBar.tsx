"use client";

import { useEffect, useState } from "react";
import { SearchIcon } from "@/components/Icons";
import { useLanguage } from "@/components/LanguageProvider";
import SearchAsYouType from "@/app/admin/search/SearchAsYouType";
import AdminAskPanel from "./AdminAskPanel";

type Mode = "find" | "ask";

/**
 * The one box that reaches everything, from the top of every admin screen.
 *
 * It does not re-implement search: it opens the same SearchAsYouType the
 * /admin/search page already uses, in an overlay. That component talks to
 * /api/admin/search, which is login-guarded and read-only — it finds pages,
 * products, orders, workers and bills, and never changes any of them. So this
 * bar adds a way in, not a new system: the search page still works untouched,
 * and nothing here can write.
 *
 * Opens on click, on Ctrl/⌘+K, or on "/" when the owner isn't already typing;
 * closes on Esc or on tapping the backdrop.
 */
export default function AdminCommandBar() {
  const { text } = useLanguage();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("find");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if ((event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      } else if (event.key === "/" && !isTyping) {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      {/* The bar itself — a quiet pill the owner taps to open the palette. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={text("Search everything", "सबै खोज्नुहोस्")}
        className="flex h-11 w-full items-center gap-2.5 rounded-xl border border-brand-green-line bg-brand-paper px-3.5 text-left text-brand-muted transition hover:border-brand-green/50 hover:bg-brand-mist"
      >
        <SearchIcon className="h-4.5 w-4.5 shrink-0 text-brand-green" />
        <span className="flex-1 truncate text-sm font-semibold">
          {text("Search or ask about the shop…", "खोज्नुहोस् वा शपबारे सोध्नुहोस्…")}
        </span>
        <kbd className="hidden shrink-0 rounded border border-brand-green-line bg-brand-mist px-1.5 py-0.5 text-[10px] font-bold text-brand-muted sm:inline">
          Ctrl K
        </kbd>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70]">
          <button
            type="button"
            aria-label={text("Close search", "खोज बन्द गर्नुहोस्")}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-brand-green-ink/55 backdrop-blur-sm"
          />
          <div className="absolute left-1/2 top-4 flex max-h-[calc(100dvh-2rem)] w-[min(94vw,600px)] -translate-x-1/2 flex-col overflow-hidden rounded-2xl bg-brand-paper p-4 shadow-2xl sm:top-20 sm:max-h-[80vh]">
            <div className="mb-3 flex items-center gap-2">
              {/* Two ways to use the box: find a thing, or ask about the shop.
                  Find is the default — it is what a search box is for; Ask is
                  the newer, read-only assistant. */}
              <div className="flex rounded-full bg-brand-mist p-0.5">
                <button
                  type="button"
                  onClick={() => setMode("find")}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-black transition ${
                    mode === "find" ? "bg-brand-green-ink text-white" : "text-brand-muted"
                  }`}
                >
                  🔍 {text("Find", "खोज्ने")}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("ask")}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-black transition ${
                    mode === "ask" ? "bg-brand-green-ink text-white" : "text-brand-muted"
                  }`}
                >
                  🤖 {text("Ask", "सोध्ने")}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={text("Close", "बन्द गर्नुहोस्")}
                className="ml-auto grid h-8 w-8 place-items-center rounded-full text-xl leading-none text-brand-muted-soft transition hover:bg-brand-mist hover:text-brand-muted-deep"
              >
                ×
              </button>
            </div>
            {mode === "find" ? (
              /* Tapping a result navigates, which unmounts this overlay, so the
                 links close it on their own — no extra wiring needed. */
              <div className="min-h-0 overflow-y-auto" onClick={(event) => {
                const target = event.target as HTMLElement;
                if (target.closest("a")) setOpen(false);
              }}>
                <SearchAsYouType />
              </div>
            ) : (
              /* Ask keeps the overlay open on a link tap only for its fact
                 tiles, which the panel itself closes over; here we let those
                 through so the owner lands on the page they tapped. */
              <div className="flex min-h-0 flex-1 flex-col" onClick={(event) => {
                const target = event.target as HTMLElement;
                if (target.closest("a")) setOpen(false);
              }}>
                <AdminAskPanel />
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
