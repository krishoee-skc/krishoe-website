"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { requestPasswordResetAction, type AccountActionState } from "@/app/account/actions";
import SubmitButton from "@/components/SubmitButton";

const initialState: AccountActionState = {
  ok: false,
  message: "",
};

export default function PasswordResetRequestForm() {
  const [state, setState] = useState<AccountActionState>(initialState);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);

    try {
      setState(await requestPasswordResetAction(state, new FormData(event.currentTarget)));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form id="password-reset" onSubmit={handleSubmit} className="rounded-lg border border-black/10 bg-white p-6">
      <h2 className="text-xl font-black text-[#10231D]">Reset password</h2>
      <p className="mt-2 text-sm leading-7 text-[#5F6B66]">
        Enter your account email. Reset instructions are sent if an account exists.
      </p>
      <label className="mt-5 grid gap-2 text-sm font-semibold text-[#10231D]">
        Email
        <input name="email" type="email" required className="h-12 rounded-lg border border-black/10 px-4 font-normal outline-none focus:border-[#0B4D3B]" />
      </label>
      <div className="mt-5 grid gap-3">
        <SubmitButton
          idleLabel={isPending ? "Sending instructions" : "Send reset instructions"}
          pendingLabel="Sending instructions"
          disabled={isPending}
        />
        {state.message ? (
          <p aria-live="polite" className={`rounded-lg p-4 text-sm font-semibold ${state.ok ? "bg-[#E9F2EE] text-[#0B4D3B]" : "bg-[#FFF1EF] text-[#7B3128]"}`}>
            {state.message}
          </p>
        ) : null}
        {state.resetLink ? (
          <Link href={state.resetLink} className="inline-flex h-11 items-center justify-center rounded-full border border-[#0B4D3B] px-5 text-sm font-bold text-[#0B4D3B] transition hover:bg-[#F5F7F4]">
            Open local reset link
          </Link>
        ) : null}
      </div>
    </form>
  );
}
