"use client";

import { useState, useSyncExternalStore } from "react";
import { facebookShareUrl, viberShareUrl, whatsappShareUrl } from "@/lib/commerce";
import { shareableProductUrl, trackShare, type ShareChannel } from "@/lib/analytics-events";
import { useLanguage } from "@/components/LanguageProvider";

type ShareProductProps = {
  name: string;
  price: string;
  url: string;
};

/**
 * "Send this pair to a friend" — the step before an order, not an order.
 *
 * On a phone the browser's own share sheet is far better than any list we could
 * draw: it offers every messaging app actually installed, in the shopper's own
 * order. So when navigator.share exists we show one button and hand off to it,
 * and fall back to explicit links everywhere else.
 *
 * The capability is read through useSyncExternalStore so the server renders the
 * fallback links and the client hydrates to the same thing before switching —
 * reading navigator during render would make the two disagree. Support never
 * changes for a loaded page, hence the no-op subscribe.
 */
const neverChanges = () => () => {};
const hasNativeShare = () =>
  typeof navigator !== "undefined" && typeof navigator.share === "function";
const noNativeShareOnServer = () => false;

export default function ShareProduct({ name, price, url }: ShareProductProps) {
  const { text } = useLanguage();
  const canUseNativeShare = useSyncExternalStore(
    neverChanges,
    hasNativeShare,
    noNativeShareOnServer,
  );
  const [copied, setCopied] = useState(false);

  // One message per channel, each carrying its own tagged link, so Analytics
  // can tell a visit that arrived from a WhatsApp share from one that arrived
  // from Facebook. Without it a shared link looked like any other visit, and
  // sharing could never be shown to have worked.
  const messageFor = (channel: ShareChannel) => {
    const link = shareableProductUrl(url, channel);
    return text(
      `${name} — ${price}\nKRISHOE premium footwear\n${link}`,
      `${name} — ${price}\nKRISHOE — नेपालकै प्रिमियम जुत्ता\n${link}`,
    );
  };

  async function shareNatively() {
    try {
      await navigator.share({
        title: name,
        text: messageFor("native"),
        url: shareableProductUrl(url, "native"),
      });
      trackShare("native");
    } catch {
      // A cancelled share sheet rejects exactly like a failure does, and the
      // shopper already knows they backed out, so there is nothing to report.
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
    <div className="mt-4 border-t border-black/10 pt-4">
      <p className="text-sm font-bold text-brand-green-ink">
        {text("Share with a friend", "साथीलाई पठाउनुहोस्")}
      </p>

      {canUseNativeShare ? (
        <button
          type="button"
          onClick={shareNatively}
          className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-brand-green px-6 text-sm font-bold text-brand-green transition hover:bg-brand-green hover:text-white"
        >
          {text("Share this pair", "यो जोडी पठाउनुहोस्")}
        </button>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <a
            href={whatsappShareUrl(messageFor("whatsapp"))}
            onClick={() => trackShare("whatsapp")}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center justify-center rounded-full bg-[#0E7A42] px-3 text-sm font-bold text-white transition hover:brightness-95"
          >
            WhatsApp
          </a>
          <a
            href={viberShareUrl(messageFor("viber"))}
            onClick={() => trackShare("viber")}
            className="inline-flex h-11 items-center justify-center rounded-full bg-[#5A43D6] px-3 text-sm font-bold text-white transition hover:brightness-95"
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
            className="inline-flex h-11 items-center justify-center rounded-full border border-black/15 px-3 text-sm font-bold text-brand-green-ink transition hover:border-brand-green"
          >
            {copied ? text("Copied", "कपी भयो") : text("Copy link", "लिंक कपी")}
          </button>
        </div>
      )}
    </div>
  );
}
