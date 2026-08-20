"use client";

import { useState } from "react";
import { shareableProductUrl, trackShare } from "@/lib/analytics-events";
import { whatsappShareUrl, viberShareUrl } from "@/lib/commerce";
import type { ReferralSummary } from "@/lib/referrals";

/**
 * The customer's own code, and what it has earned them.
 *
 * The count matters as much as the code. "You have invited 3 people, 1 has been
 * delivered" is the difference between a feature someone tries once and one
 * they keep using — and it is honest about the wait, because the reward really
 * does depend on the friend receiving their shoes.
 */
export default function ReferralCard({
  summary,
  shopUrl,
}: {
  summary: ReferralSummary;
  shopUrl: string;
}) {
  const [copied, setCopied] = useState(false);

  const message =
    `KRISHOE बाट जुत्ता किन्नुहोस् — मेरो code ${summary.code} हाल्नुहोस्, ` +
    `तपाईंलाई ५% छुट।\n${shareableProductUrl(shopUrl, "whatsapp")}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(summary.code);
      trackShare("copy");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  const waiting = summary.invited - summary.delivered;

  return (
    <section className="mt-8 rounded-2xl border-2 border-brand-gold/40 bg-brand-cream-soft p-6">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-gold-deep">
        साथीलाई बोलाउनुहोस्
      </p>
      <h2 className="mt-2 text-2xl font-black text-brand-green-ink">दुवैलाई ५% छुट</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-brand-muted">
        साथीले तपाईंको code हालेर किन्दा उहाँलाई तुरुन्तै ५% छुट। सामान पुगेपछि
        तपाईंलाई पनि ५% को कुपन आउँछ।
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className="rounded-xl border-2 border-dashed border-brand-gold bg-white px-5 py-3 font-mono text-2xl font-black tracking-[0.15em] text-brand-green-ink">
          {summary.code}
        </span>
        <button
          type="button"
          onClick={() => void copy()}
          className="min-h-12 rounded-full border border-brand-green px-5 text-sm font-black text-brand-green"
        >
          {copied ? "कपी भयो" : "code कपी"}
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <a
          href={whatsappShareUrl(message)}
          onClick={() => trackShare("whatsapp")}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center rounded-full bg-[#25D366] px-5 text-sm font-bold text-white"
        >
          WhatsApp मा पठाउने
        </a>
        <a
          href={viberShareUrl(message)}
          onClick={() => trackShare("viber")}
          className="inline-flex h-11 items-center rounded-full bg-[#7360F2] px-5 text-sm font-bold text-white"
        >
          Viber
        </a>
      </div>

      {summary.invited > 0 ? (
        <div className="mt-6 border-t border-brand-gold/30 pt-4">
          <p className="text-sm font-bold text-brand-green-ink">
            {summary.invited} जनाले तपाईंको code प्रयोग गरे
            {waiting > 0 ? ` · ${waiting} को सामान पुग्न बाँकी` : ""}
          </p>

          {summary.rewards.length > 0 ? (
            <div className="mt-3 grid gap-2">
              <p className="text-xs font-black uppercase tracking-wider text-brand-gold-deep">
                तपाईंले पाएका कुपन
              </p>
              {summary.rewards.map((reward) => (
                <p key={reward.code} className="font-mono text-sm font-black text-brand-green">
                  {reward.code}
                </p>
              ))}
              <p className="text-xs leading-5 text-brand-muted">
                अर्को अर्डरमा यही code हाल्नुहोस् — ५% छुट।
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm leading-6 text-brand-muted">
              सामान पुगेपछि कुपन यहीँ देखिन्छ।
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
