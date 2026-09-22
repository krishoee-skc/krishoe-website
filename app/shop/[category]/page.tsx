import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLdScript } from "@/components/commerce/StructuredData";
import ShopCatalog from "@/app/shop/ShopCatalog";
import { getProducts } from "@/lib/product-store";
import { categories } from "@/lib/products";
import type { Product } from "@/lib/products";
import { reportError } from "@/lib/report-error";
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
    categorySlug: slug,
  });
}

// Every category is prerendered — `generateStaticParams` lists them from the
// built-in category list — so this read runs at build time and an unreachable
// database failed the deploy on the first category it reached. The category
// itself does not come from the database, so an empty list still renders a real
// category page with its heading, its story and its navigation; only the rows
// of shoes wait for the next rebuild.
async function loadCategoryProducts(): Promise<Product[]> {
  try {
    return await getProducts();
  } catch (error) {
    reportError("load products for a shop category page", error);
    return [];
  }
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category: slug } = await params;
  const category = getCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  const products = getProductsByCategory(await loadCategoryProducts(), category);
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
