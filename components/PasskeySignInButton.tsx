"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import {
  finishPasskeyLoginAction,
  startPasskeyLoginAction,
} from "@/app/admin/login/passkey-actions";
import { usePasskeySupport } from "@/lib/use-passkey-support";

/**
 * Signing in with a fingerprint, beside the password form rather than instead
 * of it.
 *
 * The button hides itself where passkeys cannot work — an older browser, or a
 * plain http address — because a button that fails when pressed teaches people
 * to distrust the whole screen. The password underneath always works.
 */
export default function PasskeySignInButton({ nextPath = "/admin" }: { nextPath?: string }) {
  const supported = usePasskeySupport();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  if (!supported) return null;

  async function signIn() {
    setBusy(true);
    setError("");

    try {
      const started = await startPasskeyLoginAction();
      const assertion = await startAuthentication({ optionsJSON: started.options });
      const result = await finishPasskeyLoginAction(assertion);

      if (!result.ok) {
        setError(result.message || "पहिचान मिलेन।");
        return;
      }

      router.push(result.nextPath ?? nextPath);
      router.refresh();
    } catch (cause) {
      // Cancelling the fingerprint prompt throws too, and that is not a failure
      // worth shouting about — the person simply changed their mind.
      const name = (cause as { name?: string })?.name;
      if (name !== "NotAllowedError" && name !== "AbortError") {
        setError("Passkey ले खोल्न सकेन। तलको password प्रयोग गर्नुहोस्।");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={() => void signIn()}
        disabled={busy}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border-2 border-brand-green bg-[#FFFFFF] px-5 text-sm font-black text-brand-green transition hover:bg-brand-green hover:text-white disabled:opacity-60"
      >
        {busy ? "खुल्दैछ…" : "👆 औंलाको छापले भित्र जाने"}
      </button>

      {error ? (
        <p className="mt-2 text-sm font-semibold text-brand-clay">{error}</p>
      ) : null}

      <div className="mt-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-black/10" />
        <span className="text-xs font-bold uppercase tracking-wider text-brand-muted">वा</span>
        <span className="h-px flex-1 bg-black/10" />
      </div>
    </div>
  );
}
