"use client";

import type { ReactNode } from "react";
import { useLanguage } from "@/components/LanguageProvider";

// A submit button that asks first. Delete actions across the admin sat one
// mis-tap away from removing a record with no undo; this puts a confirm in
// front of any of them. Pass className to keep each button's existing look.
type ConfirmDeleteButtonProps = {
  label?: string;
  message?: string;
  /** The question in both languages, asked in the screen's language. */
  ask?: { en: string; ne: string };
  /** What the button shows, when it is more than a word (a pair, an icon). */
  children?: ReactNode;
  className?: string;
};

const defaultClass =
  "h-9 rounded-full border border-red-200 px-3 text-xs font-bold text-red-700 transition hover:bg-red-50";

export default function ConfirmDeleteButton({
  label = "Delete",
  message = "Delete this record? This cannot be undone.",
  ask,
  children,
  className = defaultClass,
}: ConfirmDeleteButtonProps) {
  const { text } = useLanguage();
  return (
    <button
      type="submit"
      onClick={(event) => {
        if (!window.confirm(ask ? text(ask.en, ask.ne) : message)) {
          event.preventDefault();
        }
      }}
      className={className}
    >
      {children ?? label}
    </button>
  );
}
