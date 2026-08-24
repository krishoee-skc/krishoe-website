"use client";

import { useState } from "react";
import { shareableProductUrl, trackShare } from "@/lib/analytics-events";
import { whatsappShareUrl, viberShareUrl } from "@/lib/commerce";
import { useLanguage } from "@/components/LanguageProvider";
import type { ReferralSummary } from "@/lib/referrals";

/**
 * The customer's own code, and what it has earned them.
 *
 * The count matters as much as the code. "You have invited 3 people, 1 has been
 * delivered" is the difference between a feature someone tries once and one
 * they keep using — and it is honest about the wait, because the reward really
 * does depend on the friend receiving their shoes.
 *
 * The share message follows the sender's language, not the shop's default: this
 * text is pasted into somebody's WhatsApp under their own name, and a Nepali
 * line arriving from a friend who writes to you in English reads like a
 * forwarded advert rather than a recommendation.
 */
export default function ReferralCard({
  summary,
  shopUrl,
}: {
  summary: ReferralSummary;
  shopUrl: string;
}) {
  const [copied, setCopied] = useState(false);
  const { text } = useLanguage();

  const message = text(
    `Buy your shoes from KRISHOE — use my code ${summary.code} and you get 5% off.\n${shareableProductUrl(shopUrl, "whatsapp")}`,
    `KRISHOE बाट जुत्ता किन्नुहोस् — मेरो code ${summary.code} हाल्नुहोस्, तपाईंलाई ५% छुट।\n${shareableProductUrl(shopUrl, "whatsapp")}`,
  );

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
        {text("Invite a friend", "साथीलाई बोलाउनुहोस्")}
      </p>
      <h2 className="mt-2 text-2xl font-black text-brand-green-ink">
        {text("5% off for both of you", "दुवैलाई ५% छुट")}
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-brand-muted">
        {text(
          "Your friend gets 5% off the moment they use your code. Once their shoes arrive, a 5% coupon comes to you as well.",
          "साथीले तपाईंको code हालेर किन्दा उहाँलाई तुरुन्तै ५% छुट। सामान पुगेपछि तपाईंलाई पनि ५% को कुपन आउँछ।",
        )}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className="rounded-xl border-2 border-dashed border-brand-gold bg-brand-paper px-5 py-3 font-mono text-2xl font-black tracking-[0.15em] text-brand-green-ink">
          {summary.code}
        </span>
        <button
          type="button"
          onClick={() => void copy()}
          className="min-h-12 rounded-full border border-brand-green px-5 text-sm font-black text-brand-green"
        >
          {copied ? text("Copied", "कपी भयो") : text("Copy code", "code कपी")}
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
          {text("Send on WhatsApp", "WhatsApp मा पठाउने")}
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
            {text(
              `${summary.invited} used your code`,
              `${summary.invited} जनाले तपाईंको code प्रयोग गरे`,
            )}
            {waiting > 0
              ? text(` · ${waiting} still waiting for delivery`, ` · ${waiting} को सामान पुग्न बाँकी`)
              : ""}
          </p>

          {summary.rewards.length > 0 ? (
            <div className="mt-3 grid gap-2">
              <p className="text-xs font-black uppercase tracking-wider text-brand-gold-deep">
                {text("Coupons you have earned", "तपाईंले पाएका कुपन")}
              </p>
              {summary.rewards.map((reward) => (
                <p key={reward.code} className="font-mono text-sm font-black text-brand-green">
                  {reward.code}
                </p>
              ))}
              <p className="text-xs leading-5 text-brand-muted">
                {text(
                  "Use this code on your next order — 5% off.",
                  "अर्को अर्डरमा यही code हाल्नुहोस् — ५% छुट।",
                )}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm leading-6 text-brand-muted">
              {text(
                "Your coupon appears here once their shoes arrive.",
                "सामान पुगेपछि कुपन यहीँ देखिन्छ।",
              )}
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
