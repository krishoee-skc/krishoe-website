"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { loginCustomerAction, type AccountActionState } from "@/app/account/actions";
import SubmitButton from "@/components/SubmitButton";

const initialState: AccountActionState = {
  ok: false,
  message: "",
};

export default function AccountLoginForm({ nextPath = "/account" }: { nextPath?: string }) {
  const [state, setState] = useState<AccountActionState>(initialState);
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);

    try {
      const result = await loginCustomerAction(state, new FormData(event.currentTarget));
      setState(result);

      if (result.ok) {
        router.push(nextPath);
        router.refresh();
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-black/10 bg-white p-6 shadow-[0_24px_70px_rgba(16,35,29,0.08)]">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#B98A2E]">Customer account</p>
      <h1 className="mt-3 text-3xl font-black text-[#10231D]">Sign in</h1>
      <p className="mt-3 text-sm leading-7 text-[#5F6B66]">
        Save checkout details and manage your KRISHOE profile.
      </p>

      <div className="mt-7 grid gap-4">
        <label className="grid gap-2 text-sm font-semibold text-[#10231D]">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="h-12 rounded-lg border border-black/10 px-4 font-normal outline-none focus:border-[#0B4D3B]"
            placeholder="you@example.com"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-[#10231D]">
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="h-12 rounded-lg border border-black/10 px-4 font-normal outline-none focus:border-[#0B4D3B]"
            placeholder="Your password"
          />
        </label>
      </div>

      <div className="mt-6 grid gap-3">
        <SubmitButton
          idleLabel={isPending ? "Signing in" : "Sign in"}
          pendingLabel="Signing in"
          disabled={isPending}
        />
        {state.message && !state.ok ? (
          <p aria-live="polite" className="rounded-lg bg-[#FFF1EF] p-4 text-sm font-semibold text-[#7B3128]">
            {state.message}
          </p>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm font-semibold">
        <Link
          href={`/account/register?next=${encodeURIComponent(nextPath)}`}
          className="text-[#0B4D3B] hover:text-[#B98A2E]"
        >
          Create account
        </Link>
        <a href="#password-reset" className="text-[#5F6B66] hover:text-[#0B4D3B]">
          Forgot password?
        </a>
      </div>
    </form>
  );
}
