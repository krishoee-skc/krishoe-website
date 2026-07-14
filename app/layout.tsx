import type { Metadata } from "next";
import { CommerceProvider } from "@/components/commerce/CommerceProvider";
import { StructuredData } from "@/components/commerce/StructuredData";
import { getProducts } from "@/lib/product-store";
import { getSiteUrl, siteConfig } from "@/lib/seo";
import "./globals.css";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const products = await getProducts();

  return (
    <html lang="ne" className="h-full antialiased">
      <head>
        <StructuredData metadata={metadata} products={products} />
      </head>
      <body className="min-h-full flex flex-col">
        <CommerceProvider catalogProducts={products}>{children}</CommerceProvider>
      </body>
    </html>
  );
}
