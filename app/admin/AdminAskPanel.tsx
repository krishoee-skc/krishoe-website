"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/Icons";
import { useLanguage } from "@/components/LanguageProvider";
import type { AdminFacts } from "@/lib/ai/admin-assistant-prompt";

/**
 * Ask the shop about itself, in words.
 *
 * Sends the owner's question to /api/admin/assistant, which reads the true
 * numbers first and layers an AI sentence on top. This panel shows both: the
 * real figures as tiles (always), and the AI's plain-language answer above them
 * (when the AI answered). If the AI is off or busy, the tiles still tell the
 * owner what they asked — the box is never blank and never shows a made-up
 * number, because every number here came straight from the API's `facts`.
 *
 * It only reads. There is no control here that changes anything; the tiles link
 * out to the pages where a change is actually made.
 */

type Turn = { role: "owner" | "assistant"; text: string };

const money = (v: number | null) =>
  v === null ? null : `Rs. ${Math.round(v).toLocaleString("en-IN")}`;

export default function AdminAskPanel() {
  const { text } = useLanguage();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [facts, setFacts] = useState<AdminFacts | null>(null);
  const [aiOff, setAiOff] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const suggestions = [
    text("How much did we sell today?", "आज कति बिक्री भयो?"),
    text("What stock is low?", "कुन स्टक कम छ?"),
    text("How much is owed to workers?", "कामदारलाई कति तलब बाँकी?"),
  ];

  async function ask(question: string) {
    const message = question.trim();
    if (!message || busy) return;

    setTurns((prev) => [...prev, { role: "owner", text: message }]);
    setInput("");
    setBusy(true);

    try {
      const response = await fetch("/api/admin/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: turns.slice(-6).map((t) => ({ role: t.role === "owner" ? "user" : "assistant", text: t.text })),
        }),
      });

      // A guard failure (session expired) or a server error answers without
      // facts. Say so plainly rather than leaving a blank turn the owner can't
      // read — most often it means signing in again.
      if (!response.ok) {
        setTurns((prev) => [
          ...prev,
          {
            role: "assistant",
            text:
              response.status === 401
                ? text(
                    "Your session ended — please sign in again.",
                    "तपाईंको session सकियो — फेरि login गर्नुहोस्।",
                  )
                : text(
                    "Couldn't read the shop just now — please try again.",
                    "अहिले शप पढ्न सकिएन — फेरि प्रयास गर्नुहोस्।",
                  ),
          },
        ]);
        return;
      }

      const data = (await response.json()) as {
        facts?: AdminFacts;
        reply?: string | null;
      };

      if (data.facts) setFacts(data.facts);
      setAiOff(!data.reply);

      if (data.reply) {
        setTurns((prev) => [...prev, { role: "assistant", text: data.reply as string }]);
      }
    } catch {
      // Network trouble: keep whatever facts we had, say so plainly.
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          text: text(
            "Couldn't reach the shop just now — please try again.",
            "अहिले जोडिन सकिएन — फेरि प्रयास गर्नुहोस्।",
          ),
        },
      ]);
    } finally {
      setBusy(false);
      setTimeout(
        () => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }),
        30,
      );
    }
  }

  const factTiles: { label: string; value: string | null; href: string }[] = facts
    ? [
        { label: text("Sold today", "आज बिक्री"), value: money(facts.todaySales), href: "/admin/reports" },
        { label: text("Credit owed", "उधारो बाँकी"), value: money(facts.creditOwed), href: "/admin/dues" },
        { label: text("Workers owed", "तलब बाँकी"), value: money(facts.workerOwed), href: "/admin/factory" },
        { label: text("Month profit", "महिना नाफा"), value: money(facts.monthProfit), href: "/admin/purchasing" },
      ]
    : [];

  return (
    <div className="flex min-h-0 flex-col">
      {/* Conversation + facts */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        {turns.length === 0 ? (
          <div>
            <p className="text-sm text-brand-muted">
              {text(
                "Ask about today's sales, low stock, dues or wages owed. I read the shop's real numbers — I never change anything.",
                "आजको बिक्री, कम स्टक, उधारो वा तलब सोध्नुहोस्। म शपको साँचो नम्बर पढ्छु — केही बदल्दिनँ।",
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="rounded-full border border-brand-green-line bg-brand-mist px-3 py-1.5 text-xs font-bold text-brand-green transition hover:border-brand-green"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          turns.map((turn, index) => (
            <div key={index} className={`flex ${turn.role === "owner" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-6 ${
                  turn.role === "owner"
                    ? "bg-brand-green-ink text-white"
                    : "bg-brand-mist text-brand-green-ink ring-1 ring-brand-green-line"
                }`}
              >
                {turn.text}
              </div>
            </div>
          ))
        )}

        {busy ? (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-brand-mist px-3.5 py-2 text-sm text-brand-muted ring-1 ring-brand-green-line">
              {text("Reading the numbers…", "नम्बर हेर्दैछु…")}
            </div>
          </div>
        ) : null}

        {/* The real figures, always shown once asked — the safety net. Even if
            the AI said nothing, these are the true numbers, and each links to
            the page where it can be acted on. */}
        {factTiles.length > 0 ? (
          <div>
            {aiOff ? (
              <p className="mb-2 rounded-lg bg-brand-cream px-3 py-2 text-xs font-semibold text-brand-gold-dark">
                {text(
                  "Here are the real numbers. (The AI answer is resting — the figures are exact.)",
                  "यी साँचो नम्बर हुन्। (AI वाक्य अहिले आएन — नम्बर भने ठ्याक्कै सही छन्।)",
                )}
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              {factTiles.map((tile) => (
                <Link
                  key={tile.label}
                  href={tile.href}
                  className="rounded-xl border border-brand-green-line bg-brand-paper p-3 transition hover:border-brand-green"
                >
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-brand-muted">
                    {tile.label}
                  </span>
                  <span className="mt-1 block font-display text-lg font-black tabular-nums text-brand-green-ink">
                    {tile.value ?? text("—", "—")}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Ask box */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          ask(input);
        }}
        className="mt-3 flex items-end gap-2"
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              ask(input);
            }
          }}
          rows={1}
          placeholder={text("Ask a question…", "प्रश्न सोध्नुहोस्…")}
          className="max-h-24 flex-1 resize-none rounded-xl border border-brand-green-line bg-brand-paper px-3 py-2.5 text-sm text-brand-green-ink outline-none focus:border-brand-green"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label={text("Ask", "सोध्नुहोस्")}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-green-ink text-white transition hover:bg-brand-green disabled:opacity-40"
        >
          <ArrowRightIcon className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
