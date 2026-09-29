"use client";

import { useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * What an empty Customer Voice offers instead of six zeros: the ways to get
 * the first review (owner, 2026-09-29).
 *
 * The only ask the shop made was an email a week after an online order closed,
 * and counter customers — ten bills so far — leave no email. So: a ready
 * WhatsApp message with the review link, the QR now printed at the foot of
 * every counter bill, and the email that already runs.
 */
export default function ReviewAskWays({ reviewUrl }: { reviewUrl: string }) {
  const { text } = useLanguage();
  const [copied, setCopied] = useState(false);
  const message = text(
    `Hello! How were your KRISHOE shoes? Please write two lines: ${reviewUrl} 🙏`,
    `नमस्ते! KRISHOE को जुत्ता कस्तो लाग्यो? दुई शब्द लेखिदिनुहोस्: ${reviewUrl} 🙏`,
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const way = "grid grid-cols-[44px_minmax(0,1fr)] items-start gap-3 rounded-xl border border-brand-green-line bg-brand-paper p-3";
  const icon = "grid h-11 w-11 place-items-center rounded-xl text-xl";

  return (
    <div className="grid gap-3 p-4 sm:p-5">
      <div>
        <h2 className="text-lg font-black text-brand-green-ink">{text("No reviews yet — three ways to get the first", "अहिलेसम्म राय छैन — पहिलो राय पाउने ३ तरिका")}</h2>
        <p className="mt-1 text-sm text-brand-muted">
          {text("Whatever a customer says arrives here.", "ग्राहकले जे भने पनि यहीँ आउँछ।")}
        </p>
      </div>

      <div className={way}>
        <span className={`${icon} bg-brand-green-wash`} aria-hidden="true">💬</span>
        <div className="grid gap-2">
          <p className="font-black text-brand-green-ink">
            {text("Ask on WhatsApp", "WhatsApp मा राय माग्ने")}
            <span className="block text-sm font-semibold text-brand-muted">
              {text("For customers who bought at the counter — pick them in WhatsApp.", "पसलमा किनेका ग्राहकलाई — WhatsApp मा छानेर पठाउने।")}
            </span>
          </p>
          <p className="rounded-lg bg-brand-green-wash px-3 py-2 text-sm text-brand-green-ink">{message}</p>
          <div className="flex flex-wrap gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center rounded-full bg-[#1E8E4E] px-4 text-sm font-black text-white"
            >
              {text("Send on WhatsApp", "WhatsApp मा पठाउने")}
            </a>
            <button
              type="button"
              onClick={copy}
              className="inline-flex min-h-10 items-center rounded-full border border-brand-green px-4 text-sm font-black text-brand-green"
            >
              {copied ? text("Copied ✓", "Copy भयो ✓") : text("Copy message", "सन्देश copy")}
            </button>
          </div>
        </div>
      </div>

      <div className={way}>
        <span className={`${icon} bg-brand-cream-soft`} aria-hidden="true">🧾</span>
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 font-black text-brand-green-ink">
            {text("QR on every counter bill", "हरेक बिलमा QR")}
            <span className="block text-sm font-semibold text-brand-muted">
              {text(
                "Printed at the foot of the bill: the customer scans it and the review page opens.",
                "बिलको तल छापिन्छ: ग्राहकले स्क्यान गर्दा सिधै राय लेख्ने पेज खुल्छ।",
              )}
            </span>
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/api/admin/review-qr" alt={text("QR code for the review page", "राय दिने पेजको QR")} className="h-20 w-20 shrink-0 rounded-md border border-brand-green-line bg-white object-contain" />
        </div>
      </div>

      <div className={way}>
        <span className={`${icon} bg-[#2458A6]/10`} aria-hidden="true">📧</span>
        <p className="font-black text-brand-green-ink">
          {text("Email after an online order", "अनलाइन अर्डरपछि ईमेल")}
          <span className="block text-sm font-semibold text-brand-muted">
            {text("Sent by itself a week after the order closes.", "अर्डर बन्द भएको ७ दिनपछि आफैँ जान्छ।")}
          </span>
          <span className="mt-1 block text-sm font-black text-brand-green">{text("✓ Already running", "✓ पहिले नै चलिरहेको")}</span>
        </p>
      </div>
    </div>
  );
}
