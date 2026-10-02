"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * The worker app's text size and its bottom menu (owner, 2026-10-02: "every
 * part a little bigger, and easy").
 *
 * The size is the page's own: it scales the root font, so every rem-sized
 * piece — text, boxes, buttons — grows together. Three steps, starting a step
 * above the shop's own; the phone remembers the choice.
 */
const SIZES = ["112.5%", "125%", "140%"] as const;
const KEY = "krishoe-worker-text";

export function WorkerTextSize() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    let saved = 0;
    try {
      saved = Math.min(SIZES.length - 1, Math.max(0, Number(window.localStorage.getItem(KEY)) || 0));
    } catch {
      saved = 0;
    }
    // After the first paint, so the server's page and the phone's agree first.
    const id = window.setTimeout(() => setStep(saved), 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const before = root.style.fontSize;
    root.style.fontSize = SIZES[step];
    return () => {
      root.style.fontSize = before;
    };
  }, [step]);

  function choose(next: number) {
    setStep(next);
    try {
      window.localStorage.setItem(KEY, String(next));
    } catch {
      // A private window keeps no setting; the size still changes for now.
    }
  }

  return (
    <div className="flex overflow-hidden rounded-xl border border-brand-green-line" role="group" aria-label="अक्षरको साइज · Text size">
      {SIZES.map((_, index) => (
        <button
          key={index}
          type="button"
          aria-pressed={step === index}
          aria-label={["साधारण अक्षर · Normal text", "ठूलो अक्षर · Large text", "धेरै ठूलो अक्षर · Larger text"][index]}
          onClick={() => choose(index)}
          className={`grid h-10 min-w-10 place-items-center px-2 font-black ${step === index ? "bg-brand-green text-white" : "bg-brand-paper text-brand-green-ink"}`}
          style={{ fontSize: `${0.85 + index * 0.18}rem` }}
        >
          अ
        </button>
      ))}
    </div>
  );
}

const TABS = [
  { href: "/worker/dashboard", icon: "🏠", ne: "गृह", en: "Home" },
  { href: "/worker/production", icon: "🧾", ne: "मेरो काम", en: "Work" },
  { href: "/worker/photos", icon: "📷", ne: "फोटो", en: "Photo" },
  { href: "/worker/payslip", icon: "💰", ne: "तलब", en: "Pay" },
] as const;

/** Four big tabs, always at the bottom of the worker's phone. */
export function WorkerTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Worker portal"
      className="fixed inset-x-2 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-40 grid grid-cols-4 gap-1 rounded-3xl border border-brand-green-line bg-brand-paper p-1.5 shadow-[0_12px_32px_rgba(11,77,59,0.18)] print:hidden"
    >
      {TABS.map((tab) => {
        const on = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={on ? "page" : undefined}
            className={`grid min-h-14 place-items-center gap-0.5 rounded-2xl py-1 text-sm font-black ${on ? "bg-brand-green text-white" : "text-brand-green-ink"}`}
          >
            <span aria-hidden="true" className="text-xl leading-none">{tab.icon}</span>
            {tab.ne}
          </Link>
        );
      })}
    </nav>
  );
}
