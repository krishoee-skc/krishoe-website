import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/cart/", "/checkout/", "/wishlist/"],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
