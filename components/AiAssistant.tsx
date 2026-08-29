"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";

type Turn = { role: "user" | "assistant"; text: string };

// Where the assistant has no business appearing: the admin desk, the worker
// portal, and a customer's own account pages are not shopfront.
const HIDDEN_PREFIXES = ["/admin", "/worker", "/account", "/customer"];

export default function AiAssistant() {
  const pathname = usePathname();
  const { text, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const greeting = text(
    "Namaste! 🙏 Ask me anything — sizes, delivery, prices or which pair suits you.",
    "नमस्ते! 🙏 जे पनि सोध्नुहोस् — size, delivery, price वा कुन जोडी सुहाउँछ।",
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy, open]);

  if (HIDDEN_PREFIXES.some((prefix) => pathname?.startsWith(prefix))) {
    return null;
  }

  async function send() {
    const message = input.trim();
    if (!message || busy) return;

    const nextTurns: Turn[] = [...turns, { role: "user", text: message }];
    setTurns(nextTurns);
    setInput("");
    setBusy(true);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: turns.slice(-6) }),
      });
      const data = (await response.json()) as { reply?: string };
      setTurns([
        ...nextTurns,
        {
          role: "assistant",
          text:
            data.reply ??
            text(
              "Sorry, something went wrong. Please message us on WhatsApp.",
              "माफ गर्नुहोस्, केही बिग्रियो। WhatsApp मा सन्देश गर्नुहोस्।",
            ),
        },
      ]);
    } catch {
      setTurns([
        ...nextTurns,
        {
          role: "assistant",
          text: text(
            "I couldn't connect just now. Please try again, or message us on WhatsApp.",
            "अहिले जोडिन सकिनँ। फेरि प्रयास गर्नुहोस्, वा WhatsApp मा सन्देश गर्नुहोस्।",
          ),
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Floating open button */}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={text("Open KRISHOE assistant", "KRISHOE सहायक खोल्नुहोस्")}
          className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-green-ink text-white shadow-xl ring-2 ring-brand-gold/60 transition hover:scale-105"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 10h8M8 14h5M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12Z"
            />
          </svg>
        </button>
      ) : null}

      {/* Chat panel */}
      {open ? (
        <div className="fixed bottom-5 right-5 z-40 flex h-[70vh] max-h-[560px] w-[92vw] max-w-sm flex-col overflow-hidden rounded-2xl border border-black/10 bg-brand-paper shadow-2xl">
          <div className="flex items-center justify-between bg-brand-green-ink px-4 py-3 text-white">
            <div>
              <p className="text-sm font-black">KRISHOE</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-gold-bright">
                {text("AI assistant", "AI सहायक")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={text("Close", "बन्द गर्नुहोस्")}
              className="rounded-full p-1 text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            <Bubble role="assistant" text={greeting} />
            {turns.map((turn, index) => (
              <Bubble key={index} role={turn.role} text={turn.text} />
            ))}
            {busy ? (
              <Bubble role="assistant" text={text("Typing…", "लेख्दै…")} muted />
            ) : null}
          </div>

          <div className="border-t border-black/10 bg-brand-mist p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder={text("Type your question…", "आफ्नो प्रश्न लेख्नुहोस्…")}
                className="max-h-24 flex-1 resize-none rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-brand-green-ink outline-none focus:border-brand-gold"
              />
              <button
                type="button"
                onClick={send}
                disabled={busy || !input.trim()}
                className="rounded-xl bg-brand-green-ink px-4 py-2 text-sm font-black text-white transition hover:bg-brand-green disabled:opacity-40"
              >
                {text("Send", "पठाउनुहोस्")}
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-brand-muted">
              {text(
                "AI assistant — for orders, message us on WhatsApp.",
                "AI सहायक — order का लागि WhatsApp मा सन्देश गर्नुहोस्।",
              )}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Bubble({ role, text: body, muted }: { role: "user" | "assistant"; text: string; muted?: boolean }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-6 ${
          isUser
            ? "bg-brand-green-ink text-white"
            : `bg-white text-brand-green-ink ring-1 ring-black/5 ${muted ? "opacity-60" : ""}`
        }`}
      >
        {body}
      </div>
    </div>
  );
}
