"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { registerCustomerAction, type AccountActionState } from "@/app/account/actions";
import SubmitButton from "@/components/SubmitButton";
import { useLanguage } from "@/components/LanguageProvider";

const initialState: AccountActionState = {
  ok: false,
  message: "",
};

export default function AccountRegisterForm({ nextPath = "/account" }: { nextPath?: string }) {
  const { text } = useLanguage();
  const [state, setState] = useState<AccountActionState>(initialState);
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);

    try {
      const result = await registerCustomerAction(state, new FormData(event.currentTarget));
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
    <form onSubmit={handleSubmit} className="rounded-lg border border-black/10 bg-brand-paper p-6 shadow-[0_24px_70px_rgba(16,35,29,0.08)]">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">{text("New customer", "नयाँ ग्राहक")}</p>
      <h1 className="mt-3 text-3xl font-black text-brand-green-ink">{text("Create account", "खाता खोल्नुहोस्")}</h1>

      <div className="mt-7 grid gap-4">
        <div className="hidden" aria-hidden="true">
          <label>
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <label className="grid gap-2 text-sm font-semibold text-brand-green-ink">
          {text("Full name", "पूरा नाम")}
          <input name="name" required autoComplete="name" className="h-12 rounded-lg border border-black/10 px-4 font-normal outline-none focus:border-brand-green" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-brand-green-ink">
          Email
          <input name="email" type="email" required autoComplete="email" className="h-12 rounded-lg border border-black/10 px-4 font-normal outline-none focus:border-brand-green" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-brand-green-ink">
          {text("Password", "पासवर्ड")}
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className="h-12 rounded-lg border border-black/10 px-4 font-normal outline-none focus:border-brand-green" />
        </label>
      </div>

      <div className="mt-6 grid gap-3">
        <SubmitButton
          idleLabel={isPending ? "Creating account" : "Create account"}
          pendingLabel="Creating account"
          disabled={isPending}
        />
        {state.message && !state.ok ? (
          <p aria-live="polite" className="rounded-lg bg-brand-clay-mist p-4 text-sm font-semibold text-brand-clay">
            {state.message}
          </p>
        ) : null}
      </div>

      <p className="mt-5 text-sm font-semibold text-brand-muted">
        Already have an account?{" "}
        <Link
          href={`/account/login?next=${encodeURIComponent(nextPath)}`}
          className="text-brand-green hover:text-brand-gold-deep"
        >
          {text("Sign in", "लगइन")}
        </Link>
      </p>
    </form>
  );
}
