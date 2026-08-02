"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  acceptAdminInvitationAction,
  changeRequiredAdminPasswordAction,
  completeAdminPasswordResetAction,
  requestAdminPasswordResetAction,
  type AdminAccessActionState,
} from "@/app/admin/access/actions";
import { adminPasswordStrength } from "@/lib/admin-password-policy";

const initialState: AdminAccessActionState = { ok: false, message: "" };
const inputClass =
  "h-12 rounded-xl border border-black/10 px-4 outline-none transition focus:border-brand-green focus:ring-2 focus:ring-brand-green/10";

function ResultMessage({ state }: { state: AdminAccessActionState }) {
  if (!state.message) return null;

  return (
    <div
      aria-live="polite"
      className={`rounded-xl border p-4 text-sm font-semibold ${
        state.ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-red-200 bg-red-50 text-red-800"
      }`}
    >
      <p>{state.message}</p>
      {state.ok && state.href ? (
        <Link href={state.href} className="mt-3 inline-flex font-black underline">
          Continue
        </Link>
      ) : null}
    </div>
  );
}

export function AdminForgotPasswordForm() {
  const [state, setState] = useState(initialState);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      setState(await requestAdminPasswordResetAction(state, new FormData(event.currentTarget)));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <label className="grid gap-2 text-sm font-black text-brand-green-ink">
        Staff email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputClass}
          placeholder="staff@krishoe.com"
        />
      </label>
      <button
        disabled={pending}
        className="min-h-12 rounded-xl bg-brand-green px-5 font-black text-white transition hover:bg-brand-green-ink disabled:opacity-60"
      >
        {pending ? "Sending instructions..." : "Send reset instructions"}
      </button>
      <ResultMessage state={state} />
      <Link href="/admin/login" className="text-center text-sm font-black text-brand-green hover:underline">
        Back to staff sign in
      </Link>
    </form>
  );
}

export function AdminSetPasswordForm({
  token,
  mode,
}: {
  token: string;
  mode: "invitation" | "password-reset";
}) {
  const [state, setState] = useState(initialState);
  const [pending, setPending] = useState(false);
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const strength = adminPasswordStrength(password);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      const formData = new FormData(event.currentTarget);
      const action = mode === "invitation"
        ? acceptAdminInvitationAction
        : completeAdminPasswordResetAction;
      setState(await action(state, formData));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      <label className="grid gap-2 text-sm font-black text-brand-green-ink">
        New password
        <input
          name="password"
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          minLength={12}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={inputClass}
          placeholder="12+ characters"
        />
      </label>
      <div className="flex items-center gap-2" aria-label={`Password strength: ${strength.label}`}>
        {[1, 2, 3, 4, 5].map((level) => (
          <span
            key={level}
            className={`h-1.5 flex-1 rounded-full ${level <= strength.score ? "bg-brand-green" : "bg-gray-200"}`}
          />
        ))}
        <span className="w-14 text-right text-xs font-black text-brand-muted-deep">{strength.label}</span>
      </div>
      <label className="grid gap-2 text-sm font-black text-brand-green-ink">
        Confirm new password
        <input
          name="confirmPassword"
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          minLength={12}
          required
          className={inputClass}
        />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-brand-muted-deep">
        <input
          type="checkbox"
          checked={visible}
          onChange={(event) => setVisible(event.target.checked)}
          className="h-4 w-4 accent-brand-green"
        />
        Show password
      </label>
      <button
        disabled={pending || state.ok}
        className="min-h-12 rounded-xl bg-brand-green px-5 font-black text-white transition hover:bg-brand-green-ink disabled:opacity-60"
      >
        {pending
          ? "Saving password..."
          : mode === "invitation"
            ? "Activate staff account"
            : "Reset staff password"}
      </button>
      <ResultMessage state={state} />
    </form>
  );
}

export function AdminChangePasswordForm() {
  const [state, setState] = useState(initialState);
  const [pending, setPending] = useState(false);
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const strength = adminPasswordStrength(password);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      setState(await changeRequiredAdminPasswordAction(state, new FormData(event.currentTarget)));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <label className="grid gap-2 text-sm font-black text-brand-green-ink">
        Current temporary password
        <input name="currentPassword" type="password" autoComplete="current-password" required className={inputClass} />
      </label>
      <label className="grid gap-2 text-sm font-black text-brand-green-ink">
        New password
        <input
          name="password"
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          minLength={12}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={inputClass}
        />
      </label>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((level) => (
          <span key={level} className={`h-1.5 flex-1 rounded-full ${level <= strength.score ? "bg-brand-green" : "bg-gray-200"}`} />
        ))}
        <span className="w-14 text-right text-xs font-black text-brand-muted-deep">{strength.label}</span>
      </div>
      <label className="grid gap-2 text-sm font-black text-brand-green-ink">
        Confirm new password
        <input name="confirmPassword" type={visible ? "text" : "password"} autoComplete="new-password" minLength={12} required className={inputClass} />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-brand-muted-deep">
        <input type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} className="h-4 w-4 accent-brand-green" />
        Show new password
      </label>
      <button disabled={pending || state.ok} className="min-h-12 rounded-xl bg-brand-maroon px-5 font-black text-white disabled:opacity-60">
        {pending ? "Changing password..." : "Change password and continue"}
      </button>
      <ResultMessage state={state} />
    </form>
  );
}
