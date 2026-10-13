"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * The admin's text size (owner, 2026-10-13, "7"): normal, large, larger — the
 * same idea as the worker app's. It scales the root font, so every rem-sized
 * piece (text, boxes, buttons) grows together; the body's own 16px is set to
 * 1rem while it is on, so plain text grows too. The phone remembers the choice.
 *
 * A computer shows the three steps; a phone, where the top row is the search
 * and the language, shows one button that steps through them.
 */
const SIZES = ["100%", "112.5%", "125%"] as const;
const KEY = "krishoe-admin-text";
const NAMES = [
  { en: "Normal text", ne: "साधारण अक्षर" },
  { en: "Large text", ne: "ठूलो अक्षर" },
  { en: "Larger text", ne: "धेरै ठूलो अक्षर" },
] as const;

export default function AdminTextSize() {
  const { text } = useLanguage();
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
    const body = document.body;
    const before = { root: root.style.fontSize, body: body.style.fontSize };
    if (step > 0) {
      root.style.fontSize = SIZES[step];
      body.style.fontSize = "1rem";
    }
    return () => {
      root.style.fontSize = before.root;
      body.style.fontSize = before.body;
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

  const label = (index: number) => text(NAMES[index].en, NAMES[index].ne);

  return (
    <>
      <button
        type="button"
        onClick={() => choose((step + 1) % SIZES.length)}
        aria-label={`${text("Text size", "अक्षरको साइज")}: ${label(step)}`}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-brand-green-line bg-brand-paper font-black text-brand-green-ink sm:hidden"
        style={{ fontSize: `${1 + step * 0.18}rem` }}
      >
        अ
      </button>
      <div className="hidden shrink-0 overflow-hidden rounded-xl border border-brand-green-line sm:flex" role="group" aria-label={text("Text size", "अक्षरको साइज")}>
        {SIZES.map((_, index) => (
          <button
            key={index}
            type="button"
            aria-pressed={step === index}
            aria-label={label(index)}
            title={label(index)}
            onClick={() => choose(index)}
            className={`grid h-11 min-w-10 place-items-center px-2 font-black ${step === index ? "bg-brand-green text-white" : "bg-brand-paper text-brand-green-ink"}`}
            style={{ fontSize: `${0.85 + index * 0.18}rem` }}
          >
            अ
          </button>
        ))}
      </div>
    </>
  );
}
