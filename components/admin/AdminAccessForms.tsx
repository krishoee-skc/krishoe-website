"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  acceptAdminInvitationAction,
  changeRequiredAdminPasswordAction,
  completeAdminPasswordResetAction,
  completeAdminPasswordResetWithCodeAction,
  requestAdminPasswordResetAction,
  type AdminAccessActionState,
} from "@/app/admin/access/actions";
import { adminPasswordStrength } from "@/lib/admin-password-policy";
import { useLanguage } from "@/components/LanguageProvider";

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
      {/* A full page load, not a client-side link. These forms change the
          session cookie (a new password is a new session), and the router
          still held what the old cookie was answered: a worker who had just
          changed a temporary password pressed Continue and was sent straight
          back to "change your temporary password". */}
      {state.ok && state.href ? (
        <a href={state.href} className="mt-3 inline-flex font-black underline">
          Continue
        </a>
      ) : null}
    </div>
  );
}

/** `forWorker`: a worker's words and way back (owner, 2026-10-04, option 2). */
export function AdminForgotPasswordForm({ forWorker = false }: { forWorker?: boolean } = {}) {
  const { text } = useLanguage();
  const q = forWorker ? "?for=worker" : "";
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
        {forWorker ? text("Your email", "तपाईंको email") : "Staff email"}
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputClass}
          placeholder={forWorker ? "name@gmail.com" : "staff@krishoe.com"}
        />
      </label>
      <button
        disabled={pending}
        className="min-h-12 rounded-xl bg-brand-green px-5 font-black text-white transition hover:bg-brand-green-ink disabled:opacity-60"
      >
        {pending
          ? forWorker ? text("Sending…", "पठाउँदै…") : "Sending instructions..."
          : forWorker ? text("Send me a code", "मलाई कोड पठाउने") : "Send reset instructions"}
      </button>
      <ResultMessage state={state} />
      <Link
        href={`/admin/reset-password${q}`}
        className="text-center text-sm font-black text-brand-green hover:underline"
      >
        {text("I already have a code", "कोड आइसक्यो? यहाँ हाल्नुहोस्")}
      </Link>
      <Link href={forWorker ? "/worker/login" : "/admin/login"} className="text-center text-sm font-black text-brand-green hover:underline">
        {forWorker ? text("← Back to the worker sign-in", "← कामदारको login मा फर्किने") : "Back to staff sign in"}
      </Link>
    </form>
  );
}

/**
 * Reset with the six digits from the email.
 *
 * Email, code and new password in one submission: the person may be standing at
 * a different device from the one that asked for the reset, so nothing here can
 * depend on a session or on the emailed link having been opened.
 */
export function AdminResetWithCodeForm({ forWorker = false }: { forWorker?: boolean } = {}) {
  const { text } = useLanguage();
  // A worker's password is eight characters at least; everyone else's twelve.
  const least = forWorker ? 8 : 12;
  const [state, setState] = useState(initialState);
  const [pending, setPending] = useState(false);
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const strength = adminPasswordStrength(password);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      setState(
        await completeAdminPasswordResetWithCodeAction(state, new FormData(event.currentTarget)),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <label className="grid gap-2 text-sm font-black text-brand-green-ink">
        {forWorker ? text("Your email", "तपाईंको email") : "Staff email"}
        <input name="email" type="email" autoComplete="email" required className={inputClass} />
      </label>
      <label className="grid gap-2 text-sm font-black text-brand-green-ink">
        {text("6-digit code from your email", "Email मा आएको 6-digit कोड")}
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          className={`${inputClass} text-center text-2xl font-black tracking-[0.4em]`}
          placeholder="000000"
        />
      </label>
      <label className="grid gap-2 text-sm font-black text-brand-green-ink">
        {forWorker ? text("New password", "नयाँ password") : "New password"}
        <input
          name="password"
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          minLength={least}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={inputClass}
          placeholder={forWorker ? text("8+ characters", "कम्तीमा ८ अक्षर") : "12+ characters"}
        />
      </label>
      <div className="flex items-center gap-2" aria-label={`Password strength: ${strength.label}`}>
        {[1, 2, 3, 4, 5].map((level) => (
          <span
            key={level}
            className={`h-1.5 flex-1 rounded-full ${level <= strength.score ? "bg-brand-green" : "bg-brand-green-line"}`}
          />
        ))}
        <span className="w-14 text-right text-xs font-black text-brand-muted-deep">{strength.label}</span>
      </div>
      <label className="grid gap-2 text-sm font-black text-brand-green-ink">
        {forWorker ? text("Type it again", "फेरि लेख्नुहोस्") : "Confirm new password"}
        <input
          name="confirmPassword"
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          minLength={least}
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
        {pending ? "Saving password..." : text("Change password with code", "कोडले password बदल्ने")}
      </button>
      <ResultMessage state={state} />
      <Link
        href={`/admin/forgot-password${forWorker ? "?for=worker" : ""}`}
        className="text-center text-sm font-black text-brand-green hover:underline"
      >
        {text("Send a new code", "नयाँ कोड पठाउने")}
      </Link>
    </form>
  );
}

