import Script from "next/script";
import { tiktokPixelSnippet } from "@/lib/analytics-snippets";
import { activeTrackingIds } from "@/lib/tracking-ids";

// Marketing/analytics tags. Nothing renders until the matching public env var
// is set, so the site stays clean until real IDs are added:
//   NEXT_PUBLIC_META_PIXEL_ID  — Facebook/Instagram ads pixel (retargeting, conversions)
//   NEXT_PUBLIC_GA4_ID         — Google Analytics 4 measurement id (G-XXXXXXX)
//   NEXT_PUBLIC_TIKTOK_PIXEL_ID — TikTok ads pixel (retargeting, conversions)
//
// Each vendor's base snippet is reproduced as that vendor publishes it. If one
// stops reporting, replace the block with the current snippet from that
// vendor's events manager rather than editing it by hand — these are minified
// third-party code, not ours to refactor. Confirm with the vendor's own
// debugger (Meta Pixel Helper, TikTok Pixel Helper, GA4 DebugView) that hits
// arrive before trusting an ad spend to them.
//
// The vendors' libraries load with lazyOnload — after the page, when the
// phone is idle. Meta and GA keep a queue from the first moment, so nothing
// is lost; TikTok's events from before its code arrives are not kept.
export function Analytics() {
  // Nothing fires outside production, so browsing the shop while working on it
  // cannot teach the live ad account anything. See lib/tracking-ids.ts.
  const { meta: pixelId, ga4: ga4Id, tiktok: tiktokPixelId } = activeTrackingIds();

  return (
    <>
      {pixelId ? (
        <>
          {/* Meta's own queue, set up at once so a PageView or a Purchase in
              the first seconds is kept — the same function as the base code,
              without the line that fetches the library. The library itself
              (about 200 KB) waits until the page has loaded and the phone is
              idle (owner, 2026-10-08: on a cheap phone it held the screen
              frozen for seconds), then sends what is queued. */}
          <Script id="meta-pixel" strategy="afterInteractive">
            {`!function(f){if(f.fbq)return;var n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[]}(window);
fbq('init', '${pixelId}');
fbq('track', 'PageView');`}
          </Script>
          <Script src="https://connect.facebook.net/en_US/fbevents.js" strategy="lazyOnload" />
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element -- Meta Pixel requires a raw 1x1 tracking pixel, not next/image */}
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              alt=""
              src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      ) : null}

      {ga4Id ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
            strategy="lazyOnload"
          />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${ga4Id}');`}
          </Script>
        </>
      ) : null}

      {tiktokPixelId ? (
        <Script id="tiktok-pixel" strategy="lazyOnload">
          {tiktokPixelSnippet(tiktokPixelId)}
        </Script>
      ) : null}
    </>
  );
}
