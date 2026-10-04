"use client";
import WorkerForgotHelp from "@/components/WorkerForgotHelp";

import { FormEvent, KeyboardEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  loginAdminAction,
  resendAdminMfaCodeAction,
  verifyAdminMfaAction,
  type LoginState,
} from "@/app/admin/login/actions";
import SubmitButton from "@/components/SubmitButton";
import { useLanguage } from "@/components/LanguageProvider";
import PasskeySignInButton from "@/components/PasskeySignInButton";

const initialState: LoginState = {
  ok: false,
  message: "",
};

/**
 * What the sign-in page says above the fields.
 *
 * It used to say the account being used was not the right one — a line meant
 * to stop staff borrowing a login. The owner read it on their own phone, as
 * the owner, and it told them they were in the wrong place.
 *
 * The sentence about Login devices went with it: it described what happens
 * after signing in, on a screen where the reader has not signed in yet.
 */
const ADMIN_SIGN_IN_HINT = {
  en: "Sign in with the email and password you were given. Use your own account.",
  ne: "तपाईंलाई दिइएको email र password हाल्नुहोस्। आफ्नै खाता चलाउनुहोस्।",
};

/**
 * The same, for the worker portal.
 *
 * It used to say "the password the owner gave you". A worker knows who gave it
 * to them — they were standing there. What matters is changing it, so that is
 * what this says, without naming anybody.
 */
const WORKER_SIGN_IN_HINT = {
  en: "Put in your mobile number or email and your password. Set your own new password the first time.",
  ne: "आफ्नो मोबाइल नम्बर वा email र password हाल्नुहोस्। पहिलो पटकमै आफ्नो नयाँ password राख्नुहोस्।",
};

