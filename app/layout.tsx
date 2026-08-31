import type { Metadata, Viewport } from "next";
import { unstable_cache } from "next/cache";
import { Inter, Fraunces, Mukta, Tiro_Devanagari_Hindi } from "next/font/google";
import { CommerceProvider } from "@/components/commerce/CommerceProvider";
import { StructuredData } from "@/components/commerce/StructuredData";
import { Analytics } from "@/components/commerce/Analytics";
import SkipToContent from "@/components/SkipToContent";
import BottomTabBar from "@/components/BottomTabBar";
import AiAssistant from "@/components/AiAssistant";
import { themeBootScript } from "@/components/ThemeToggle";
import VersionWatcher from "@/components/VersionWatcher";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import PwaInstallHelp from "@/components/PwaInstallHelp";
import SpeedReporter from "@/components/SpeedReporter";
import LanguageProvider from "@/components/LanguageProvider";
import LanguageInvite from "@/components/LanguageInvite";
import { getProducts } from "@/lib/product-store";
import { getOrders } from "@/lib/submissions";
import { reservedByProduct, withAvailableStock } from "@/lib/order-stock";
import { reportError } from "@/lib/report-error";
import { pwaMetadata, pwaViewport } from "@/lib/pwa";
import { getSiteUrl, siteConfig } from "@/lib/seo";
import type { Product } from "@/lib/products";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

/**
 * The half of the shop that had no typeface at all.
 *
 * Inter and Fraunces are loaded `subsets: ["latin"]` — they carry no
 * Devanagari, and a font cannot render a letter it does not contain. So every
 * Nepali word on this site fell through to whatever the reader's device
 * happened to have: Nirmala UI on a Windows machine, Noto on one Android, a
 * different Noto on another, Devanagari Sangam on an iPhone. The English was
 * designed and the Nepali was borrowed, on the same line, and the shop that
 * sells to Nepal was the half that looked unfinished.
 *
 * These two carry Devanagari and are chosen to sit with the Latin already
 * here rather than to be noticed: Tiro Devanagari Hindi is a serif with the
 * weight and the calm of Fraunces, and Mukta is a humanist sans that holds
 * its counters at small sizes on the cheap phones most of this shop's
 * customers read on.
 *
 * They are listed AFTER the Latin faces in the CSS stacks (globals.css), so a
 * browser takes each letter from the first font that has it: Latin from Inter
 * or Fraunces, Devanagari from these. One rule, both scripts, no switching in
 * the markup.
 */
/*
 * Devanagari only, and only the weights the shop actually sets.
 *
 * Loading these with the Latin subset too cost 39KB of glyphs that can never
 * be drawn: Inter and Fraunces come first in every stack, so a Latin letter
 * never reaches these fonts. Adding them naively took the shop from 83KB of
 * type to 397KB, all of it preloaded ahead of the page — a bad trade to make
 * on a Nepali mobile connection in the name of looking better on one.
 *
 * Mukta drops to two weights; 600 is synthesised from 400 where a semibold is
 * asked for, which is invisible next to what a whole missing script cost.
 * Tiro is not preloaded because it only draws headings: a heading that swaps
 * face a moment after the page paints is a smaller price than making every
 * shopper wait 66KB for it.
 */
const devanagariSans = Mukta({
  subsets: ["devanagari"],
  weight: ["400", "700"],
  variable: "--font-dev-sans",
  display: "swap",
});

const devanagariDisplay = Tiro_Devanagari_Hindi({
  subsets: ["devanagari"],
  weight: ["400"],
  variable: "--font-dev-display",
  display: "swap",
  preload: false,
});

export const viewport: Viewport = pwaViewport;

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  ...pwaMetadata,
  title: siteConfig.defaultTitle,
  description: siteConfig.description,
  applicationName: "KRISHOE",
  keywords: [
    "KRISHOE",
    "footwear Nepal",
    "slippers Nepal",
    "sandals Nepal",
    "ladies shoes Nepal",
    "kids footwear Nepal",
    "wholesale footwear Nepal",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: siteConfig.defaultTitle,
    description: siteConfig.shortDescription,
    url: "/",
    siteName: "KRISHOE",
    images: [
      {
        url: siteConfig.defaultImagePath,
        width: 1200,
        height: 630,
        alt: "KRISHOE premium footwear collection",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.defaultTitle,
    description: "Shop premium KRISHOE footwear for comfort, polish, and everyday confidence.",
    images: [siteConfig.defaultImagePath],
  },
};

// The shop is shown what is actually buyable, not raw catalog stock: pairs an
// open order is holding are not for sale, and checkout will refuse them.
//
// This wraps every page, so a database hiccup here would take the whole
// storefront down to its retry page. The queries already retry a dropped
// connection; if one still fails, render the shell with an empty catalog rather
// than crash — the header, nav and cart stay, and the next navigation recovers.
const loadBuyableProducts = unstable_cache(async (): Promise<Product[]> => {
  try {
    const [catalog, orders] = await Promise.all([getProducts(), getOrders()]);
    return withAvailableStock(catalog, reservedByProduct(orders));
  } catch (error) {
    reportError("load catalog for the storefront layout", error);
    return [];
  }
// This runs on every storefront page, so its revalidate window is also the
// window on which those pages regenerate. At 10s the whole shop rebuilt every
// ten seconds under traffic, and a request landing on a cold regeneration is
// exactly what produced the 30-second spikes on the home page.
//
// Every real change now pushes on its own: an admin edit, a POS sale, a stock
// or photo change, and a customer's order all call revalidatePath("/", "layout").
// So freshness no longer depends on this window; it is only a safety net. Raised
// 10s → 120s → 600s: the longer it is, the rarer a cold blocking regeneration,
// and nothing real waits for it because every real change is pushed on demand.
}, ["storefront-buyable-products"], { revalidate: 600 });

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const products = await loadBuyableProducts();

  return (
    <html
      lang="en"
      className={`h-full antialiased ${sans.variable} ${display.variable} ${devanagariSans.variable} ${devanagariDisplay.variable}`}
    >
      <head>
        {/* Before the first paint, so the page never renders light and then
            flips. See components/ThemeToggle.tsx. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <StructuredData metadata={metadata} products={products} />
      </head>
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegistration />
        <Analytics />
        <LanguageProvider>
          <SkipToContent />
          <CommerceProvider catalogProducts={products}>
            {children}
            <PwaInstallHelp />
            <SpeedReporter />
            <LanguageInvite />
            <BottomTabBar />
            <AiAssistant />
          </CommerceProvider>
          {/* Passed the deployment that served this page, so a tab left open
              across a deploy can offer a reload instead of silently running old
              code. Covers the shop and the admin alike — both hang off this
              layout, which is also why it can sit inside the language context
              and say one thing rather than two. */}
          <VersionWatcher version={process.env.VERCEL_GIT_COMMIT_SHA ?? ""} />
        </LanguageProvider>
      </body>
    </html>
  );
}
