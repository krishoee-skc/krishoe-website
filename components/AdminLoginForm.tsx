"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { loginAdminAction, type LoginState } from "@/app/admin/login/actions";
import SubmitButton from "@/components/SubmitButton";

const initialState: LoginState = {
  ok: false,
  message: "",
};

export default function AdminLoginForm({ nextPath = "/admin" }: { nextPath?: string }) {
  const [state, setState] = useState<LoginState>(initialState);
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);

    try {
      const result = await loginAdminAction(state, new FormData(event.currentTarget));
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
    <form onSubmit={handleSubmit} className="w-full max-w-md rounded-lg border border-white/15 bg-white p-6 shadow-[0_28px_90px_rgba(0,0,0,0.24)]">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#B98A2E]">
        Secure admin
      </p>
      <h1 className="mt-3 text-3xl font-black tracking-tight text-[#10231D]">
        KRISHOE control room
      </h1>
      <p className="mt-3 text-sm leading-7 text-[#5F6B66]">
        Sign in with a staff account. During setup, the local admin password still works when email is left blank.
      </p>

      <label className="mt-7 grid gap-2 text-sm font-semibold text-[#10231D]">
        Staff email
        <input
          name="email"
          type="email"
          autoComplete="username"
          className="h-12 rounded-lg border border-black/10 px-4 font-normal outline-none focus:border-[#0B4D3B]"
          placeholder="owner@krishoe.com"
        />
      </label>

      <label className="mt-4 grid gap-2 text-sm font-semibold text-[#10231D]">
        Password
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="h-12 rounded-lg border border-black/10 px-4 font-normal outline-none focus:border-[#0B4D3B]"
          placeholder="Enter password"
        />
      </label>

      <div className="mt-6 grid gap-3">
        <SubmitButton
          idleLabel={isPending ? "Checking password" : "Unlock admin"}
          pendingLabel="Checking password"
          disabled={isPending}
        />
        {state.message && !state.ok ? (
          <p aria-live="polite" className="rounded-lg bg-[#FFF1EF] p-4 text-sm font-semibold text-[#7B3128]">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
