"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import SubmitButton from "@/components/SubmitButton";
import { useLanguage } from "@/components/LanguageProvider";
import { resetPasswordWithCodeAction, type AccountActionState } from "@/app/account/actions";

const initialState: AccountActionState = { ok: false, message: "" };
const inputClass = "h-12 rounded-lg border border-black/10 px-4 outline-none focus:border-brand-green";

/**
 * Reset with the six digits from the email rather than the link.
 *
 * Everything the server needs is in this one submission, so it works on a
 * device that never opened the link — the common case, where the request was
 * made on a computer and the email is read on a phone.
 */
export default function ResetPasswordWithCodeForm() {
  const [state, setState] = useState<AccountActionState>(initialState);
  const [isPending, setIsPending] = useState(false);
  const { text } = useLanguage();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);

    try {
      setState(await resetPasswordWithCodeAction(state, new FormData(event.currentTarget)));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border bg-brand-paper p-6 shadow-sm">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-black text-brand-green-ink">
        {text("Set a new password", "नयाँ password राख्नुहोस्")}
      </h1>
        <p className="mt-2 text-sm text-gray-500">
          {text(
          "Put in the six-digit code from the email. The code works for one hour.",
          "Email मा आएको ६ अंकको कोड हाल्नुहोस्। कोड १ घण्टा चल्छ।",
        )}
        </p>
      </div>

      <div className="grid gap-4">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Email</span>
          <input name="email" type="email" required autoComplete="email" className={inputClass} />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">{text("Six-digit code", "६ अंकको कोड")}</span>
          <input
            name="code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoComplete="one-time-code"
            placeholder="000000"
            className={`${inputClass} text-center text-2xl font-black tracking-[0.4em]`}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">{text("New password", "नयाँ password")}</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">{text("Type it again", "फेरि लेख्नुहोस्")}</span>
          <input
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
          />
        </label>
      </div>

      <div className="mt-6 grid gap-2">
        <SubmitButton
          idleLabel={isPending ? "Resetting..." : text("Change password", "Password बदल्ने")}
          pendingLabel="Resetting..."
          disabled={isPending}
        />
        {state.message && (
          <p className={`rounded-lg p-3 text-sm font-semibold ${state.ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {state.message}
          </p>
        )}
        <Link href="/account/login" className="text-center text-sm font-bold text-brand-green hover:underline">
          {text("Send a new code", "नयाँ कोड पठाउने")}
        </Link>
      </div>
    </form>
  );
}
