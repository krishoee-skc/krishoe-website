/** @type {import('next').NextConfig} */

// Content-Security-Policy — the allowlist of where the browser may load code,
// styles, images and beacons from. Built from an audit of what the storefront
// actually uses: fonts are self-hosted by next/font (no Google CDN), and the
// only browser-side third parties are the marketing pixels in
// components/commerce/Analytics.tsx (Meta Pixel, GA4, TikTok). Inline scripts
// and styles are needed because Next.js and those pixel snippets emit them; the
// nonce alternative would force every page to dynamic rendering and slow the
// shop, which is the wrong trade for a storefront.
//
// SHIPPED IN REPORT-ONLY FIRST: the browser does not block anything, it only
// reports what a live policy *would* block. So a customer can never hit a broken
// page from this. Once the live shop is confirmed clean (checkout, payment
// redirect, product pages, admin), switch the header key below to the enforcing
// `Content-Security-Policy`.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://connect.facebook.net https://www.googletagmanager.com https://analytics.tiktok.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://*.public.blob.vercel-storage.com https://www.facebook.com https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://analytics.tiktok.com",
  "font-src 'self' data:",
  "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://connect.facebook.net https://www.facebook.com https://analytics.tiktok.com",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  {
    // Report-Only: observe, never block. Flip the key to
    // "Content-Security-Policy" to enforce once the shop is confirmed clean.
    key: "Content-Security-Policy-Report-Only",
    value: contentSecurityPolicy,
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    // POS invoice scanning needs the device camera. `self` keeps third-party
    // frames blocked while allowing our own HTTPS admin page to request it.
    value: "camera=(self), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-origin",
  },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig = {
  poweredByHeader: false,
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
        pathname: "/**",
      },
    ],
    // Optimize images for better performance
    formats: ["image/avif", "image/webp"],
    // Cache optimized images for 31 days
    minimumCacheTTL: 60 * 60 * 24 * 31,
  },
  // Compress assets for faster delivery
  compress: true,
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
// Vercel rebuild trigger - 2026-08-07
