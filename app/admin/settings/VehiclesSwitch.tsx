"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { setVehiclesShownAction } from "@/app/admin/settings/actions";

/**
 * The vehicle work, shown or hidden (owner, 2026-10-31: not used, hide it).
 * Hidden, Operations shows no vehicle form, flow line or record; nothing is
 * deleted, and turning it on brings every part back.
 */
export default function VehiclesSwitch({ on }: { on: boolean }) {
  const { text } = useLanguage();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [said, setSaid] = useState("");

  const flip = () =>
    start(async () => {
      const reply = await setVehiclesShownAction(!on);
      setSaid(text(reply.en, reply.ne));
      if (reply.ok) router.refresh();
    });

  return (
    <div className="mt-3 grid gap-2">
      <p className="text-sm font-bold text-brand-green-ink">
        {on ? text("🚚 Shown in Operations.", "🚚 Operations मा देखिन्छ।") : text("Hidden — nothing is deleted.", "लुकाइएको — केही मेटिएको छैन।")}
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={flip}
        className={`min-h-11 w-max rounded-xl px-4 text-sm font-black disabled:opacity-50 ${on ? "border border-brand-green-line text-brand-green-ink" : "bg-brand-green text-white"}`}
      >
        {on ? text("Hide the vehicle work", "गाडीको काम लुकाउने") : text("Show the vehicle work", "गाडीको काम देखाउने")}
      </button>
      {said ? <p role="status" className="text-sm font-bold text-brand-green">{said}</p> : null}
    </div>
  );
}
