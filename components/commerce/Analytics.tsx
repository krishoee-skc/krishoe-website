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
export function Analytics() {
  // Nothing fires outside production, so browsing the shop while working on it
  // cannot teach the live ad account anything. See lib/tracking-ids.ts.
  const { meta: pixelId, ga4: ga4Id, tiktok: tiktokPixelId } = activeTrackingIds();

  return (
    <>
      {pixelId ? (
        <>
          <Script id="meta-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
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
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
            strategy="afterInteractive"
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
        <Script id="tiktok-pixel" strategy="afterInteractive">
          {tiktokPixelSnippet(tiktokPixelId)}
        </Script>
      ) : null}
    </>
  );
}
