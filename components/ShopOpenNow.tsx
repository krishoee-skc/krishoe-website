"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { shopHours, shopOpenNow } from "@/lib/shop-hours";

/**
 * "Open now" or "Closed now" on the contact page, by Nepal's clock (owner,
 * 2026-10-24). The page is prerendered, so the moment is read in the browser:
 * until then it shows the plain weekly hours, and it looks again each minute.
 */
export default function ShopOpenNow() {
  const { text } = useLanguage();
  const [state, setState] = useState<ReturnType<typeof shopOpenNow> | null>(null);

  useEffect(() => {
    const look = () => setState(shopOpenNow());
    look();
    const timer = window.setInterval(look, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <p
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl px-4 py-3 text-sm font-black ${
        state === null
          ? "bg-brand-paper text-brand-green-ink"
          : state.open
            ? "bg-brand-green-mist text-brand-green"
            : "bg-brand-clay-mist text-brand-clay"
      }`}
    >
      {state ? <span aria-hidden="true">●</span> : null}
      <span>{state ? text(state.en, state.ne) : text(shopHours.en, shopHours.ne)}</span>
      {state ? <span className="font-semibold opacity-80">· {text(shopHours.en, shopHours.ne)}</span> : null}
    </p>
  );
}
