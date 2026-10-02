"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import { joinMessage, spacedCode, whatsappNumberFor } from "@/lib/worker-join";
import { joinWorkerToAppAction, newWorkerCodeAction, type WorkerJoinResult } from "./actions";

export type WorkerApp = { phone: string; status: string; lastLoginAt?: string };

/** "today 9:12", "yesterday", "3 days ago" — when the worker last opened the app. */
function lastSeen(iso: string | undefined, text: (en: string, ne: string) => string) {
  if (!iso) return text("Not opened yet", "अझै खोलेको छैन");
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  const time = then.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kathmandu" });
  if (days <= 0) return text(`Signed in today at ${time}`, `आज ${time} मा login`);
  if (days === 1) return text("Signed in yesterday", "हिजो login");
  return text(`Signed in ${days} days ago`, `${days} दिनअघि login`);
}

/**
 * A worker's door into the app, on their own row (owner, 2026-10-02).
 *
 * No app yet: the mobile number, one press, and the card to hand over — the
 * code, the QR to the sign-in page, and the whole message ready to go on
 * WhatsApp. Already in: their number, and a new code if they forgot. The code
 * is shown here once and kept nowhere; the next press makes another.
 */
export default function WorkerAppPanel({ workerId, workerName, app, workerActive = true }: { workerId: string; workerName: string; app?: WorkerApp; workerActive?: boolean }) {
  const { text } = useLanguage();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<WorkerJoinResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  // The row's "App ✓" comes from the server, so it is asked again once the
  // account exists; the card stays up until Done.
  const run = (action: () => Promise<WorkerJoinResult>) =>
    start(async () => {
      const reply = await action();
      setResult(reply);
      if (reply.ok) router.refresh();
    });
  const join = () => run(() => joinWorkerToAppAction(workerId, phone));
  const renew = () => run(() => newWorkerCodeAction(workerId));

  const card = result && result.ok ? result : null;
  const failure = result && !result.ok ? result : null;
  const message = card ? joinMessage({ name: card.name, phone: card.phone, code: card.code, loginUrl: card.loginUrl }) : "";
  const whatsapp = card ? `https://wa.me/${whatsappNumberFor(card.phone)}?text=${encodeURIComponent(message)}` : "";

  return (
    <div className="mt-4 rounded-2xl border border-brand-green-line bg-brand-mist p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-black text-brand-green-ink">
          📱 {text("App", "App")}
          {app ? (
            <span className="rounded-full bg-brand-green-wash px-2.5 py-0.5 text-xs font-black text-brand-green">
              {app.status === "Active" ? text("Has the app ✓", "App छ ✓") : text("App closed 🔒", "App बन्द 🔒")} · {app.phone}
            </span>
          ) : (
            <span className="rounded-full bg-brand-cream-soft px-2.5 py-0.5 text-xs font-black text-brand-gold-ink">{text("No app yet", "App छैन")}</span>
          )}
        </p>
        {!card && workerActive ? (
          app ? (
            <button
              type="button"
              disabled={pending}
              onClick={renew}
              className="min-h-10 rounded-xl border border-brand-green px-3 text-sm font-black text-brand-green disabled:opacity-60"
            >
              {pending ? text("Making…", "बनाउँदै…") : text("New code", "नयाँ कोड")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              className="min-h-10 rounded-xl bg-brand-green px-3 text-sm font-black text-white"
            >
              {text("Join the app", "App मा जोड्ने")}
            </button>
          )
        ) : null}
      </div>

      {app ? <p className="mt-1 text-xs font-bold text-brand-muted">{lastSeen(app.lastLoginAt, text)}</p> : null}

      {app && !workerActive ? (
        <p className="mt-2 text-xs leading-5 text-brand-muted">
          {text(
            "Left the factory — their app is switched off. To bring them back: \"Make active again\", then \"New code\".",
            "काम छोडेको — app बन्द छ। फेरि राख्न: \"फेरि चालु गर्ने\", अनि \"नयाँ कोड\"।",
          )}
        </p>
      ) : null}

      {app && workerActive && !card ? (
        <p className="mt-2 text-xs leading-5 text-brand-muted">
          {text(
            "Forgot the password, or a new phone? \"New code\" signs their phones out and makes a code for them to start again.",
            "Password बिर्सियो वा नयाँ फोन? \"नयाँ कोड\" थिच्दा पुरानो फोनबाट बाहिर निस्कन्छ र फेरि सुरु गर्ने कोड बन्छ।",
          )}
        </p>
      ) : null}

      {!app && open && !card ? (
        <div className="mt-3 grid gap-2">
          <label className="grid gap-1 text-sm font-bold text-brand-green-ink">
            {text(`${workerName}'s mobile number`, `${workerName} को मोबाइल नम्बर`)}
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="98XXXXXXXX"
              className="min-h-12 rounded-xl border border-brand-green-line bg-brand-paper px-3 text-base text-brand-green-ink"
            />
          </label>
          <button
            type="button"
            disabled={pending || phone.replace(/\D/g, "").length < 7}
            onClick={join}
            className="min-h-12 rounded-xl bg-brand-green px-4 text-sm font-black text-white disabled:opacity-60"
          >
            {pending ? text("Making the account…", "खाता बनाउँदै…") : text("Make the account and the code", "खाता र कोड बनाउने")}
          </button>
          <p className="text-xs leading-5 text-brand-muted">
            {text(
              "No email or password needed — the app makes an 8-digit code. The worker sets their own password at the first sign-in.",
              "Email वा password चाहिँदैन — app ले ८ अंकको कोड बनाउँछ। कामदारले पहिलो पटक भित्र जाँदा आफ्नै password बनाउँछ।",
            )}
          </p>
        </div>
      ) : null}

      {failure ? <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-800">{text(failure.en, failure.ne)}</p> : null}

      {card ? (
        <div className="mt-3 grid gap-3 rounded-2xl border-2 border-dashed border-brand-green bg-brand-paper p-3">
          <p className="text-sm font-black text-brand-green">
            {card.renewed
              ? text(`New code for ${card.name} ✅`, `${card.name} को नयाँ कोड ✅`)
              : text(`${card.name} is in the app ✅`, `${card.name} को खाता खुल्यो ✅`)}
          </p>
          <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-3">
            <img src="/api/admin/factory/worker-portal-qr" alt={text("QR to the worker sign-in page", "कामदार login पानाको QR")} className="h-24 w-24 rounded-lg bg-white p-1" />
            <div className="grid gap-1 text-sm text-brand-green-ink">
              <span>{text("Mobile", "मोबाइल")}: <b>{card.phone}</b></span>
              <span>{text("Code", "कोड")}: <b className="font-mono text-2xl tracking-[0.18em] text-brand-green">{spacedCode(card.code)}</b></span>
              <span className="text-xs text-brand-muted">{text("Shown once — not kept anywhere.", "एक पटक मात्र देखिन्छ — कतै राखिँदैन।")}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={whatsapp}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-green px-4 text-sm font-black text-white"
            >
              {text("Send on WhatsApp", "WhatsApp मा पठाउने")}
            </a>
            <button type="button" onClick={() => window.print()} className="min-h-11 rounded-xl border border-brand-green px-4 text-sm font-black text-brand-green">
              {text("Print", "Print")}
            </button>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setOpen(false);
              }}
              className="min-h-11 rounded-xl px-3 text-sm font-bold text-brand-muted"
            >
              {text("Done", "भयो")}
            </button>
          </div>
          <pre className="whitespace-pre-wrap rounded-xl bg-brand-mist p-3 font-sans text-xs leading-5 text-brand-green-ink">{message}</pre>
        </div>
      ) : null}
    </div>
  );
}
