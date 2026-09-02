"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInFromEmailLinkAction } from "@/app/admin/login/actions";
import SubmitButton from "@/components/SubmitButton";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * The button that spends the link.
 *
 * A client component so the press is unmistakably a person's: the page around
 * it renders on the server and does nothing but look the token up, which is
 * what keeps a mail provider's link preview from signing anyone in.
 */
export default function EmailLinkSignIn({ token, code }: { token: string; code: string }) {
  const { text } = useLanguage();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);

    try {
      const result = await signInFromEmailLinkAction(new FormData(event.currentTarget));

      if (result.ok) {
        router.push(result.nextPath ?? "/admin");
        router.refresh();
        return;
      }

      setMessage(result.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="hidden" name="t" value={token} />
      <input type="hidden" name="c" value={code} />

      <h1 className="mt-3 text-3xl font-black tracking-tight text-brand-green-ink">
        {text("Sign in to KRISHOE Admin?", "KRISHOE Admin मा भित्र जाने?")}
      </h1>
      <p className="mt-3 text-sm leading-7 text-brand-muted">
        {text("The email code matched. Press below — no code to type.", "Email को कोड मिल्यो। तल थिच्नुहोस् — कोड टाइप गर्नै पर्दैन।")}
      </p>

      <label className="mt-6 flex items-start gap-3 text-sm font-semibold text-brand-green-ink">
        <input type="checkbox" name="remember" className="mt-0.5 h-5 w-5 shrink-0 accent-brand-green" />
        <span>
          {text("Remember this device — 30 days", "यो यन्त्र सम्झनुहोस् — ३० दिन")}
          <span className="mt-0.5 block text-xs font-medium text-brand-muted">
            {text("Only on your own phone or computer. Do not keep it on a device others use.", "आफ्नै फोन वा computer मा मात्र। अरूले चलाउने यन्त्रमा नटिक्नुहोस्।")}
          </span>
        </span>
      </label>

      <div className="mt-6 grid gap-3">
        <SubmitButton idleLabel={busy ? text("Signing in…", "पस्दैछौँ…") : text("Sign in", "भित्र जाने")} pendingLabel={text("Signing in…", "पस्दैछौँ…")} disabled={busy} />

        {message ? (
          <p aria-live="polite" className="rounded-lg bg-brand-clay-mist p-4 text-sm font-semibold text-brand-clay">
            {message}
          </p>
        ) : null}

        <Link href="/admin/login" className="min-h-11 text-sm font-bold text-brand-muted hover:underline">
          {text("Type the code instead", "बरु कोड नै टाइप गर्ने")}
        </Link>
      </div>
    </form>
  );
}
