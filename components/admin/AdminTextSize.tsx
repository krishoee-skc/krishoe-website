"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * The admin's text size (owner, 2026-10-13, "7"): normal, large, larger — the
 * same idea as the worker app's. It scales the root font, so every rem-sized
 * piece (text, boxes, buttons) grows together; the body's own 16px is set to
 * 1rem while it is on, so plain text grows too. The phone remembers the choice.
 *
 * Three steps side by side: in the top bar on a tablet or computer, and in
 * the account panel behind the round initials on a phone (owner, 2026-10-14).
 * Both read one stored step, and one applier (in the layout) sets the size,
 * so a switch opened and closed in a panel cannot put an old size back.
 */
const SIZES = ["100%", "112.5%", "125%"] as const;
const KEY = "krishoe-admin-text";
const CHANGED = "krishoe:admin-text-size";
const NAMES = [
  { en: "Normal text", ne: "साधारण अक्षर" },
  { en: "Large text", ne: "ठूलो अक्षर" },
  { en: "Larger text", ne: "धेरै ठूलो अक्षर" },
] as const;

function storedStep() {
  try {
    return Math.min(SIZES.length - 1, Math.max(0, Number(window.localStorage.getItem(KEY)) || 0));
  } catch {
    return 0;
  }
}

// What was chosen this visit, for a private window where storage refuses it.
let chosenThisVisit: number | null = null;
const currentStep = () => chosenThisVisit ?? storedStep();

function subscribe(listener: () => void) {
  window.addEventListener(CHANGED, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGED, listener);
    window.removeEventListener("storage", listener);
  };
}

function apply(step: number) {
  const root = document.documentElement;
  const body = document.body;
  if (step > 0) {
    root.style.fontSize = SIZES[step];
    body.style.fontSize = "1rem";
  } else {
    root.style.fontSize = "";
    body.style.fontSize = "";
  }
}

function choose(next: number) {
  chosenThisVisit = next;
  try {
    window.localStorage.setItem(KEY, String(next));
  } catch {
    // A private window keeps no setting; the size still changes for now.
  }
  window.dispatchEvent(new Event(CHANGED));
}

/** Sets the chosen size on the page while the admin is open, and takes it off after. */
export function AdminTextSizeApplier() {
  useEffect(() => {
    // After the first paint, so the server's page and the phone's agree first.
    const id = window.setTimeout(() => apply(currentStep()), 0);
    const onChange = () => apply(currentStep());
    const stop = subscribe(onChange);
    return () => {
      window.clearTimeout(id);
      stop();
      apply(0);
    };
  }, []);
  return null;
}

export default function AdminTextSize() {
  const { text } = useLanguage();
  const step = useSyncExternalStore(subscribe, currentStep, () => 0);
  const label = (index: number) => text(NAMES[index].en, NAMES[index].ne);

  return (
    <div className="flex shrink-0 overflow-hidden rounded-xl border border-brand-green-line" role="group" aria-label={text("Text size", "अक्षरको साइज")}>
      {SIZES.map((_, index) => (
        <button
          key={index}
          type="button"
          aria-pressed={step === index}
          aria-label={label(index)}
          title={label(index)}
          onClick={() => choose(index)}
          className={`grid h-11 min-w-11 place-items-center px-2 font-black ${step === index ? "bg-brand-green text-white" : "bg-brand-paper text-brand-green-ink"}`}
          style={{ fontSize: `${0.85 + index * 0.18}rem` }}
        >
          अ
        </button>
      ))}
    </div>
  );
}
