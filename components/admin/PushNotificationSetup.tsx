"use client";

import { useEffect, useState } from "react";

/**
 * Turning on the alert that reaches the owner's phone.
 *
 * Permission for notifications can only be asked for from a click — browsers
 * refuse a prompt that appears on its own — so this is a button rather than
 * something that happens on load.
 *
 * It is per device, not per account. Enabling it on the phone does not enable
 * it on the shop computer, which surprises people, so the copy says so.
 */

type Status =
  | "checking"
  | "unsupported"
  | "not-configured"
  | "denied"
  | "off"
  | "on"
  | "working";

function urlBase64ToUint8Array(base64: string) {
  // The VAPID public key travels as base64url; the subscribe call wants bytes.
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

/**
 * Works out where this device stands, as one async answer.
 *
 * Every branch is awaited rather than returned synchronously, so the effect
 * below makes exactly one state update and makes it after an await — a state
 * change in the synchronous part of an effect is both a lint error here and an
 * extra render for nothing.
 */
async function resolveStatus(publicKey: string): Promise<Status> {
  if (!publicKey) return "not-configured";
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "denied";

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription ? "on" : "off";
  } catch {
    return "off";
  }
}

export default function PushNotificationSetup({ publicKey }: { publicKey: string }) {
  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void resolveStatus(publicKey).then((next) => {
      if (active) setStatus(next);
    });
    return () => {
      active = false;
    };
  }, [publicKey]);

  async function enable() {
    setStatus("working");
    setMessage("");

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        // Required by every browser: a push that cannot be shown to the user is
        // not allowed to be delivered silently.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const response = await fetch("/api/admin/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "subscribe",
          subscription: subscription.toJSON(),
          label: navigator.userAgent.slice(0, 60),
        }),
      });

      if (!response.ok) throw new Error("save failed");
      setStatus("on");
      setMessage("चालु भयो। अब अर्डर आउने बित्तिकै यो यन्त्र बज्छ।");
    } catch {
      setStatus("off");
      setMessage("चालु गर्न सकिएन। फेरि प्रयास गर्नुहोस्।");
    }
  }

  async function disable() {
    setStatus("working");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/admin/push", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "unsubscribe", subscription: subscription.toJSON() }),
        });
        await subscription.unsubscribe();
      }
      setStatus("off");
      setMessage("बन्द भयो।");
    } catch {
      setStatus("on");
    }
  }

  async function test() {
    setMessage("पठाइँदैछ…");
    const response = await fetch("/api/admin/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "test" }),
    });
    const result = (await response.json()) as { sent?: number };
    setMessage(
      result.sent ? `${result.sent} यन्त्रमा पठाइयो।` : "कुनै यन्त्रमा पुगेन।",
    );
  }

  return (
    <section className="rounded-2xl border border-brand-green/15 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-brand-green-ink">फोनमा तुरुन्तै खबर</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600">
        अर्डर आउने बित्तिकै यो यन्त्र बज्छ — app नखोली। राति आएको अर्डर बिहानसम्म
        थाहा नहुने समस्या यसैले हट्छ।
      </p>

      {status === "not-configured" ? (
        <p className="mt-4 rounded-xl bg-brand-clay-mist px-4 py-3 text-sm font-bold text-brand-clay">
          Vercel मा <code>NEXT_PUBLIC_VAPID_PUBLIC_KEY</code> र{" "}
          <code>VAPID_PRIVATE_KEY</code> राख्न बाँकी छ।
        </p>
      ) : null}

      {status === "unsupported" ? (
        <p className="mt-4 rounded-xl bg-brand-clay-mist px-4 py-3 text-sm font-bold text-brand-clay">
          यो browser ले notification दिँदैन। iPhone मा हो भने पहिले{" "}
          <strong>Share → Add to Home Screen</strong> गरेर app बाट खोल्नुहोस्।
        </p>
      ) : null}

      {status === "denied" ? (
        <p className="mt-4 rounded-xl bg-brand-clay-mist px-4 py-3 text-sm font-bold text-brand-clay">
          यो यन्त्रमा notification रोकिएको छ। browser को सेटिङबाट अनुमति दिनुहोस्, अनि
          यो पाना फेरि खोल्नुहोस्।
        </p>
      ) : null}

      {status === "off" || status === "on" || status === "working" ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${
              status === "on" ? "bg-emerald-100 text-emerald-900" : "bg-gray-100 text-gray-700"
            }`}
          >
            {status === "on" ? "चालु" : "बन्द"}
          </span>

          {status === "on" ? (
            <>
              <button
                type="button"
                onClick={() => void test()}
                className="min-h-11 rounded-full bg-brand-green px-5 text-sm font-black text-white"
              >
                जाँच सन्देश पठाउने
              </button>
              <button
                type="button"
                onClick={() => void disable()}
                className="min-h-11 rounded-full border border-black/15 px-5 text-sm font-bold text-brand-green-ink"
              >
                बन्द गर्ने
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void enable()}
              disabled={status === "working"}
              className="min-h-11 rounded-full bg-brand-green px-6 text-sm font-black text-white disabled:opacity-60"
            >
              {status === "working" ? "गर्दैछौँ…" : "यो यन्त्रमा चालु गर्ने"}
            </button>
          )}
        </div>
      ) : null}

      {message ? <p className="mt-3 text-sm font-semibold text-brand-green">{message}</p> : null}

      <p className="mt-4 text-xs leading-5 text-gray-500">
        ⚠️ यो <strong>यन्त्र-यन्त्रको</strong> सेटिङ हो। फोनमा चालु गर्दा computer मा आफैँ
        चालु हुँदैन — दुवैमा छुट्टाछुट्टै गर्नुपर्छ।
      </p>
    </section>
  );
}
