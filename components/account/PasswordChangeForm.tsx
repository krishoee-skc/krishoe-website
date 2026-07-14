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
      <h2 className="text-xl font-black text-[#10231D]">Password</h2>
      <p className="mt-2 text-sm leading-6 text-[#5F6B66]">
        Change your account password using your current password.
      </p>

      <div className="mt-5 grid gap-4">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-[#10231D]">Current password</span>
          <input
            name="currentPassword"
            type="password"
            required
            className="form-input"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-[#10231D]">New password</span>
          <input
            name="newPassword"
            type="password"
            required
            minLength={6}
            className="form-input"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-[#10231D]">Confirm new password</span>
          <input
            name="confirmPassword"
            type="password"
            required
            minLength={6}
            className="form-input"
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
              state.ok ? "bg-[#E9F2EE] text-[#0B4D3B]" : "bg-[#FFF1EF] text-[#7B3128]"
            }`}
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
