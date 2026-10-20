"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * Says so when the phone has lost its connection.
 *
 * A save pressed with no signal fails with a message that reads like the app
 * is broken, and the reflex is to reload — which throws away what was typed.
 * This says what is actually happening and what to do: keep the page open, and
 * press Save again when the signal is back.
 *
 * Not an automatic resend here. A queued wage payment or bill that goes out on
 * its own when the signal returns can go out twice — once from the queue and
 * once from the person pressing Save again — and money entered twice is worse
 * than an entry that waits for a tap.
 *
 * Two screens are the exception (owner, 2026-10-20, rule 4): a new sale on the
 * counter and a new work entry wait on the phone with the key they would have
 * been sent with, the bill or the boxes are cleared so there is nothing to
 * press Save on again, and the key makes a second send the same entry
 * (lib/offline-queue). Those screens say so themselves, so this notice stands
 * aside there rather than telling the counter to press Save again.
 */

/** The screens that keep a new entry on the phone and say so themselves. */
const KEEPS_ON_THE_PHONE = ["/admin/pos", "/admin/factory/add-work"];

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export default function OfflineNotice() {
  const { text } = useLanguage();
  const pathname = usePathname() ?? "";
  const offline = useSyncExternalStore(subscribe, () => !navigator.onLine, () => false);
  if (!offline) return null;
  if (KEEPS_ON_THE_PHONE.some((path) => pathname === path)) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 top-[calc(0.5rem+env(safe-area-inset-top))] z-[70] mx-auto max-w-md rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold leading-5 text-amber-900 shadow-lg print:hidden"
    >
      {text(
        "No internet. Keep this page open — what you typed is kept. Press Save again when the signal is back.",
        "Internet छैन। यो page बन्द नगर्नुहोस् — भरेको कुरा हराउँदैन। Net आएपछि फेरि Save थिच्नुहोस्।",
      )}
    </div>
  );
}
