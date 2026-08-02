"use client";

import { useEffect, useState } from "react";

type MobilePlatform = "ios" | "android" | null;

export default function PwaInstallHelp() {
  const [platform, setPlatform] = useState<MobilePlatform>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const dismissed = window.sessionStorage.getItem("krishoe-install-help-dismissed") === "yes";
    const agent = navigator.userAgent;
    const nextPlatform: MobilePlatform = /iPad|iPhone|iPod/.test(agent)
      ? "ios"
      : /Android/i.test(agent)
        ? "android"
        : null;

    const updateId = window.setTimeout(() => {
      setPlatform(nextPlatform);
      setVisible(Boolean(nextPlatform && !standalone && !dismissed));
    }, 0);

    return () => window.clearTimeout(updateId);
  }, []);

  if (!visible || !platform) return null;

  const close = () => {
    window.sessionStorage.setItem("krishoe-install-help-dismissed", "yes");
    setVisible(false);
  };

  return (
    <aside className="fixed inset-x-3 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-md rounded-2xl border border-brand-gold/40 bg-brand-green-ink p-4 text-white shadow-2xl lg:hidden print:hidden" aria-label="Install KRISHOE app">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black">Add KRISHOE to your Home Screen</p>
          <p className="mt-1 text-sm leading-5 text-white/80">
            {platform === "ios"
              ? "In Safari, tap Share, then Add to Home Screen. Open the new KRISHOE icon for the app view."
              : "In Chrome, open the three-dot menu and choose Install app or Add to Home screen."}
          </p>
        </div>
        <button type="button" onClick={close} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-lg font-black" aria-label="Dismiss install help">X</button>
      </div>
    </aside>
  );
}
