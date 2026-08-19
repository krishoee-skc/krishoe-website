"use client";

import { useState, useSyncExternalStore } from "react";
import { facebookShareUrl, viberShareUrl, whatsappShareUrl } from "@/lib/commerce";
import { shareableProductUrl, trackShare, type ShareChannel } from "@/lib/analytics-events";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * "Tell a friend about the shop" — offered at the moment someone just bought.
 *
 * A customer who has ordered is the only person on the site who has already
 * decided KRISHOE is worth trusting, and in Nepal that recommendation travels
 * further than any advertisement the shop could pay for. Nothing asked them
 * before, so the moment passed in silence.
 *
 * Deliberately about the shop rather than a pair. What a friend needs is the
 * shop, and what the buyer has just formed an opinion about is the shop.
 */
const neverChanges = () => () => {};
const hasNativeShare = () =>
  typeof navigator !== "undefined" && typeof navigator.share === "function";
const noNativeShareOnServer = () => false;

export default function ShareShop({ url }: { url: string }) {
  const { text } = useLanguage();
  const canUseNativeShare = useSyncExternalStore(
    neverChanges,
    hasNativeShare,
    noNativeShareOnServer,
  );
  const [copied, setCopied] = useState(false);

  const messageFor = (channel: ShareChannel) => {
    const link = shareableProductUrl(url, channel);
    return text(
      `I ordered from KRISHOE — footwear made in Nepal, delivered anywhere.\n${link}`,
      `मैले KRISHOE बाट अर्डर गरेँ — नेपालमै बनेको जुत्ता, नेपालभरि डेलिभरी।\n${link}`,
    );
  };

  async function shareNatively() {
    try {
      await navigator.share({
        title: "KRISHOE",
        text: messageFor("native"),
        url: shareableProductUrl(url, "native"),
      });
      trackShare("native");
    } catch {
      // A cancelled share sheet rejects the same way a failure does, and the
      // person already knows they backed out.
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareableProductUrl(url, "copy"));
      trackShare("copy");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border-2 border-brand-green/25 bg-brand-green-wash p-6">
      <p className="text-lg font-black text-brand-green-ink">
        {text("Know someone who needs a good pair?", "कसैलाई राम्रो जुत्ता चाहिएको छ?")}
      </p>
      <p className="mt-2 text-sm leading-6 text-brand-muted">
        {text(
          "Send them the shop. Made in Nepal, delivered anywhere, pay on arrival.",
          "पसल पठाइदिनुहोस् — नेपालमै बनेको, नेपालभरि डेलिभरी, सामान पाएपछि पैसा।",
        )}
      </p>

      {canUseNativeShare ? (
        <button
          type="button"
          onClick={shareNatively}
          className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-full bg-brand-green px-6 text-sm font-black text-white sm:w-auto"
        >
          {text("Share KRISHOE", "साथीलाई पठाउने")}
        </button>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <a
            href={whatsappShareUrl(messageFor("whatsapp"))}
            onClick={() => trackShare("whatsapp")}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center justify-center rounded-full bg-[#25D366] px-3 text-sm font-bold text-white transition hover:brightness-95"
          >
            WhatsApp
          </a>
          <a
            href={viberShareUrl(messageFor("viber"))}
            onClick={() => trackShare("viber")}
            className="inline-flex h-11 items-center justify-center rounded-full bg-[#7360F2] px-3 text-sm font-bold text-white transition hover:brightness-95"
          >
            Viber
          </a>
          <a
            href={facebookShareUrl(shareableProductUrl(url, "facebook"))}
            onClick={() => trackShare("facebook")}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center justify-center rounded-full bg-[#1877F2] px-3 text-sm font-bold text-white transition hover:brightness-95"
          >
            Facebook
          </a>
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex h-11 items-center justify-center rounded-full border border-brand-green/30 bg-white px-3 text-sm font-bold text-brand-green-ink transition hover:border-brand-green"
          >
            {copied ? text("Copied", "कपी भयो") : text("Copy link", "लिंक कपी")}
          </button>
        </div>
      )}
    </section>
  );
}
