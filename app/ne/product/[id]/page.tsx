import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import ProductPage from "@/app/product/[id]/page";
import { getProductById, getProducts } from "@/lib/product-store";
import { productPath, productSlug } from "@/lib/product-url";
import { reportError } from "@/lib/report-error";
import { createProductMetadata } from "@/lib/seo";

type Props = { params: Promise<{ id: string }> };

export async function generateStaticParams() {
  // As on the English page: a build must not need the database.
  try {
    const products = await getProducts();
    return products.map((product) => ({ id: productSlug(product) }));
  } catch (error) {
    reportError("list Nepali product pages to prerender", error);
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) return { title: "Product Not Found", robots: { index: false, follow: false } };
  return createProductMetadata(product, "ne");
}

/**
 * A shoe, in Nepali — see app/ne/layout.tsx. An old address is sent on to the
 * Nepali address in words, here rather than in the English page, which would
 * send it to the English one.
 */
export default async function NepaliProductPage({ params }: Props) {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) notFound();
  if (decodeURIComponent(id).toLowerCase() !== productSlug(product)) {
    permanentRedirect(productPath(product, "ne"));
  }
  return <ProductPage params={params} />;
}