export function AdminSetPasswordForm({
  token,
  mode,
  forWorker = false,
}: {
  token: string;
  mode: "invitation" | "password-reset";
  forWorker?: boolean;
}) {
  const { text } = useLanguage();
  const least = forWorker ? 8 : 12;
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
          minLength={least}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={inputClass}
          placeholder={forWorker ? text("8+ characters", "कम्तीमा ८ अक्षर") : "12+ characters"}
        />
      </label>
      <div className="flex items-center gap-2" aria-label={`Password strength: ${strength.label}`}>
        {[1, 2, 3, 4, 5].map((level) => (
          <span
            key={level}
            className={`h-1.5 flex-1 rounded-full ${level <= strength.score ? "bg-brand-green" : "bg-brand-green-line"}`}
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
          minLength={least}
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
            : forWorker ? text("Save the new password", "नयाँ password बचत गर्ने") : "Reset staff password"}
      </button>
      <ResultMessage state={state} />
    </form>
  );
}

export function AdminChangePasswordForm({ minLength = 12, worker = false }: { minLength?: number; worker?: boolean } = {}) {
  const { text } = useLanguage();
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
        {worker ? text("The code you were sent", "सुरुको कोड") : "Current temporary password"}
        <input name="currentPassword" type="password" autoComplete="current-password" required className={inputClass} />
      </label>
      <label className="grid gap-2 text-sm font-black text-brand-green-ink">
        {worker ? text(`Your new password (at least ${minLength} characters)`, `आफ्नो नयाँ password (कम्तीमा ${minLength} अक्षर)`) : "New password"}
        <input
          name="password"
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          minLength={minLength}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={inputClass}
        />
      </label>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((level) => (
          <span key={level} className={`h-1.5 flex-1 rounded-full ${level <= strength.score ? "bg-brand-green" : "bg-brand-green-line"}`} />
        ))}
        <span className="w-14 text-right text-xs font-black text-brand-muted-deep">{strength.label}</span>
      </div>
      <label className="grid gap-2 text-sm font-black text-brand-green-ink">
        {worker ? text("Type it again", "फेरि लेख्नुहोस्") : "Confirm new password"}
        <input name="confirmPassword" type={visible ? "text" : "password"} autoComplete="new-password" minLength={minLength} required className={inputClass} />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-brand-muted-deep">
        <input type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} className="h-4 w-4 accent-brand-green" />
        {worker ? text("👁 Show password", "👁 Password देखाउने") : "Show new password"}
      </label>
      <button disabled={pending || state.ok} className="min-h-12 rounded-xl bg-brand-maroon px-5 font-black text-white disabled:opacity-60">
        {pending
          ? worker ? text("Saving…", "बचत गर्दै…") : "Changing password..."
          : worker ? text("Save the password and go in", "Password बचत गरेर भित्र जाने") : "Change password and continue"}
      </button>
      <ResultMessage state={state} />
    </form>
  );
}
