"use client";

import Link from "next/link";
import type { ActionState } from "@/app/admin/actions";

type ActionMessageProps = {
  state: ActionState | null;
  linkLabel?: string;
};

// Every admin write should say what happened. Without this a failed save either
// showed the app's error page — losing the filled-in form — or looked identical
// to a save that worked. `role="status"` so a screen reader announces it too.
export default function ActionMessage({ state, linkLabel }: ActionMessageProps) {
  if (!state || !state.message) {
    return null;
  }

  const tone = state.ok
    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : "border-red-200 bg-red-50 text-red-900";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-bold ${tone}`}
    >
      <span>
        <span aria-hidden="true">{state.ok ? "✓ " : "✕ "}</span>
        {state.message}
      </span>
      {state.ok && state.href ? (
        <Link href={state.href} className="shrink-0 underline underline-offset-4">
          {linkLabel ?? "Open"}
        </Link>
      ) : null}
    </div>
  );
}
