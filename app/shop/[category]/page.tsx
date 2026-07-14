import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLdScript } from "@/components/commerce/StructuredData";
import ShopCatalog from "@/app/shop/ShopCatalog";
import { getProducts } from "@/lib/product-store";
import { categories } from "@/lib/products";
import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  createPageMetadata,
  getCategoryBySlug,
  getProductsByCategory,
} from "@/lib/seo";

type CategoryPageProps = {
  params: Promise<{ category: string }>;
};

export function generateStaticParams() {
  return categories.map((category) => ({ category: category.slug }));
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const category = getCategoryBySlug(slug);

  if (!category) {
    return {
      title: "Collection Not Found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return createPageMetadata({
    title: category.title,
    description: `${category.description} Shop KRISHOE ${category.title.toLowerCase()} in Nepal.`,
    path: `/shop/${category.slug}`,
    image: category.image,
  });
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category: slug } = await params;
  const category = getCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  const products = getProductsByCategory(await getProducts(), category);
  const pageUrl = `/shop/${category.slug}`;

  return (
    <>
      <JsonLdScript
        data={collectionPageJsonLd({
          name: `${category.title} | KRISHOE`,
          description: category.description,
          url: pageUrl,
          products,
        })}
      />
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Shop", path: "/shop" },
          { name: category.title, path: pageUrl },
        ])}
      />
      <ShopCatalog products={products} activeCategory={category} />
    </>
  );
}