export default function AdminLoginForm({
  nextPath = "/admin",
  bootstrapLoginAllowed = false,
  portal = "admin",
}: {
  nextPath?: string;
  bootstrapLoginAllowed?: boolean;
  portal?: "admin" | "worker";
}) {
  const { text } = useLanguage();
  const [state, setState] = useState<LoginState>(initialState);
  const [isPending, setIsPending] = useState(false);
  const [code, setCode] = useState("");
  // The owner asked for both on 2026-09-28: dots give no way to see a typo,
  // and Caps Lock is the commonest reason a right password is refused on a PC.
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  function watchCapsLock(event: KeyboardEvent<HTMLInputElement>) {
    setCapsLockOn(event.getModifierState("CapsLock"));
  }
  // Set when something arrived in the code box that was not a code — almost
  // always the saved password, offered by the phone's password manager on the
  // screen right after a password field.
  const [codeWasFilled, setCodeWasFilled] = useState(false);
  const router = useRouter();

  /**
   * Keeps the code box to six digits, whatever is put in it.
   *
   * The input already asks for a numeric keypad and declares itself a one-time
   * code, which is everything the platform offers — and iOS filled the saved
   * password into it anyway, past maxLength, because autofill does not go
   * through the keyboard. Left alone, "Krisha@rijal66" would either sit there
   * looking like an answer or silently become "66", and the form would just say
   * the code was wrong. Stripping it and naming what happened is the difference
   * between a dead end and an instruction.
   */
  function acceptCode(raw: string) {
    const digits = raw.replace(/\D+/g, "").slice(0, 6);
    setCodeWasFilled(raw.length > 0 && digits.length !== raw.length);
    setCode(digits);
  }

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

  async function handleResend() {
    if (!state.challengeToken) return;
    setIsPending(true);
    try {
      setState({
        ...state,
        ...(await resendAdminMfaCodeAction(state.challengeToken, state.remember ?? false)),
      });
      setCode("");
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
        className="w-full max-w-md rounded-2xl border border-white/15 bg-[#FFFFFF] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.24)]"
      >
        <input type="hidden" name="challengeToken" value={state.challengeToken} />
        {state.remember ? <input type="hidden" name="remember" value="on" /> : null}
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
          KRISHOE · {text("Two-step check", "दुई चरणको जाँच")}
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-brand-green-ink">
          {text("Check your email", "Email हेर्नुहोस्")}
        </h1>
        <p className="mt-3 text-sm leading-7 text-brand-muted">
          {text(
            `Put in the six-digit code sent to ${state.emailHint ?? "your staff email"}. It lasts ten minutes.`,
            `${state.emailHint ?? "तपाईंको staff email"} मा पठाइएको ६ अंकको कोड हाल्नुहोस्। १० मिनेटमा सकिन्छ।`,
          )}
        </p>

        {/* Asking for a code deletes the one before it, and nothing said so.
            The owner asked twice while trying to sign in on their phone, so
            three arrived, the first two were already dead, and there was no way
            to tell which of the three to type. */}
        <p className="mt-3 rounded-xl bg-brand-mist px-3 py-2 text-sm font-semibold leading-6 text-brand-green-ink">
          {text("More than one code in your email? ", "Email मा एकभन्दा बढी कोड छन् भने — ")}
          <strong>{text("only the newest one works", "सबैभन्दा नयाँ मात्र चल्छ")}</strong>
          {text(". Asking for a new one cancels the old.", "। नयाँ माग्दा पुरानो आफैँ रद्द हुन्छ।")}
        </p>

        <label className="mt-7 grid gap-2 text-sm font-semibold text-brand-green-ink">
          {text("Six-digit code", "६ अंकको कोड")}
          <input
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
            value={code}
            onChange={(event) => acceptCode(event.target.value)}
            className="h-14 rounded-xl border border-black/15 bg-[#FFFFFF] px-4 text-center text-2xl font-black tracking-[0.35em] text-[#16211C] outline-none placeholder:text-brand-muted-soft focus:border-brand-green"
            placeholder="000000"
          />
        </label>

        {codeWasFilled ? (
          <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold leading-5 text-amber-900">
            {text(
              "⚠️ That looked like a password — what is needed here is the six-digit code.",
              "⚠️ त्यो password जस्तो देखियो — यहाँ चाहिने ६ अंकको कोड हो।",
            )}
            <span className="mt-0.5 block font-semibold">
              {text(
                "Open Gmail, find the code, and type it in by hand.",
                "Gmail खोलेर कोड हेर्नुहोस्, अनि हातले टाइप गर्नुहोस्।",
              )}
            </span>
          </p>
        ) : null}

        <div className="mt-6 grid gap-3">
          <SubmitButton
            idleLabel={
              isPending
                ? text("Checking…", "जाँच्दैछौँ…")
                : text("Enter the code and go in", "कोड हालेर भित्र जाने")
            }
            pendingLabel={text("Checking…", "जाँच्दैछौँ…")}
            disabled={isPending}
          />
          {state.message && !state.ok ? (
            <p aria-live="polite" className="rounded-lg bg-brand-clay-mist p-4 text-sm font-semibold text-brand-clay">
              {state.message}
            </p>
          ) : null}
          {/* "Start sign-in again" was the only way out, and it sent the
              person back to the password field — where the code that arrived
              killed the one they were still holding. This asks for another
              without leaving the screen. */}
          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={isPending}
            className="min-h-11 text-sm font-black text-brand-green hover:underline disabled:opacity-60"
          >
            {text("Send a new code", "नयाँ कोड पठाउने")}
          </button>
          <button
            type="button"
            onClick={() => setState(initialState)}
            className="min-h-11 text-sm font-bold text-brand-muted hover:underline"
          >
            {text("Start signing in again", "सुरुबाट फेरि login गर्ने")}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md rounded-lg border border-white/15 bg-[#FFFFFF] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.24)]">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
        {portal === "worker" ? `KRISHOE · ${text("Worker", "कामदार")}` : "KRISHOE · Admin"}
      </p>
      <h1 className="mt-3 text-3xl font-black tracking-tight text-brand-green-ink">
        {portal === "worker" ? "KRISHOE worker portal" : "KRISHOE Admin"}
      </h1>
      <p className="mt-3 text-sm leading-7 text-brand-muted">
        {portal === "worker"
          ? text(WORKER_SIGN_IN_HINT.en, WORKER_SIGN_IN_HINT.ne)
          : bootstrapLoginAllowed
          ? text(
              "Sign in with a staff account. During initial setup only, the recovery admin password works when email is left blank.",
              "Staff खाताबाट भित्र जानुहोस्। सुरुको सेटअपमा मात्र — email खाली छोड्दा recovery admin password चल्छ।",
            )
          : text(ADMIN_SIGN_IN_HINT.en, ADMIN_SIGN_IN_HINT.ne)}
      </p>

      {/* Offered above the password, because it is the better way in when the
          device has one. It removes itself where passkeys cannot work, so the
          password below is never left as the unexplained second choice. */}
      <PasskeySignInButton nextPath={nextPath} />

      {/* One box, either identity. A worker who has no email should not have to
          work out which of two fields their number belongs in; the server
          decides from whether the value carries an "@". type="text", because
          type="email" would make the browser reject a phone number before the
          form was ever submitted. */}
      <label className="mt-7 grid gap-2 text-sm font-semibold text-brand-green-ink">
        {text("Email or mobile number", "Email वा मोबाइल नम्बर")}
        <input
          name="email"
          type="text"
          inputMode="email"
          // A phone capitalises the first letter of a text field and runs
          // autocorrect over it. The email lookup is case-insensitive so a
          // capital survives, but autocorrect rewriting a word inside the
          // address does not, and either way the box shows something the owner
          // did not type — which reads as the app refusing a correct address.
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required={!bootstrapLoginAllowed}
          autoComplete="username"
          className="h-12 rounded-lg border border-black/15 bg-[#FFFFFF] px-4 font-normal text-[#16211C] outline-none placeholder:text-brand-muted-soft focus:border-brand-green"
          placeholder={text("your email or mobile number", "तपाईंकै email वा मोबाइल नम्बर")}
        />
      </label>
      {/* A worker from India or the Gulf (owner, 2026-10-04): their number
          opens the app with its country code or without it. Only an account
          the owner made opens at all. */}
      {portal === "worker" ? (
        <p className="mt-1.5 text-xs leading-5 text-brand-muted">
          🌏 {text(
            "From India or another country? Type +91 … or just the number — both work.",
            "भारत वा अर्को देशको नम्बर? +91 … लेख्नुहोस् वा नम्बर मात्र — दुवै हुन्छ।",
          )}
        </p>
      ) : null}

      {/* The eye sits beside the box, outside the label, so the label still
          names only the box and a tap on the eye never focuses the field. */}
      <div className="mt-4 grid gap-2 text-sm font-semibold text-brand-green-ink">
        <label htmlFor="admin-login-password">Password</label>
        <div className="relative">
          <input
            id="admin-login-password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onKeyDown={watchCapsLock}
            onKeyUp={watchCapsLock}
            onBlur={() => setCapsLockOn(false)}
            aria-describedby={capsLockOn ? "admin-login-capslock" : undefined}
            className="h-12 w-full rounded-lg border border-black/15 bg-[#FFFFFF] pl-4 pr-14 font-normal text-[#16211C] outline-none placeholder:text-brand-muted-soft focus:border-brand-green"
            placeholder={text("your password", "तपाईंकै password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((shown) => !shown)}
            aria-pressed={showPassword}
            aria-label={showPassword ? text("Hide password", "Password लुकाउनुहोस्") : text("Show password", "Password देखाउनुहोस्")}
            title={showPassword ? text("Hide password", "Password लुकाउनुहोस्") : text("Show password", "Password देखाउनुहोस्")}
            className="absolute inset-y-1 right-1 grid w-11 place-items-center rounded-md text-brand-green-ink hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-green"
          >
            {showPassword ? (
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3l18 18" />
                <path d="M10.6 5.1A10.5 10.5 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6A17.4 17.4 0 0 0 2 12s3.5 7 10 7a9.9 9.9 0 0 0 5.4-1.6" />
                <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
              </svg>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
        {capsLockOn ? (
          <p id="admin-login-capslock" role="status" className="rounded-md bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">
            {text("⚠ Caps Lock is on — the password may come out in capitals.", "⚠ Caps Lock अन छ — password ठूलो अक्षरमा जान सक्छ।")}
          </p>
        ) : null}
      </div>

      {/* Eight hours is right for a machine other people can reach and wrong
          for the phone in the owner's pocket, where it means password, wait for
          an emailed code, type six digits — most days, standing on the factory
          floor. Offered, never assumed: unticked by default, and it says whose
          device it is meant for. */}
      <label className="mt-5 flex items-start gap-3 text-sm font-semibold text-brand-green-ink">
        <input
          type="checkbox"
          name="remember"
          className="mt-0.5 h-5 w-5 shrink-0 accent-brand-green"
        />
        <span>
          {text("Remember this device — 30 days", "यो यन्त्र सम्झनुहोस् — ३० दिन")}
          <span className="mt-0.5 block text-xs font-medium text-brand-muted">
            {text(
              "Only on your own phone or computer. Never tick this on a shared device.",
              "आफ्नै फोन वा computer मा मात्र। अरूले चलाउने यन्त्रमा नटिक्नुहोस्।",
            )}
          </span>
        </span>
      </label>

      <div className="mt-6 grid gap-3">
        <SubmitButton
          idleLabel={
            isPending
              ? text("Checking password", "Password जाँच्दैछौँ")
              : portal === "worker"
                ? text("Open worker portal", "कामदार portal खोल्ने")
                : text("Unlock admin", "Admin खोल्ने")
          }
          pendingLabel={text("Checking password", "Password जाँच्दैछौँ")}
          disabled={isPending}
        />
        {state.message && !state.ok ? (
          <p aria-live="polite" className="rounded-lg bg-brand-clay-mist p-4 text-sm font-semibold text-brand-clay">
            {state.message}
          </p>
        ) : null}
        {portal === "worker" ? (
          <WorkerForgotHelp />
        ) : (
          <Link
            href="/admin/forgot-password"
            className="text-center text-sm font-black text-brand-green hover:underline"
          >
            {text("Forgotten your password?", "आफ्नो password बिर्सनुभयो?")}
          </Link>
        )}
      </div>
    </form>
  );
}
