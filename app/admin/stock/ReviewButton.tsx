"use client";

import { useFormStatus } from "react-dom";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * The Owner's ✓ on a counter item, off while it saves. It stayed live, so one
 * item was marked three times in a second and the audit log said so three
 * times (owner, 2026-09-29).
 */
export default function ReviewButton() {
  const { pending } = useFormStatus();
  const { text } = useLanguage();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="min-h-11 rounded-full bg-brand-green px-4 text-sm font-black text-white disabled:opacity-60"
    >
      {pending ? text("Saving…", "राख्दैछौँ…") : text("✓ Looks right", "✓ ठीक छ")}
    </button>
  );
}
