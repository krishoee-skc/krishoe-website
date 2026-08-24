"use client";

import { FormEvent, useState } from "react";
import { changePasswordAction, type AccountActionState } from "@/app/account/actions";
import SubmitButton from "@/components/SubmitButton";
import { useLanguage } from "@/components/LanguageProvider";

const initialState: AccountActionState = { ok: false, message: "" };

export default function PasswordChangeForm() {
  const { text } = useLanguage();
  const [state, setState] = useState<AccountActionState>(initialState);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);

    try {
      const form = event.currentTarget;
      const result = await changePasswordAction(state, new FormData(form));
      setState(result);

      if (result.ok) {
        form.reset();
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-black/10 bg-brand-paper p-6 shadow-sm">
      <h2 className="text-xl font-black text-brand-green-ink">{text("Password", "पासवर्ड")}</h2>
      <p className="mt-2 text-sm leading-6 text-brand-muted">
        {text("Change your account password using your current password.", "अहिलेको पासवर्ड हालेर नयाँ राख्नुहोस्।")}
      </p>

      <div className="mt-5 grid gap-4">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-brand-green-ink">{text("Current password", "अहिलेको पासवर्ड")}</span>
          <input
            name="currentPassword"
            type="password"
            required
            className="h-12 rounded-lg border border-black/10 px-4 outline-none focus:border-brand-green"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-brand-green-ink">{text("New password", "नयाँ पासवर्ड")}</span>
          <input
            name="newPassword"
            type="password"
            required
            minLength={8}
            className="h-12 rounded-lg border border-black/10 px-4 outline-none focus:border-brand-green"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-brand-green-ink">{text("Confirm new password", "नयाँ पासवर्ड फेरि")}</span>
          <input
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            className="h-12 rounded-lg border border-black/10 px-4 outline-none focus:border-brand-green"
          />
        </label>
      </div>

      <div className="mt-6 grid gap-2">
        <SubmitButton
          idleLabel={isPending ? "Changing..." : "Change password"}
          pendingLabel="Changing..."
          disabled={isPending}
        />
        {state.message ? (
          <p
            aria-live="polite"
            className={`rounded-lg p-3 text-sm font-semibold ${
              state.ok ? "bg-brand-green-mist text-brand-green" : "bg-brand-clay-mist text-brand-clay"
            }`}
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
