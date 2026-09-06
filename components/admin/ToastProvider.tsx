"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

/**
 * A single, app-wide place for the short "it worked" / "that failed" messages
 * the admin used to render each in its own way. Any client component calls
 * `useToast().show(...)`, and a toast slides in from the top-right, then fades
 * itself out — so every action across the admin confirms the same way, the
 * quiet, consistent feedback a paid app gives.
 *
 * State only; no data. Toasts live in this browser tab and vanish on their own.
 */

type ToastTone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: ToastTone };

type ToastContextType = {
  show: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const TONE_STYLE: Record<ToastTone, string> = {
  success: "border-brand-green-line bg-brand-green-wash text-brand-green-ink",
  error: "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200",
  info: "border-brand-green-line bg-brand-paper text-brand-green-ink",
};

const TONE_ICON: Record<ToastTone, string> = {
  success: "✅",
  error: "⚠️",
  info: "ℹ️",
};

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, tone: ToastTone = "success") => {
    const id = nextId++;
    setToasts((current) => [...current, { id, message, tone }]);
    // Fade and remove after a few seconds. Errors linger a touch longer so they
    // are not missed.
    window.setTimeout(
      () => setToasts((current) => current.filter((t) => t.id !== id)),
      tone === "error" ? 6000 : 4000,
    );
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {/* The stack sits top-right, above everything, and never blocks clicks. */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-3 top-3 z-[100] flex w-[min(92vw,22rem)] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold shadow-lg backdrop-blur toast-in ${TONE_STYLE[toast.tone]}`}
          >
            <span aria-hidden="true" className="shrink-0">
              {TONE_ICON[toast.tone]}
            </span>
            <span className="min-w-0">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // A no-op fallback rather than a throw: a toast is a nicety, and a component
    // rendered outside the provider (a test, a stray preview) should not crash
    // for want of one.
    return { show: () => {} };
  }
  return context;
}
