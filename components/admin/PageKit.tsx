"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { roundedMoney } from "@/lib/format-money";

/**
 * The one frame every admin screen is drawn in (owner, 2026-10-12): the part
 * of the business and the screen's name, three figures, tabs, then the list.
 * Each page used to lay itself out its own way — fifteen kinds of title, long
 * single scrolls of a dozen parts — so a phone had to scroll past everything
 * to reach the one thing it came for. Nothing is taken away: the parts that
 * stood one under another now sit behind tabs.
 */

export function PageHead({
  eyebrow,
  title,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Buttons beside the title — the page's own, not the main one. */
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-green">{eyebrow}</p> : null}
        <h1 className="mt-1 font-display text-2xl font-black leading-tight text-brand-green-ink sm:text-3xl">{title}</h1>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export type StatItem = {
  en: string;
  ne: string;
  value: number | string;
  /** A rupee figure: hidden behind the eye until shown, as on the dashboard. */
  money?: boolean;
  tone?: "warn" | "good";
};

/**
 * Three figures in one short row — the ones the screen is about. On a phone
 * they stay three across; rupee figures start hidden behind 👁 (owner, the
 * dashboard's rule: money is shown when asked for).
 */
export function StatStrip({ items }: { items: StatItem[] }) {
  const { text } = useLanguage();
  const [shown, setShown] = useState(false);
  const hasMoney = items.some((item) => item.money);
  return (
    <div className="grid gap-2">
      <div className={`grid gap-2 ${items.length >= 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
        {items.map((item) => {
          const tone =
            item.tone === "warn"
              ? "border-transparent bg-brand-clay-tint text-brand-clay"
              : item.tone === "good"
                ? "border-transparent bg-brand-green-wash text-brand-green"
                : "border-brand-green-line bg-brand-paper text-brand-green-ink";
          const value =
            item.money && !shown
              ? `${text("Rs.", "रु.")} ••••`
              : item.money && typeof item.value === "number"
                ? roundedMoney(item.value)
                : typeof item.value === "number"
                  ? item.value.toLocaleString("en-IN")
                  : item.value;
          return (
            <div key={item.en} className={`grid min-w-0 content-start gap-0.5 rounded-2xl border px-3 py-2 ${tone}`}>
              <span className="truncate font-display text-lg font-black leading-tight tabular-nums sm:text-2xl" data-figure-hidden={item.money && !shown ? "" : undefined}>
                {value}
              </span>
              <span className="text-[11px] font-bold leading-tight opacity-80 sm:text-xs">{text(item.en, item.ne)}</span>
            </div>
          );
        })}
      </div>
      {hasMoney ? (
        <button
          type="button"
          onClick={() => setShown((open) => !open)}
          aria-pressed={shown}
          className="w-fit min-h-9 rounded-full border border-brand-green-line bg-brand-paper px-3 text-xs font-black text-brand-green-ink print:hidden"
        >
          {shown ? text("🙈 Hide amounts", "🙈 रकम लुकाउने") : text("👁 Show amounts", "👁 रकम हेर्ने")}
        </button>
      ) : null}
    </div>
  );
}

export type PageTab = {
  key: string;
  en: string;
  ne: string;
  /** A count beside the name — red when it is work waiting. */
  count?: number;
  content: ReactNode;
  /** Its place in the wide layout when every part shows at once. */
  wideClassName?: string;
};

/**
 * The parts of a screen behind tabs. Every part is rendered, only the chosen
 * one shows, so forms keep what was typed when the tab changes and printing
 * shows them all. The tab chosen is remembered for that screen.
 *
 * A link to a part by its id (#move-pairs, #stock-to-fill — the dashboard and
 * other screens use them) opens the tab that holds it and scrolls there.
 */
export function PageTabs({
  id,
  tabs,
  openOnWide = false,
  wideGridClassName,
}: {
  id: string;
  tabs: PageTab[];
  /** On a wide screen every part shows at once and the tabs step aside — a
   *  phone gets the tabs, a computer the whole page (the dashboard). */
  openOnWide?: boolean;
  /** The wide layout of the parts, when they all show (e.g. two columns). */
  wideGridClassName?: string;
}) {
  const { text } = useLanguage();
  const storageKey = `krishoe:tab:${id}`;
  const [active, setActive] = useState(tabs[0]?.key ?? "");

  useEffect(() => {
    function fromHash() {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (!hash) return false;
      const target = document.getElementById(hash);
      const panel = target?.closest<HTMLElement>("[data-tab-panel]");
      const key = panel?.dataset.tabPanel;
      if (!key || !tabs.some((tab) => tab.key === key)) return false;
      setActive(key);
      window.setTimeout(() => target?.scrollIntoView({ block: "start" }), 0);
      return true;
    }
    if (!fromHash()) {
      try {
        const saved = window.localStorage.getItem(storageKey);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- the remembered tab is read from the browser after hydration, intentional
        if (saved && tabs.some((tab) => tab.key === saved)) setActive(saved);
      } catch {
        // Private windows may refuse storage; the first tab is fine.
      }
    }
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
    // The tabs of a screen do not change while it is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  function choose(key: string) {
    setActive(key);
    try {
      window.localStorage.setItem(storageKey, key);
    } catch {
      // Remembering the tab is a convenience only.
    }
  }

  return (
    <div className="grid gap-4">
      <div
        role="tablist"
        aria-label={text("Parts of this screen", "यो पानाका भाग")}
        className={`-mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] print:hidden ${openOnWide ? "lg:hidden" : ""}`}
      >
        {tabs.map((tab) => {
          const on = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={`tab-${id}-${tab.key}`}
              onClick={() => choose(tab.key)}
              className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-black ${
                on ? "border-brand-green bg-brand-green text-white" : "border-brand-green-line bg-brand-paper text-brand-green-ink"
              }`}
            >
              {text(tab.en, tab.ne)}
              {tab.count ? (
                <span className={`grid min-w-5 place-items-center rounded-full px-1.5 text-[11px] ${on ? "bg-white/25" : "bg-brand-clay text-white"}`}>
                  {tab.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className={wideGridClassName ?? "contents"}>
      {tabs.map((tab) => (
        <div
          key={tab.key}
          id={`tab-${id}-${tab.key}`}
          role="tabpanel"
          data-tab-panel={tab.key}
          className={`grid min-w-0 content-start gap-4 ${tab.wideClassName ?? ""} ${tab.key === active ? "" : openOnWide ? "hidden print:grid lg:grid" : "hidden print:grid"}`}
        >
          {tab.content}
        </div>
      ))}
      </div>
    </div>
  );
}
