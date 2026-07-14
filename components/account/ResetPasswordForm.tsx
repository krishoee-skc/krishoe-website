"use client";

import { FormEvent, useState } from "react";
import SubmitButton from "@/components/SubmitButton";
import { resetPasswordAction, type AccountActionState } from "@/app/account/actions";

const initialState: AccountActionState = { ok: false, message: "" };

export default function ResetPasswordForm({ token }: { token: string }) {
  const [state, setState] = useState<AccountActionState>(initialState);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);

    try {
      setState(await resetPasswordAction(state, new FormData(event.currentTarget)));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border bg-white p-6 shadow-sm">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-black text-[#10231D]">Reset Your Password</h1>
        <p className="mt-2 text-sm text-gray-500">Enter a new password for your account.</p>
      </div>

      <input type="hidden" name="token" value={token} />

      <div className="grid gap-4">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">New password</span>
          <input
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="form-input"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Confirm new password</span>
          <input
            name="confirmPassword"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="form-input"
          />
        </label>
      </div>

      <div className="mt-6 grid gap-2">
        <SubmitButton
          idleLabel={isPending ? "Resetting..." : "Reset Password"}
          pendingLabel="Resetting..."
          disabled={isPending}
        />
        {state.message && (
          <p className={`rounded-lg p-3 text-sm font-semibold ${state.ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
