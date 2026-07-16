"use client";

import { FormEvent, useState } from "react";
import { changePasswordAction, type AccountActionState } from "@/app/account/actions";
import SubmitButton from "@/components/SubmitButton";

const initialState: AccountActionState = { ok: false, message: "" };

export default function PasswordChangeForm() {
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
    <form onSubmit={handleSubmit} className="rounded-lg border border-black/10 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-black text-brand-green-ink">Password</h2>
      <p className="mt-2 text-sm leading-6 text-brand-muted">
        Change your account password using your current password.
      </p>

      <div className="mt-5 grid gap-4">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-brand-green-ink">Current password</span>
          <input
            name="currentPassword"
            type="password"
            required
            className="h-12 rounded-lg border border-black/10 px-4 outline-none focus:border-brand-green"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-brand-green-ink">New password</span>
          <input
            name="newPassword"
            type="password"
            required
            minLength={6}
            className="h-12 rounded-lg border border-black/10 px-4 outline-none focus:border-brand-green"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-brand-green-ink">Confirm new password</span>
          <input
            name="confirmPassword"
            type="password"
            required
            minLength={6}
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
