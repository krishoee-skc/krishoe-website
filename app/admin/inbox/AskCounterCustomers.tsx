"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { DateDisplayAdmin } from "@/components/DateDisplay";
import { whatsappTo, type CustomerToAsk } from "@/lib/review-ask-rules";

const ASKED_KEY = "krishoe:review-asked";

function readAsked(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(ASKED_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Counter customers to ask for a review, one tap each (owner, 2026-10-01).
 * The tap opens WhatsApp on their number with the review link filled in; the
 * row then says "Asked" on this device, so nobody gets asked twice from here.
 * It sends nothing by itself: the Owner presses send in WhatsApp.
 */
export default function AskCounterCustomers({ customers, reviewUrl }: { customers: CustomerToAsk[]; reviewUrl: string }) {
  const { text } = useLanguage();
  const [asked, setAsked] = useState<string[]>([]);
  useEffect(() => {
    const id = requestAnimationFrame(() => setAsked(readAsked()));
    return () => cancelAnimationFrame(id);
  }, []);

  if (customers.length === 0) return null;

  function markAsked(key: string) {
    const next = [...new Set([...asked, key])].slice(-200);
    setAsked(next);
    try {
      window.localStorage.setItem(ASKED_KEY, JSON.stringify(next));
    } catch {
      // A private window keeps no list; the ask itself still goes.
    }
  }

  return (
    <section className="grid gap-2 rounded-2xl border border-brand-green-line bg-brand-paper p-4" data-ask-customers>
      <h2 className="text-base font-black text-brand-green-ink">
        {text(
          `💬 Ask your counter customers (${customers.length} with a phone)`,
          `💬 पसलका ग्राहकलाई राय माग्ने (फोन भएका ${customers.length})`,
        )}
      </h2>
      <p className="text-sm text-brand-muted">
        {text(
          "Bills of the last 30 days. Ask opens WhatsApp with their number and the review link — you press send.",
          "पछिल्लो ३० दिनका बिल। “माग्ने” थिच्दा उहाँको नम्बर र राय लिंकसहित WhatsApp खुल्छ — पठाउने तपाईंले नै।",
        )}
      </p>
      <ul className="grid list-none gap-0 pl-0">
        {customers.map((customer) => {
          const key = `${customer.phone}:${customer.billNumber}`;
          const done = asked.includes(key);
          const greeting = customer.name ? text(`Hello ${customer.name}!`, `नमस्ते ${customer.name} जी!`) : text("Hello!", "नमस्ते!");
          const message = text(
            `${greeting} How were your KRISHOE shoes? Please write two lines: ${reviewUrl} 🙏`,
            `${greeting} KRISHOE को जुत्ता कस्तो लाग्यो? दुई शब्द लेखिदिनुहोस्: ${reviewUrl} 🙏`,
          );
          return (
            <li key={key} className="flex flex-wrap items-center justify-between gap-2 border-t border-brand-green-line py-2 first:border-t-0">
              <span className="min-w-0 text-sm text-brand-green-ink">
                <b>{customer.name || text("No name", "नाम छैन")}</b>
                <span className="text-brand-muted">
                  {" · "}
                  {customer.billNumber}
                  {customer.shoe ? ` · ${customer.shoe}` : ""}
                  {" · "}
                  <DateDisplayAdmin date={customer.createdAt} />
                </span>
              </span>
              {done ? (
                <span className="inline-flex min-h-11 items-center gap-2 text-sm font-black text-brand-green">
                  {text("✓ Asked", "✓ मागियो")}
                  <a
                    href={`https://wa.me/${whatsappTo(customer.phone)}?text=${encodeURIComponent(message)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-brand-muted underline"
                  >
                    {text("again", "फेरि")}
                  </a>
                </span>
              ) : (
                <a
                  href={`https://wa.me/${whatsappTo(customer.phone)}?text=${encodeURIComponent(message)}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => markAsked(key)}
                  className="inline-flex min-h-11 items-center rounded-full bg-[#1E8E4E] px-4 text-sm font-black text-white"
                >
                  {text("Ask", "माग्ने")}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
