"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  loginAdminAction,
  resendAdminMfaCodeAction,
  verifyAdminMfaAction,
  type LoginState,
} from "@/app/admin/login/actions";
import SubmitButton from "@/components/SubmitButton";
import PasskeySignInButton from "@/components/PasskeySignInButton";

const initialState: LoginState = {
  ok: false,
  message: "",
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
  const [state, setState] = useState<LoginState>(initialState);
  const [isPending, setIsPending] = useState(false);
  const [code, setCode] = useState("");
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
          KRISHOE · दुई चरणको जाँच
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-brand-green-ink">
          Email हेर्नुहोस्
        </h1>
        <p className="mt-3 text-sm leading-7 text-brand-muted">
          {state.emailHint ?? "तपाईंको staff email"} मा पठाइएको ६ अंकको कोड हाल्नुहोस्। १० मिनेटमा सकिन्छ।
        </p>

        {/* Asking for a code deletes the one before it, and nothing said so.
            The owner asked twice while trying to sign in on their phone, so
            three arrived, the first two were already dead, and there was no way
            to tell which of the three to type. */}
        <p className="mt-3 rounded-xl bg-brand-mist px-3 py-2 text-sm font-semibold leading-6 text-brand-green-ink">
          Email मा एकभन्दा बढी कोड छन् भने — <strong>सबैभन्दा नयाँ मात्र चल्छ</strong>। नयाँ माग्दा पुरानो आफैँ रद्द हुन्छ।
        </p>

        <label className="mt-7 grid gap-2 text-sm font-semibold text-brand-green-ink">
          ६ अंकको कोड
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
            ⚠️ त्यो password जस्तो देखियो — यहाँ चाहिने ६ अंकको कोड हो।
            <span className="mt-0.5 block font-semibold">
              Gmail खोलेर कोड हेर्नुहोस्, अनि हातले टाइप गर्नुहोस्।
            </span>
          </p>
        ) : null}

        <div className="mt-6 grid gap-3">
          <SubmitButton
            idleLabel={isPending ? "जाँच्दैछौँ…" : "कोड हालेर भित्र जाने"}
            pendingLabel="जाँच्दैछौँ…"
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
            नयाँ कोड पठाउने
          </button>
          <button
            type="button"
            onClick={() => setState(initialState)}
            className="min-h-11 text-sm font-bold text-brand-muted hover:underline"
          >
            सुरुबाट फेरि login गर्ने
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md rounded-lg border border-white/15 bg-[#FFFFFF] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.24)]">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
        {portal === "worker" ? "KRISHOE · कामदार" : "KRISHOE · Admin"}
      </p>
      <h1 className="mt-3 text-3xl font-black tracking-tight text-brand-green-ink">
        {portal === "worker" ? "KRISHOE worker portal" : "KRISHOE Admin"}
      </h1>
      <p className="mt-3 text-sm leading-7 text-brand-muted">
        {portal === "worker"
          ? "आफ्नो मोबाइल नम्बर वा email र password हाल्नुहोस्। मालिकले दिएको password पहिलो पटकमै फेर्नुहोस्।"
          : bootstrapLoginAllowed
          ? "Sign in with a staff account. During initial setup only, the recovery admin password works when email is left blank."
          : "आफ्नै email वा मोबाइल नम्बर र आफ्नै password हाल्नुहोस् — मालिकको होइन। यो फोन वा computer Login devices मा दर्ता हुन्छ।"}
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
        Email वा मोबाइल नम्बर
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
          placeholder="तपाईंकै email वा मोबाइल नम्बर"
        />
      </label>

      <label className="mt-4 grid gap-2 text-sm font-semibold text-brand-green-ink">
        Password
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="h-12 rounded-lg border border-black/15 bg-[#FFFFFF] px-4 font-normal text-[#16211C] outline-none placeholder:text-brand-muted-soft focus:border-brand-green"
          placeholder="तपाईंकै password"
        />
      </label>

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
          यो यन्त्र सम्झनुहोस् — ३० दिन
          <span className="mt-0.5 block text-xs font-medium text-brand-muted">
            आफ्नै फोन वा computer मा मात्र। अरूले चलाउने यन्त्रमा नटिक्नुहोस्।
          </span>
        </span>
      </label>

      <div className="mt-6 grid gap-3">
        <SubmitButton
          idleLabel={isPending ? "Checking password" : portal === "worker" ? "Open worker portal" : "Unlock admin"}
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
          आफ्नो password बिर्सनुभयो?
        </Link>
      </div>
    </form>
  );
}
