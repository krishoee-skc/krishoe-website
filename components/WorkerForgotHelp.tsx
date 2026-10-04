"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { tellOwnerWorkerForgotAction } from "@/app/admin/access/actions";

/**
 * "Forgot the password?" on the worker's sign-in (owner, 2026-10-04, option 2).
 *
 * The usual way: tell the owner, whose phone is told, and a new code comes on
 * WhatsApp — no email needed, any country's number. A worker whose account
 * has an email may also set a new password by email, on the worker's version
 * of that page. Nobody gets in without an account the owner made.
 */
export default function WorkerForgotHelp() {
  const { text } = useLanguage();
  const box = useRef<HTMLDivElement>(null);
  const [pending, start] = useTransition();
  const [reply, setReply] = useState<{ ok: boolean; en: string; ne: string } | null>(null);

  const tellOwner = () =>
    start(async () => {
      // What the worker typed in the sign-in box above: their mobile or email.
      const typed = box.current?.closest("form")?.querySelector<HTMLInputElement>('input[name="email"]')?.value ?? "";
      setReply(await tellOwnerWorkerForgotAction(typed));
    });

  return (
    <div ref={box} className="grid gap-2 rounded-xl border border-brand-green-line bg-brand-paper-deep px-4 py-3 text-sm">
      <p className="font-black text-brand-green-ink">
        🔑 {text("Forgot the password? Ask the owner — a new code comes on WhatsApp.", "Password बिर्सियो? मालिकलाई भन्नुहोस् — नयाँ कोड WhatsApp मा आउँछ।")}
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={tellOwner}
        className="min-h-11 rounded-xl bg-brand-green px-4 font-black text-white disabled:opacity-60"
      >
        {pending ? text("Telling…", "खबर गर्दै…") : text("📣 Tell the owner", "📣 मालिकलाई खबर गर्ने")}
      </button>
      {reply ? (
        <p role="status" className={`font-bold ${reply.ok ? "text-brand-green" : "text-brand-clay"}`}>
          {text(reply.en, reply.ne)}
        </p>
      ) : null}
      <Link href="/admin/forgot-password?for=worker" className="text-center text-xs font-bold text-brand-green underline underline-offset-4">
        {text("Email on your account? Change it yourself by email →", "खातामा email छ? Email बाट आफैँ फेर्नुहोस् →")}
      </Link>
    </div>
  );
}
