"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPosInvoiceAction } from "@/app/admin/pos/actions";
import { useLanguage } from "@/components/LanguageProvider";
import {
  POS_RESTORE_KEY,
  holdForYou,
  readQueue,
  removeQueued,
  sendQueue,
  useOfflineQueue,
  useOnline,
  type Queued,
  type SendResult,
} from "@/lib/offline-queue";

/** How often to try again while something waits and the browser says it is online. */
const RETRY_MS = 20_000;

async function sendOne(item: Queued): Promise<SendResult> {
  if (item.kind === "bill") {
    const form = new FormData();
    for (const [name, value] of item.entries) form.append(name, value);
    const result = await createPosInvoiceAction(null, form);
    return result.ok ? { ok: true } : { ok: false, message: result.message };
  }
  const response = await fetch("/api/factory/work", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": item.idempotencyKey },
    body: item.body,
  });
  if (response.ok) return { ok: true };
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  return { ok: false, message: data.error || `The shop answered ${response.status}.` };
}

/**
 * Sends what this phone kept while the internet was away (lib/offline-queue),
 * from any admin screen, and says so in one small pill above the dock (owner,
 * 2026-10-20, rule 4). A bill or entry the shop would not take is held with
 * its reason, to open again on the counter or to remove.
 */
export default function OfflineSync() {
  const { text } = useLanguage();
  const router = useRouter();
  const queue = useOfflineQueue();
  const online = useOnline();
  const [sending, setSending] = useState(false);
  const [justSent, setJustSent] = useState(0);
  const [open, setOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState("");
  const busy = useRef(false);

  const waiting = queue.filter((item) => item.status === "waiting");
  const held = queue.filter((item) => item.status === "needs-you");
  const bills = waiting.filter((item) => item.kind === "bill").length;
  const work = waiting.length - bills;

  useEffect(() => {
    async function run() {
      if (busy.current || !navigator.onLine) return;
      if (!readQueue().some((item) => item.status === "waiting")) return;
      busy.current = true;
      setSending(true);
      try {
        const result = await sendQueue(readQueue(), sendOne, () => navigator.onLine);
        for (const id of result.sent) removeQueued(id);
        for (const { id, message } of result.held) holdForYou(id, message);
        if (result.sent.length > 0) {
          setJustSent(result.sent.length);
          router.refresh();
        }
      } finally {
        busy.current = false;
        setSending(false);
      }
    }
    void run();
    const again = window.setInterval(run, RETRY_MS);
    window.addEventListener("online", run);
    return () => {
      window.clearInterval(again);
      window.removeEventListener("online", run);
    };
  }, [router]);

  useEffect(() => {
    if (!justSent) return;
    const timer = window.setTimeout(() => setJustSent(0), 6000);
    return () => window.clearTimeout(timer);
  }, [justSent]);

  function openOnCounter(item: Queued) {
    if (item.kind !== "bill") return;
    try {
      window.localStorage.setItem(POS_RESTORE_KEY, JSON.stringify({ id: item.id, ...item.snapshot }));
    } catch {
      return;
    }
    setOpen(false);
    router.push("/admin/pos");
  }

  const words = (item: Queued) => text(item.label.en, item.label.ne);

  // Nothing kept, nothing to say: the page's own notice tells of the internet.
  if (queue.length === 0 && !justSent) return null;

  const pill = !online && waiting.length > 0
    ? text(
        `📴 On this phone: ${bills} ${bills === 1 ? "bill" : "bills"}, ${work} work — sent when the internet is back`,
        `📴 फोनमा: ${bills} बिल, ${work} काम — internet आएपछि जान्छ`,
      )
    : held.length > 0
      ? text(`⚠ ${held.length} to look at`, `⚠ ${held.length} हेर्नुपर्ने`)
      : sending || waiting.length > 0
        ? text(`⏳ Sending ${waiting.length}…`, `⏳ ${waiting.length} पठाउँदै…`)
        : text(`✓ ${justSent} sent to the shop`, `✓ ${justSent} वटा पठाइयो`);

  const tone = !online || held.length > 0 ? "border-amber-300 bg-amber-50 text-amber-900" : "border-brand-green-line bg-brand-green-wash text-brand-green";

  // Above the dock and the bill's own bar on a phone (the counter's top bar is
  // shorter than the rest, so the top would cover its notice); at the foot on
  // the right from a tablet up. The list opens above the pill.
  return (
    <div className="fixed bottom-[calc(10.75rem+env(safe-area-inset-bottom))] left-3 right-3 z-40 flex flex-col items-start gap-2 md:bottom-4 md:left-auto md:right-4 md:w-96 md:items-end print:hidden">
      {open && queue.length > 0 ? (
        <div role="dialog" aria-label={text("On this phone", "यो फोनमा")} className="w-full rounded-2xl border border-brand-green-line bg-brand-paper p-3 shadow-xl">
          <ul className="grid gap-2">
            {queue.map((item) => (
              <li key={item.id} className="grid gap-1.5 rounded-xl border border-brand-green-line p-2.5 text-sm">
                <p className="font-black text-brand-green-ink">
                  {item.kind === "bill" ? "🧾 " : "🧵 "}
                  {words(item)}
                </p>
                {item.status === "needs-you" ? (
                  <>
                    <p className="text-amber-900">⚠ {item.message}</p>
                    <div className="flex flex-wrap gap-2">
                      {item.kind === "bill" ? (
                        <button type="button" onClick={() => openOnCounter(item)} className="min-h-11 rounded-full bg-brand-green px-4 font-black text-white">
                          {text("Open on the bill", "बिलमा खोल्ने")}
                        </button>
                      ) : null}
                      {confirmRemove === item.id ? (
                        <button
                          type="button"
                          onClick={() => {
                            removeQueued(item.id);
                            setConfirmRemove("");
                          }}
                          className="min-h-11 rounded-full bg-brand-clay px-4 font-black text-white"
                        >
                          {text("Yes, remove it", "हो, हटाउने")}
                        </button>
                      ) : (
                        <button type="button" onClick={() => setConfirmRemove(item.id)} className="min-h-11 rounded-full border border-brand-green-line px-4 font-black text-brand-muted">
                          {text("Remove", "हटाउने")}
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-brand-muted">{text("Waiting for the internet", "internet कुर्दै")}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={`min-h-11 max-w-full rounded-full border px-4 text-sm font-black shadow-md ${tone}`}
      >
        {pill}
      </button>
    </div>
  );
}
