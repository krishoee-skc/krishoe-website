"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { TodayStrip, type TodayFigures } from "@/app/admin/pos/_components/PosBillParts";

/**
 * The counter's three tabs (owner, 2026-10-31, the approved namuna): the bill,
 * today's bills and the cheques, so the bill stays on one screen instead of a
 * long page. A tab only hides what is under the others: a half-made bill keeps
 * everything typed on it.
 */

export type CounterTab = "bill" | "bills" | "cheques";

type Tabs = { tab: CounterTab; setTab: (tab: CounterTab) => void; billCount: number; chequeCount: number };

const TabsContext = createContext<Tabs | null>(null);

/** Outside the tabs (the reports view) there are none, and every panel shows. */
export function useCounterTabs() {
  return useContext(TabsContext);
}

export function CounterTabs({
  on,
  billCount,
  chequeCount,
  children,
}: {
  on: boolean;
  billCount: number;
  chequeCount: number;
  children: ReactNode;
}) {
  const [tab, setTab] = useState<CounterTab>("bill");
  const value = useMemo(() => ({ tab, setTab, billCount, chequeCount }), [tab, billCount, chequeCount]);
  return <TabsContext.Provider value={on ? value : null}>{children}</TabsContext.Provider>;
}

export function CounterPanel({ tab, className, children }: { tab: CounterTab; className?: string; children: ReactNode }) {
  const tabs = useCounterTabs();
  return (
    <div className={className} hidden={Boolean(tabs) && tabs?.tab !== tab}>
      {children}
    </div>
  );
}

export function CounterTabButtons({ onPicked }: { onPicked?: () => void }) {
  const { text } = useLanguage();
  const tabs = useCounterTabs();
  if (!tabs) return null;
  const options: Array<{ key: CounterTab; label: string }> = [
    { key: "bill", label: `🧾 ${text("Bill", "बिल")}` },
    { key: "bills", label: text(`Today's bills (${tabs.billCount})`, `आजका बिल (${tabs.billCount})`) },
    ...(tabs.chequeCount > 0
      ? [{ key: "cheques" as const, label: text(`Cheques (${tabs.chequeCount})`, `चेक (${tabs.chequeCount})`) }]
      : []),
  ];
  return (
    <>
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={tabs.tab === option.key}
          onClick={() => {
            tabs.setTab(option.key);
            onPicked?.();
          }}
          className={`min-h-10 shrink-0 border-b-[3px] px-3 text-sm font-black ${
            tabs.tab === option.key
              ? "border-brand-green text-brand-green"
              : option.key === "cheques"
                ? "border-transparent text-brand-gold-deep"
                : "border-transparent text-brand-muted hover:text-brand-green-ink"
          }`}
        >
          {option.label}
        </button>
      ))}
    </>
  );
}

/**
 * The row of tabs with today's figures beside it. On a phone the tabs live in
 * the bill's "Change" panel, and show here only to come back to the bill.
 */
export function CounterTabBar({ today }: { today: TodayFigures }) {
  const tabs = useCounterTabs();
  if (!tabs) return null;
  return (
    <div
      className={`mt-1 items-center gap-x-3 border-b border-brand-green-line max-md:-order-2 ${tabs.tab === "bill" ? "hidden md:flex" : "flex"}`}
    >
      <div className="flex min-w-0 overflow-x-auto [scrollbar-width:none]">
        <CounterTabButtons />
      </div>
      <div className="ml-auto hidden min-w-0 md:block">
        <TodayStrip today={today} bare />
      </div>
    </div>
  );
}
