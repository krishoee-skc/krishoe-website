import type { Metadata } from "next";
import ShopPage from "@/app/shop/page";
import { createPageMetadata } from "@/lib/seo";
import { nepaliShop } from "@/lib/nepali-pages";

export const metadata: Metadata = createPageMetadata({
  title: nepaliShop.title,
  description: nepaliShop.description,
  path: "/ne/shop",
  language: "ne",
  pairPath: "/shop",
});

/** The shop, in Nepali — see app/ne/layout.tsx. */
export default ShopPage;
