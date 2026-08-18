import type { Metadata } from "next";
import { JsonLdScript } from "@/components/commerce/StructuredData";
import ShopCatalog from "@/app/shop/ShopCatalog";
import { getProducts } from "@/lib/product-store";
import { collectionPageJsonLd, createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Shop",
  description: "Shop KRISHOE premium footwear collections in Nepal.",
  path: "/shop",
});

/**
 * The whole catalogue, prerendered.
 *
 * This page used to read `searchParams` so it could seed the search box from
 * `/shop?query=…`. Reading them opts the route into dynamic rendering, and it
 * was doing so for every visitor: the shop's own category pages were served as
 * prerendered HTML in well under a second while this one — the page the "पसल"
 * link goes to, where customers actually choose a pair — took over two.
 *
 * The search term is now read in the browser instead, by the controls that own
 * the search box anyway. Nothing about `/shop?query=…` changes for the visitor;
 * the page simply arrives already built.
 */
export default async function ShopPage() {
  const products = await getProducts();

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
      <ShopCatalog products={products} />
    </>
  );
}
