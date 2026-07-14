import type { Metadata } from "next";
import { categories, type Category, type Product } from "@/lib/products";

export const siteConfig = {
  name: "KRISHOE",
  legalName: "KRISHOE Footwear",
  defaultTitle: "KRISHOE | Premium Footwear in Nepal",
  description:
    "Shop premium KRISHOE footwear for sandals, slippers, casual shoes, heels, kids styles, and new arrivals in Nepal.",
  shortDescription: "Premium sandals, slippers, shoes, heels, and kids footwear in Nepal.",
  logoPath: "/images/logo.png",
  defaultImagePath: "/images/hero-banner.png",
  currency: "NPR",
  email: "hello@krishoe.com",
  countryCode: "NP",
};

export function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://krishoe.com").replace(/\/$/, "");
}

export function absoluteUrl(pathOrUrl: string) {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }

  return `${getSiteUrl()}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

export function getCategoryBySlug(slug: string) {
  return categories.find((category) => category.slug === slug);
}

export function getProductsByCategory(products: Product[], category: Category) {
  return products.filter(
    (product) => product.categorySlug === category.slug || product.category === category.title,
  );
}

export function createPageMetadata({
  title,
  description,
  path,
  image = siteConfig.defaultImagePath,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
}): Metadata {
  const pageTitle = title.includes(siteConfig.name) ? title : `${title} | ${siteConfig.name}`;
  const canonical = absoluteUrl(path);
  const imageUrl = absoluteUrl(image);

  return {
    title: pageTitle,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title: pageTitle,
      description,
      url: canonical,
      siteName: siteConfig.name,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: pageTitle,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description,
      images: [imageUrl],
    },
  };
}

export function createProductMetadata(product: Product): Metadata {
  const title = `${product.name} | KRISHOE`;
  const canonical = absoluteUrl(`/product/${product.id}`);
  const imageUrl = absoluteUrl(product.image);

  return {
    title,
    description: product.description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description: product.description,
      url: canonical,
      siteName: siteConfig.name,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 1200,
          alt: product.name,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: product.description,
      images: [imageUrl],
    },
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    legalName: siteConfig.legalName,
    url: getSiteUrl(),
    logo: absoluteUrl(siteConfig.logoPath),
    email: siteConfig.email,
  };
}

export function localBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ShoeStore",
    name: siteConfig.name,
    url: getSiteUrl(),
    image: absoluteUrl(siteConfig.defaultImagePath),
    logo: absoluteUrl(siteConfig.logoPath),
    email: siteConfig.email,
    priceRange: "Rs.",
    currenciesAccepted: siteConfig.currency,
    areaServed: siteConfig.countryCode,
    address: {
      "@type": "PostalAddress",
      addressCountry: siteConfig.countryCode,
    },
  };
}

export function websiteJsonLd(description = siteConfig.description) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: getSiteUrl(),
    description,
    potentialAction: {
      "@type": "SearchAction",
      target: `${getSiteUrl()}/shop?query={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function itemListJsonLd({
  name,
  url,
  products,
}: {
  name: string;
  url: string;
  products: Product[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    url: absoluteUrl(url),
    itemListElement: products.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(`/product/${product.id}`),
      item: productJsonLd(product),
    })),
  };
}

export function collectionPageJsonLd({
  name,
  description,
  url,
  products,
}: {
  name: string;
  description: string;
  url: string;
  products: Product[];
}) {
  const absolutePageUrl = absoluteUrl(url);

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description,
    url: absolutePageUrl,
    mainEntity: itemListJsonLd({ name: `${name} products`, url: absolutePageUrl, products }),
  };
}

export function productJsonLd(product: Product) {
  const approvedReviews = product.reviews.filter((review) => review.status === "approved");
  const ratingValue = Number(product.rating);
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    image: product.gallery.length > 0 ? product.gallery.map(absoluteUrl) : [absoluteUrl(product.image)],
    description: product.description,
    category: product.category,
    brand: {
      "@type": "Brand",
      name: siteConfig.name,
    },
    material: product.material,
    offers: {
      "@type": "Offer",
      priceCurrency: siteConfig.currency,
      price: (product.priceValue / 100).toFixed(2),
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      url: absoluteUrl(`/product/${product.id}`),
    },
  };

  if (Number.isFinite(ratingValue) && approvedReviews.length > 0) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: ratingValue.toFixed(1),
      reviewCount: approvedReviews.length,
    };
  }

  if (approvedReviews.length > 0) {
    data.review = approvedReviews.slice(0, 10).map((review) => ({
      "@type": "Review",
      author: {
        "@type": "Person",
        name: review.name,
      },
      datePublished: review.createdAt,
      reviewBody: review.comment,
      reviewRating: {
        "@type": "Rating",
        ratingValue: review.rating,
        bestRating: 5,
      },
    }));
  }

  return data;
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
