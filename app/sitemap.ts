import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/product-store";
import { categories } from "@/lib/products";
import { absoluteUrl, getProductsByCategory, getSiteUrl } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();
  const products = await getProducts();
  const now = new Date();
  const coreRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/shop`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      // A shopkeeper searching "थोक चप्पल नेपाल" is looking for a factory, and
      // this is the page that answers them. Ranked with the story pages rather
      // than below them.
      url: `${baseUrl}/wholesale`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];

  return [
    ...coreRoutes,
    ...categories.map((category) => ({
      url: `${baseUrl}/shop/${category.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: getProductsByCategory(products, category).length > 0 ? 0.82 : 0.65,
      images: [absoluteUrl(category.image)],
    })),
    ...products.map((product) => ({
      url: `${baseUrl}/product/${product.id}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: product.featured ? 0.85 : 0.75,
      images: product.gallery.length > 0 ? product.gallery.map(absoluteUrl) : [absoluteUrl(product.image)],
    })),
  ];
}
