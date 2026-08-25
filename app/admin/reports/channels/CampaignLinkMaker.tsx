"use client";

import { useState } from "react";
import {
  campaignPlaces,
  campaignSources,
  campaignUrl,
} from "@/lib/campaign-links";

/**
 * The link the owner pastes into a post, built in two taps.
 *
 * The alternative is typing "?utm_source=facebook" by hand onto the end of a
 * URL, which works exactly once and then somebody writes "Facebook" with a
 * capital F and Google files it as a second, different source. Two taps and a
 * copy button is the difference between a habit and a good intention.
 *
 * The QR is for the printed flyer, which the owner asked for: a shopper in the
 * bazaar points a camera at a poster and arrives already labelled, so the shop
 * finally learns whether printing was worth it.
 */
export default function CampaignLinkMaker() {
  const [place, setPlace] = useState(campaignPlaces[0]);
  const [source, setSource] = useState(campaignSources[0]);
  const [copied, setCopied] = useState(false);

  const url = campaignUrl(place.path, source.id);
  const isFlyer = source.id === "flyer";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // A blocked clipboard is not an error worth a red box — the link is on
      // screen and can be selected by hand.
      setCopied(false);
    }
  }

  return (
    <section className="rounded-2xl border border-brand-green-line bg-brand-paper p-5 sm:p-6">
      <h2 className="font-display text-xl font-black text-brand-green-ink">पोस्टको लिङ्क बनाउने</h2>
      <p className="mt-1.5 text-sm leading-6 text-brand-muted">
        कुन पाना, कहाँ पोस्ट गर्ने — दुई थिचाइ, अनि लिङ्क तयार।
      </p>

      <p className="mt-5 text-xs font-black uppercase tracking-[0.14em] text-brand-muted">
        कहाँ लैजाने
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {campaignPlaces.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setPlace(option)}
            aria-pressed={place.id === option.id}
            className={`min-h-11 rounded-full px-4 text-sm font-bold transition ${
              place.id === option.id
                ? "bg-brand-green-ink text-white"
                : "border border-brand-green-line text-brand-muted-deep hover:border-brand-gold"
            }`}
          >
            {option.ne}
          </button>
        ))}
      </div>

      <p className="mt-5 text-xs font-black uppercase tracking-[0.14em] text-brand-muted">
        कहाँ पोस्ट गर्ने
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {campaignSources.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setSource(option)}
            aria-pressed={source.id === option.id}
            className={`min-h-11 rounded-full px-4 text-sm font-bold transition ${
              source.id === option.id
                ? "bg-brand-gold text-brand-green-ink"
                : "border border-brand-green-line text-brand-muted-deep hover:border-brand-gold"
            }`}
          >
            {option.ne}
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-dashed border-brand-gold bg-brand-mist p-4">
        <p className="break-all font-mono text-[13px] leading-6 text-brand-green-ink">{url}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void copy()}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-green px-5 text-sm font-black text-white transition hover:bg-brand-green-ink"
          >
            {copied ? "कपी भयो ✓" : "लिङ्क कपी गर्ने"}
          </button>
          {isFlyer ? (
            <a
              href={`/api/admin/campaign-qr?path=${encodeURIComponent(place.path)}&source=${source.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-green px-5 text-sm font-black text-brand-green transition hover:bg-brand-green hover:text-white"
            >
              QR खोल्ने · छाप्ने
            </a>
          ) : null}
        </div>
      </div>

      <p className="mt-4 text-[13px] leading-6 text-brand-muted">
        यही लिङ्क पोस्टमा राख्नुहोस्। एक हप्तापछि माथिको तालिकामा{" "}
        <strong className="text-brand-green-ink">{source.showsAsNe}</strong> देखिन्छ।
      </p>
    </section>
  );
}
