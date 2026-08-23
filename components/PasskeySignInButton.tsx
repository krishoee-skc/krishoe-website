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
      // On a device that has no passkey saved, the browser cannot say so. It
      // offers to scan a QR code from another device instead, and when that
      // sheet is dismissed it throws the same NotAllowedError as someone who
      // simply changed their mind at the fingerprint prompt.
      //
      // Treating both as "nothing to say" is what made the owner's phone look
      // broken: the button was pressed, a QR sheet appeared, it was closed, and
      // the page sat there in silence. Nothing on screen said the phone has no
      // passkey yet, or that the password below still works.
      const name = (cause as { name?: string })?.name;
      if (name === "NotAllowedError" || name === "AbortError") {
        setError(
          // Says what to do next, not just what is missing. "Login devices" was
          // a screen name the reader had to go and find; the shop now offers
          // the registration itself the moment they are inside, so the honest
          // instruction is simply to sign in and say yes.
          "यो फोनमा अझै दर्ता भएको छैन — passkey हरेक यन्त्रमा एक पटक दर्ता गर्नुपर्छ। तलको password ले पस्नुहोस्, भित्र गएपछि दर्ता गर्ने बाटो आफैँ देखिन्छ।"
        );
      } else {
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
        {busy ? "खुल्दैछ…" : "🔓 यो यन्त्रले चिनेर भित्र जाने"}
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
