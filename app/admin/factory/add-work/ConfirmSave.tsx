"use client";

import type { RefObject } from "react";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * The question before writing: what is about to be saved, and whether the day
 * already has it. Enter says yes, Esc goes back.
 *
 * Split out of the work-entry form (2026-10-27); unchanged. The form keeps
 * the "Yes" button's ref, so Enter can land on it.
 */
export default function ConfirmSave({
  duplicate,
  summary,
  yesRef,
  onYes,
  onCancel,
}: {
  duplicate: boolean;
  summary: string;
  yesRef: RefObject<HTMLButtonElement>;
  onYes: () => void;
  onCancel: () => void;
}) {
  const { text } = useLanguage();
  return (
    <div
      role="alertdialog"
      aria-labelledby="work-confirm-text"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
      className={`rounded-lg border-2 p-3 ${duplicate ? "border-amber-400 bg-amber-50" : "border-brand-gold bg-brand-gold/10"}`}
    >
      {duplicate ? (
        <p className="mb-1 text-sm font-black text-amber-900">
          ⚠️ {text("This looks already entered today.", "यो आज टिपिसकेको जस्तो छ।")}
        </p>
      ) : null}
      <p id="work-confirm-text" className="text-sm font-bold text-brand-green-ink">
        {summary} — {text("save?", "टिप्ने?")}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          ref={yesRef}
          onClick={onYes}
          className="min-h-11 rounded-lg bg-brand-green px-4 text-sm font-black text-white focus:outline-none focus:ring-4 focus:ring-brand-gold"
        >
          {text("Yes, save (Enter)", "हो, टिप्ने (Enter)")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-lg border border-brand-green-line px-4 text-sm font-bold text-brand-green-ink"
        >
          {text("Go back (Esc)", "फर्किने (Esc)")}
        </button>
      </div>
    </div>
  );
}
