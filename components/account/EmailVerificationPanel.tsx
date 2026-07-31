"use client";

import { FormEvent, useState } from "react";
import type { SafeUser } from "@/lib/user-store";
import {
  requestEmailVerificationAction,
  type AccountActionState,
} from "@/app/account/actions";
import SubmitButton from "@/components/SubmitButton";

const initialState: AccountActionState = { ok: false, message: "" };

export default function EmailVerificationPanel({ user }: { user: SafeUser }) {
  const [state, setState] = useState<AccountActionState>(initialState);
  const [isPending, setIsPending] = useState(false);
  const isEmailVerified = Boolean(user.emailVerifiedAt);
  const isPhoneVerified = Boolean(user.phoneVerifiedAt);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);

    try {
      setState(await requestEmailVerificationAction());
    } finally {
      setIsPending(false);
    }
  }

  return (
    <section className="rounded-lg border border-black/10 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
        Account trust
      </p>
      <h2 className="mt-3 text-xl font-black text-brand-green-ink">Account verification</h2>
      <p className="mt-2 text-sm leading-6 text-brand-muted">
        {isEmailVerified
          ? "Your email is verified. Guest orders using this email can safely link to your account."
          : "Verify your email to safely link guest orders and unlock private order details."}
      </p>

      <div className="mt-5 grid gap-3 rounded-lg bg-brand-mist p-4 text-sm">
        <div>
          <p className="font-bold text-brand-green-ink">{user.email}</p>
          <p className="mt-1 font-semibold text-brand-muted">
            {isEmailVerified ? `Verified ${new Date(user.emailVerifiedAt ?? "").toLocaleDateString("en-IN")}` : "Not verified yet"}
          </p>
        </div>
        <div className="border-t border-black/10 pt-3">
          <p className="font-bold text-brand-green-ink">{user.phone || "No phone saved"}</p>
          <p className="mt-1 font-semibold text-brand-muted">
            {isPhoneVerified
              ? `Phone verified ${new Date(user.phoneVerifiedAt ?? "").toLocaleDateString("en-IN")}`
              : "Phone is verified manually by KRISHOE after WhatsApp or call confirmation."}
          </p>
        </div>
      </div>

      {!isEmailVerified ? (
        <form onSubmit={handleSubmit} className="mt-5 grid gap-3">
          <SubmitButton
            idleLabel={isPending ? "Sending link" : "Send verification link"}
            pendingLabel="Sending link"
            disabled={isPending}
          />
          {state.message ? (
            <p
              aria-live="polite"
              className={`rounded-lg p-3 text-sm font-semibold ${
                state.ok ? "bg-brand-green-mist text-brand-green" : "bg-brand-clay-mist text-brand-clay"
              }`}
            >
              {state.message}
            </p>
          ) : null}
          {state.verificationLink ? (
            <a
              href={state.verificationLink}
              className="inline-flex h-11 items-center justify-center rounded-full border border-brand-green px-5 text-sm font-bold text-brand-green transition hover:bg-brand-mist"
            >
              Open local verify link
            </a>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
