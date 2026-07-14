import type { Metadata } from "next";
import { JsonLdScript } from "@/components/commerce/StructuredData";
import ShopCatalog from "@/app/shop/ShopCatalog";
import { getProducts, searchProducts } from "@/lib/product-store";
import {
  collectionPageJsonLd,
  createPageMetadata,
  getCategoryBySlug,
  getProductsByCategory,
} from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Shop",
  description: "Shop KRISHOE premium footwear collections in Nepal.",
  path: "/shop",
});

type ShopPageProps = {
  searchParams?: Promise<{
    query?: string;
    category?: string;
  }>;
};

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const resolvedSearchParams = await searchParams;
  const query = resolvedSearchParams?.query ?? "";
  const category = resolvedSearchParams?.category ?? "";
  const sourceProducts = query ? await searchProducts(query) : await getProducts();
  const activeCategory = category ? getCategoryBySlug(category) : undefined;
  const products = activeCategory ? getProductsByCategory(sourceProducts, activeCategory) : sourceProducts;

  return (
    <>
      <JsonLdScript
        data={collectionPageJsonLd({
          name: "KRISHOE shop",
          description: "Shop KRISHOE premium footwear collections in Nepal.",
          url: "/shop",
          products,
        })}
      />
      <ShopCatalog products={products} activeCategory={activeCategory} query={query} />
    </>
  );
}
