import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import { CommerceProvider } from "@/components/commerce/CommerceProvider";
import { StructuredData } from "@/components/commerce/StructuredData";
import { Analytics } from "@/components/commerce/Analytics";
import BottomTabBar from "@/components/BottomTabBar";
import { getProducts } from "@/lib/product-store";
import { getOrders } from "@/lib/submissions";
import { reservedByProduct, withAvailableStock } from "@/lib/order-stock";
import { reportError } from "@/lib/report-error";
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

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
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
async function loadBuyableProducts(): Promise<Product[]> {
  try {
    const [catalog, orders] = await Promise.all([getProducts(), getOrders()]);
    return withAvailableStock(catalog, reservedByProduct(orders));
  } catch (error) {
    reportError("load catalog for the storefront layout", error);
    return [];
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const products = await loadBuyableProducts();

  return (
    <html
      lang="en"
      className={`h-full antialiased ${sans.variable} ${display.variable}`}
    >
      <head>
        <StructuredData metadata={metadata} products={products} />
      </head>
      <body className="min-h-full flex flex-col">
        <Analytics />
        <CommerceProvider catalogProducts={products}>
          {children}
          <BottomTabBar />
        </CommerceProvider>
      </body>
    </html>
  );
}
