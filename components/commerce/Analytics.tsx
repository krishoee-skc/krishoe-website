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
// Meta's and GA's libraries load on the first touch, key or scroll, or after
// eight seconds; their queues start at once, so nothing is lost. TikTok's
// loads with lazyOnload, and its events from before its code arrives are not
// kept.
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
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${ga4Id}');`}
          </Script>
        </>
      ) : null}

      {/* The two libraries themselves (Meta about 200 KB, Google about 150 KB)
          wait for the customer's first touch, key or scroll — or eight seconds,
          whichever comes first (UI/UX audit 1, 2026-10-29): loaded while the
          phone was still drawing the shop, they held the main thread for over
          half a second and the first photo waited behind them. The queues
          above keep every event from the first moment, so nothing is lost. */}
      {pixelId || ga4Id ? (
        <Script id="ad-libraries" strategy="afterInteractive">
          {adLibraryLoader(
            [
              pixelId ? "https://connect.facebook.net/en_US/fbevents.js" : "",
              ga4Id ? `https://www.googletagmanager.com/gtag/js?id=${ga4Id}` : "",
            ].filter(Boolean),
          )}
        </Script>
      ) : null}

      {tiktokPixelId ? (
        <Script id="tiktok-pixel" strategy="lazyOnload">
          {tiktokPixelSnippet(tiktokPixelId)}
        </Script>
      ) : null}
    </>
  );
}

/** Adds each library's script tag once, on the first sign of a person, or after 8 s. */
export function adLibraryLoader(sources: string[]) {
  return `(function(){var done=false,events=["pointerdown","keydown","touchstart","scroll"];
function go(){if(done)return;done=true;events.forEach(function(e){removeEventListener(e,go)});
${JSON.stringify(sources)}.forEach(function(src){var t=document.createElement("script");t.async=true;t.src=src;document.head.appendChild(t)})}
events.forEach(function(e){addEventListener(e,go,{passive:true})});setTimeout(go,8000)})();`;
}
