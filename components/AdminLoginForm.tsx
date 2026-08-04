"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  loginAdminAction,
  verifyAdminMfaAction,
  type LoginState,
} from "@/app/admin/login/actions";
import SubmitButton from "@/components/SubmitButton";

const initialState: LoginState = {
  ok: false,
  message: "",
};

export default function AdminLoginForm({
  nextPath = "/admin",
  bootstrapLoginAllowed = false,
}: {
  nextPath?: string;
  bootstrapLoginAllowed?: boolean;
}) {
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
        router.push(result.nextPath ?? nextPath);
        router.refresh();
      }
    } finally {
      setIsPending(false);
    }
  }

  async function handleMfaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);

    try {
      const result = await verifyAdminMfaAction(state, new FormData(event.currentTarget));
      setState(result.requiresMfa ? { ...state, ...result } : result);

      if (result.ok) {
        router.push(result.nextPath ?? nextPath);
        router.refresh();
      }
    } finally {
      setIsPending(false);
    }
  }

  if (state.requiresMfa && state.challengeToken) {
    return (
      <form
        onSubmit={handleMfaSubmit}
        className="w-full max-w-md rounded-2xl border border-white/15 bg-white p-6 shadow-[0_28px_90px_rgba(0,0,0,0.24)]"
      >
        <input type="hidden" name="challengeToken" value={state.challengeToken} />
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
          Two-step verification
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-brand-green-ink">
          Check your email
        </h1>
        <p className="mt-3 text-sm leading-7 text-brand-muted">
          Enter the 6-digit code sent to {state.emailHint ?? "your staff email"}. It expires in 10 minutes.
        </p>

        <label className="mt-7 grid gap-2 text-sm font-semibold text-brand-green-ink">
          Security code
          <input
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
            className="h-14 rounded-xl border border-black/10 px-4 text-center text-2xl font-black tracking-[0.35em] outline-none focus:border-brand-green"
            placeholder="000000"
          />
        </label>

        <div className="mt-6 grid gap-3">
          <SubmitButton
            idleLabel={isPending ? "Verifying code" : "Verify and continue"}
            pendingLabel="Verifying code"
            disabled={isPending}
          />
          {state.message && !state.ok ? (
            <p aria-live="polite" className="rounded-lg bg-brand-clay-mist p-4 text-sm font-semibold text-brand-clay">
              {state.message}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => setState(initialState)}
            className="min-h-11 text-sm font-black text-brand-green hover:underline"
          >
            Start sign-in again
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md rounded-lg border border-white/15 bg-white p-6 shadow-[0_28px_90px_rgba(0,0,0,0.24)]">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
        Secure admin
      </p>
      <h1 className="mt-3 text-3xl font-black tracking-tight text-brand-green-ink">
        KRISHOE control room
      </h1>
      <p className="mt-3 text-sm leading-7 text-brand-muted">
        {bootstrapLoginAllowed
          ? "Sign in with a staff account. During initial setup only, the recovery admin password works when email is left blank."
          : "Sign in with your staff email and password. This login will register the current phone or computer in Login devices."}
      </p>

      <label className="mt-7 grid gap-2 text-sm font-semibold text-brand-green-ink">
        Staff email
        <input
          name="email"
          type="email"
          required={!bootstrapLoginAllowed}
          autoComplete="username"
          className="h-12 rounded-lg border border-black/10 px-4 font-normal outline-none focus:border-brand-green"
          placeholder="owner@krishoe.com"
        />
      </label>

      <label className="mt-4 grid gap-2 text-sm font-semibold text-brand-green-ink">
        Password
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="h-12 rounded-lg border border-black/10 px-4 font-normal outline-none focus:border-brand-green"
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
          <p aria-live="polite" className="rounded-lg bg-brand-clay-mist p-4 text-sm font-semibold text-brand-clay">
            {state.message}
          </p>
        ) : null}
        <Link
          href="/admin/forgot-password"
          className="text-center text-sm font-black text-brand-green hover:underline"
        >
          Forgot staff password?
        </Link>
      </div>
    </form>
  );
}
