import type { Metadata } from "next";
import CategoryPage from "@/app/shop/[category]/page";
import { categories } from "@/lib/products";
import { createPageMetadata, getCategoryBySlug } from "@/lib/seo";
import { nepaliCategory } from "@/lib/nepali-pages";

type Props = { params: Promise<{ category: string }> };

export function generateStaticParams() {
  return categories.map((category) => ({ category: category.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category: slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) return { title: "Collection Not Found", robots: { index: false, follow: false } };
  const words = nepaliCategory(category.slug, category.title);
  return createPageMetadata({
    title: words.title,
    description: words.description,
    path: `/ne/shop/${category.slug}`,
    image: category.image,
    categorySlug: slug,
    language: "ne",
    pairPath: `/shop/${category.slug}`,
  });
}

/** A shelf, in Nepali — see app/ne/layout.tsx. */
export default CategoryPage;
