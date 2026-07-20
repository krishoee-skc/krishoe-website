"use client";

import { useEffect, useState } from "react";
import { shouldOfferReload } from "@/lib/version-check";

// Watches for a newer deployment and offers a reload — it never reloads on its
// own, because doing so mid-bill would throw away what the owner was typing.
//
// `version` is the deployment that served this page (passed from the server at
// load, so it always matches the bundle running here). It is compared against
// what /api/version reports now. The check runs on a gentle timer and whenever
// the app is brought back to the front, which is when a phone most often finds
// itself on yesterday's page.
export default function VersionWatcher({ version }: { version: string }) {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    // No deployment id (local dev, or system env vars off) — nothing to compare,
    // so the prompt simply never shows rather than firing on every check.
    if (!version) {
      return;
    }

    let active = true;

    async function check() {
      try {
        const response = await fetch("/api/version", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const data: unknown = await response.json();
        const current = (data as { version?: unknown }).version;

        if (active && shouldOfferReload(version, current)) {
          setUpdateReady(true);
        }
      } catch {
        // Offline or a blipped request — the next check tries again.
      }
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        check();
      }
    };

    // Every few minutes, plus each time the app returns to the front.
    const timer = setInterval(check, 3 * 60 * 1000);
    document.addEventListener("visibilitychange", onVisible);
    check();

    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [version]);

  if (!updateReady) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-20 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-brand-gold-bright/40 bg-brand-green-ink px-4 py-3 text-sm text-white shadow-[0_18px_50px_rgba(16,35,29,0.35)] lg:bottom-4"
    >
      <span className="flex-1 font-semibold">
        A new version of KRISHOE is ready.
      </span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="h-9 shrink-0 rounded-full bg-brand-gold-bright px-4 text-xs font-black text-brand-green-ink transition hover:brightness-105"
      >
        Reload
      </button>
      <button
        type="button"
        onClick={() => setUpdateReady(false)}
        aria-label="Dismiss"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
      >
        ✕
      </button>
    </div>
  );
}
