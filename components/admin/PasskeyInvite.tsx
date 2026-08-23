"use client";

import { useCallback, useEffect, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import {
  finishPasskeyRegistrationAction,
  listPasskeysAction,
  startPasskeyRegistrationAction,
} from "@/app/admin/login/passkey-actions";
import { usePasskeySupport } from "@/lib/use-passkey-support";

/**
 * Offers to register this device, once, just after signing in.
 *
 * Passkeys have to be registered on each device separately — a fingerprint
 * saved on a laptop cannot unlock a phone — and the shop had none registered at
 * all. The screen that registers them is Settings → Login devices, which the
 * owner had no reason to visit and no way to know existed: the sign-in page
 * simply said "no passkey on this device" and left it there.
 *
 * So the offer comes to them, at the one moment it makes sense: they have just
 * typed a password, on the device they are holding, and would rather not do it
 * again. One tap and the phone asks for a face or a fingerprint.
 *
 * It never blocks anything. The password stays the way in — this only removes
 * the typing — and declining is remembered so the card does not become an
 * advert for something already refused.
 */

const ASKED_KEY = "krishoe-passkey-asked";

/** Long enough for the page behind it to settle. */
const DELAY_MS = 1800;

function deviceLabel() {
  const agent = navigator.userAgent;
  if (/iPhone|iPad/i.test(agent)) return "iPhone";
  if (/Android/i.test(agent)) return "Android फोन";
  if (/Mac/i.test(agent)) return "Mac";
  return "Computer";
}

/** What the device calls the thing it will ask for. */
function unlockWord() {
  const agent = navigator.userAgent;
  if (/iPhone|iPad|Mac/i.test(agent)) return "Face ID वा Touch ID";
  if (/Android/i.test(agent)) return "औंलाको छाप";
  return "Windows Hello";
}

type Stage = "hidden" | "asking" | "working" | "done" | "failed";

export default function PasskeyInvite() {
  const supported = usePasskeySupport();
  const [stage, setStage] = useState<Stage>("hidden");
  const [problem, setProblem] = useState("");

  useEffect(() => {
    if (!supported) return;

    let timer: number | undefined;
    let cancelled = false;

    (async () => {
      try {
        if (window.localStorage.getItem(ASKED_KEY)) return;
      } catch {
        // Storage blocked. Ask this once rather than never.
      }

      // Only when this account has none anywhere. Asking someone who already
      // uses a passkey elsewhere is still useful — a phone and a laptop each
      // need their own — but asking on every sign-in would be nagging, and the
      // dismissal below covers it.
      const existing = await listPasskeysAction().catch(() => null);
      if (cancelled || !existing || existing.length > 0) return;

      timer = window.setTimeout(() => setStage("asking"), DELAY_MS);
    })();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [supported]);

  const remember = useCallback(() => {
    try {
      window.localStorage.setItem(ASKED_KEY, "1");
    } catch {
      // Nothing to do; the card closes either way.
    }
  }, []);

  async function register() {
    setStage("working");
    setProblem("");

    try {
      const started = await startPasskeyRegistrationAction();
      if (!started.ok) {
        setProblem(started.reason);
        setStage("failed");
        return;
      }

      const attestation = await startRegistration({ optionsJSON: started.options });
      const result = await finishPasskeyRegistrationAction(attestation, deviceLabel());

      if (!result.ok) {
        setProblem(result.reason);
        setStage("failed");
        return;
      }

      remember();
      setStage("done");
    } catch {
      // A cancelled Face ID prompt lands here, and it is not an error worth a
      // red box — the person simply changed their mind.
      setProblem("दर्ता भएन। फेरि प्रयास गर्न Settings → Login devices मा जानुहोस्।");
      setStage("failed");
    }
  }

  if (stage === "hidden") return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border border-brand-gold/40 bg-white p-4 shadow-[0_18px_50px_rgba(11,77,59,0.22)] md:inset-x-auto md:right-6 md:bottom-6">
      {stage === "done" ? (
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none" aria-hidden="true">
            ✅
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-black text-brand-green-ink">यो {deviceLabel()} दर्ता भयो</p>
            <p className="mt-0.5 text-sm text-brand-muted">
              अर्को पटक {unlockWord()} ले खुल्छ — password टाइप गर्नु पर्दैन।
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStage("hidden")}
            aria-label="बन्द गर्ने"
            className="-mr-1 -mt-1 rounded-lg px-2 py-1 text-lg leading-none text-brand-muted hover:bg-brand-mist"
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none" aria-hidden="true">
            🔒
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-black leading-6 text-brand-green-ink">
              अर्को पटक {unlockWord()} ले खोल्ने?
            </p>
            <p className="mt-1 text-sm leading-6 text-brand-muted">
              यो {deviceLabel()} एक पटक दर्ता गर्नुहोस् — अनि password टाइप गर्नु पर्दैन।
            </p>

            {stage === "failed" && problem ? (
              <p className="mt-2 rounded-lg bg-brand-clay-tint px-3 py-2 text-xs font-bold leading-5 text-brand-clay">
                {problem}
              </p>
            ) : null}

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={register}
                disabled={stage === "working"}
                className="min-h-11 rounded-xl bg-brand-green px-3 text-sm font-black text-white disabled:opacity-60"
              >
                {stage === "working" ? "दर्ता हुँदै…" : "हुन्छ, दर्ता गर्ने"}
              </button>
              <button
                type="button"
                onClick={() => {
                  remember();
                  setStage("hidden");
                }}
                className="min-h-11 rounded-xl border border-brand-green/30 bg-white px-3 text-sm font-black text-brand-green-ink"
              >
                पछि
              </button>
            </div>

            <p className="mt-2 text-xs leading-5 text-gray-500">
              password पहिलेकै जस्तै चल्छ — यो थपिने सुविधा हो।
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
