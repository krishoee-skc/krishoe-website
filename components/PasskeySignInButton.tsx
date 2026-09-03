"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
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
  const { text } = useLanguage();

  if (!supported) return null;

  async function signIn() {
    setBusy(true);
    setError("");

    try {
      const started = await startPasskeyLoginAction();
      const assertion = await startAuthentication({ optionsJSON: started.options });
      const result = await finishPasskeyLoginAction(assertion);

      if (!result.ok) {
        setError(result.message || text("That did not match.", "पहिचान मिलेन।"));
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
      // Both branches say the same two things, because they are the two things
      // that are both true and useful: this device has no KRISHOE passkey
      // saved, and the password below still works.
      //
      // "Passkey could not open it" was the other half of this, and it was
      // useless — the owner pressed the button on a Windows computer while
      // their only passkey sits on an iPhone, and the message read as the app
      // being broken rather than as a passkey being per-device by design.
      // Which DOMException the browser picked does not change the advice:
      // Windows Hello, Safari and a dismissed QR sheet all raise different
      // names for the same situation.
      //
      // It says "device", not "phone": half the times this is read, it is on a
      // computer.
      const name = (cause as { name?: string })?.name;
      setError(
        name === "NotAllowedError" || name === "AbortError"
          ? text(
              "All good — just sign in with the password below. If you'd like password-free sign-in on this device, you can switch it on once you're in.",
              "ठीकै छ — तलको password ले पस्नुहोस्। यो यन्त्रमा password बिना पस्न चाहनुभए, भित्र गएपछि एक पटक चालु गर्न सकिन्छ।",
            )
          : text(
              "No password-free sign-in on this device yet — one set on your phone works on that phone only. Just use the password below.",
              "यो यन्त्रमा password बिनाको सुविधा अझै छैन — फोनमा राखेको त्यही फोनमा मात्र चल्छ। तलको password नै प्रयोग गर्नुहोस्।",
            ),
      );
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
        {busy
          ? text("Opening…", "खुल्दैछ…")
          : text("🔓 Let this device recognise me", "🔓 यो यन्त्रले चिनेर भित्र जाने")}
      </button>

      {/* A calm, friendly note — not an error. A passkey simply not being set up
          on this device is normal (every device needs it once), so it wears a
          soft cream tone with an ℹ️, never the red of something gone wrong. */}
      {error ? (
        <p className="mt-2 rounded-xl border border-brand-gold-bright/40 bg-brand-cream-soft px-3 py-2 text-sm font-semibold leading-6 text-brand-green-ink">
          <span aria-hidden="true">ℹ️ </span>
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-black/10" />
        <span className="text-xs font-bold uppercase tracking-wider text-brand-muted">
          {text("or", "वा")}
        </span>
        <span className="h-px flex-1 bg-black/10" />
      </div>
    </div>
  );
}
