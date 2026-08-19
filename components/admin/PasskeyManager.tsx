"use client";

import { useEffect, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import {
  deletePasskeyAction,
  finishPasskeyRegistrationAction,
  listPasskeysAction,
  startPasskeyRegistrationAction,
} from "@/app/admin/login/passkey-actions";
import type { StoredPasskey } from "@/lib/passkeys";
import { usePasskeySupport } from "@/lib/use-passkey-support";

/**
 * Adding and removing the devices that can sign in without a password.
 *
 * The list matters as much as the adding. A phone gets lost or sold, and the
 * only useful question then is "which of these was it?" — which is unanswerable
 * from credential ids, so each one is named when it is created.
 */
export default function PasskeyManager() {
  const [keys, setKeys] = useState<StoredPasskey[] | null>(null);
  const supported = usePasskeySupport();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void listPasskeysAction().then((list) => {
      if (active) setKeys(list);
    });
    return () => {
      active = false;
    };
  }, []);

  async function refresh() {
    setKeys(await listPasskeysAction());
  }

  async function add() {
    setBusy(true);
    setMessage("");

    try {
      const started = await startPasskeyRegistrationAction();
      if (!started.ok) {
        setMessage(started.reason);
        return;
      }

      const attestation = await startRegistration({ optionsJSON: started.options });
      const label =
        // Named from the device it is created on, because it is created on the
        // device it belongs to. The owner can see at a glance which is which.
        /iPhone|iPad/i.test(navigator.userAgent)
          ? "iPhone"
          : /Android/i.test(navigator.userAgent)
            ? "Android फोन"
            : /Mac/i.test(navigator.userAgent)
              ? "Mac"
              : "Computer";

      const result = await finishPasskeyRegistrationAction(attestation, label);
      if (!result.ok) {
        setMessage(result.reason);
        return;
      }

      setMessage("भयो — अब यो यन्त्रबाट password बिनै भित्र जान सकिन्छ।");
      await refresh();
    } catch (cause) {
      const name = (cause as { name?: string })?.name;
      if (name === "InvalidStateError") {
        setMessage("यो यन्त्र पहिल्यै दर्ता छ।");
      } else if (name !== "NotAllowedError" && name !== "AbortError") {
        setMessage("दर्ता गर्न सकिएन। फेरि प्रयास गर्नुहोस्।");
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    await deletePasskeyAction(id);
    await refresh();
    setBusy(false);
    setMessage("हटाइयो।");
  }

  return (
    <section className="rounded-2xl border border-brand-green/15 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-brand-green-ink">
        Passkey — password बिनाको login
      </h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600">
        औंलाको छाप वा फोनको PIN ले भित्र जाने। Password टाइप गर्नै पर्दैन, र
        कसैले हेरेर वा अनुमान गरेर चोर्न सक्दैन।
      </p>

      {!supported ? (
        <p className="mt-4 rounded-xl bg-brand-clay-mist px-4 py-3 text-sm font-bold text-brand-clay">
          यो browser मा passkey चल्दैन। नयाँ Chrome/Safari प्रयोग गर्नुहोस्।
        </p>
      ) : (
        <button
          type="button"
          onClick={() => void add()}
          disabled={busy}
          className="mt-4 min-h-11 rounded-full bg-brand-green px-6 text-sm font-black text-white disabled:opacity-60"
        >
          {busy ? "गर्दैछौँ…" : "यो यन्त्र दर्ता गर्ने"}
        </button>
      )}

      {message ? (
        <p className="mt-3 text-sm font-semibold text-brand-green">{message}</p>
      ) : null}

      <div className="mt-5">
        {keys === null ? (
          <p className="text-sm text-gray-500">हेर्दैछौँ…</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-gray-500">
            अहिलेसम्म कुनै यन्त्र दर्ता छैन — password बाटै चलिरहेको छ।
          </p>
        ) : (
          <ul className="grid gap-2">
            {keys.map((key) => (
              <li
                key={key.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3"
              >
                <div>
                  <p className="font-black text-brand-green-ink">
                    {key.label || "यन्त्र"}
                    {key.backedUp ? (
                      <span className="ml-2 rounded-full bg-brand-green-mist px-2 py-0.5 text-xs font-bold text-brand-green">
                        अरू यन्त्रमा पनि
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {key.lastUsedAt
                      ? `पछिल्लो पटक: ${new Date(key.lastUsedAt).toLocaleDateString()}`
                      : "अझै प्रयोग भएको छैन"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void remove(key.id)}
                  disabled={busy}
                  className="min-h-10 rounded-full border border-brand-clay/40 px-4 text-sm font-bold text-brand-clay disabled:opacity-60"
                >
                  हटाउने
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-4 text-xs leading-5 text-gray-500">
        ⚠️ Password हट्दैन — passkey थपिने मात्र हो। फोन हराए password बाटै भित्र
        जान सकिन्छ, अनि यहाँबाट त्यो यन्त्र हटाइदिनुहोस्।
      </p>
    </section>
  );
}
