"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { setPhotoRobotAction } from "@/app/admin/factory/photos/actions";

/**
 * The robot that looks at workers' photos, on or off (owner, 2026-10-03). Off,
 * no photo leaves for Google and the photo screen works as before.
 */
export default function PhotoRobotSwitch({ on, connected }: { on: boolean; connected: boolean }) {
  const { text } = useLanguage();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [said, setSaid] = useState("");

  const flip = () =>
    start(async () => {
      const reply = await setPhotoRobotAction(!on);
      setSaid(text(reply.en, reply.ne));
      if (reply.ok) router.refresh();
    });

  return (
    <div className="mt-3 grid gap-2">
      <p className="text-sm font-bold text-brand-green-ink">
        {on ? text("🤖 On — the robot looks at each new work photo.", "🤖 खुला — हरेक नयाँ कामको फोटो रोबोटले हेर्छ।") : text("Off — no photo is sent to the robot.", "बन्द — कुनै फोटो रोबोटलाई पठाइँदैन।")}
      </p>
      {!connected ? (
        <p className="text-sm font-bold text-amber-800">
          {text("The Gemini key is not set on the live site, so the robot cannot look yet.", "Live site मा Gemini key छैन, त्यसैले रोबोटले अझै हेर्न सक्दैन।")}
        </p>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={flip}
        className={`min-h-11 w-max rounded-xl px-4 text-sm font-black disabled:opacity-50 ${on ? "border border-red-700 text-red-800" : "bg-brand-green text-white"}`}
      >
        {on ? text("Turn the robot off", "रोबोट बन्द गर्ने") : text("Turn the robot on", "रोबोट खोल्ने")}
      </button>
      {said ? <p role="status" className="text-sm font-bold text-brand-green">{said}</p> : null}
    </div>
  );
}
