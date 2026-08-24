import type { Metadata, Viewport } from "next";
import { unstable_cache } from "next/cache";
import { Inter, Fraunces, Mukta, Tiro_Devanagari_Hindi } from "next/font/google";
import { CommerceProvider } from "@/components/commerce/CommerceProvider";
import { StructuredData } from "@/components/commerce/StructuredData";
import { Analytics } from "@/components/commerce/Analytics";
import BottomTabBar from "@/components/BottomTabBar";
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
const devanagariSans = Mukta({
  subsets: ["devanagari", "latin"],
  weight: ["400", "600", "700"],
  variable: "--font-dev-sans",
  display: "swap",
});

const devanagariDisplay = Tiro_Devanagari_Hindi({
  subsets: ["devanagari", "latin"],
  weight: ["400"],
  variable: "--font-dev-display",
  display: "swap",
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
}, ["storefront-buyable-products"], { revalidate: 10 });

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
          <CommerceProvider catalogProducts={products}>
            {children}
            <PwaInstallHelp />
            <SpeedReporter />
            <LanguageInvite />
            <BottomTabBar />
          </CommerceProvider>
        </LanguageProvider>
        {/* Passed the deployment that served this page, so a tab left open
            across a deploy can offer a reload instead of silently running old
            code. Covers the shop and the admin alike. */}
        <VersionWatcher version={process.env.VERCEL_GIT_COMMIT_SHA ?? ""} />
      </body>
    </html>
  );
}
