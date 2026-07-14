import type { Metadata } from "next";
import { categories, type Category, type Product } from "@/lib/products";

export const siteConfig = {
  name: "KRISHOE",
  legalName: "SHREE KRISHNA CHHAPAL",
  defaultTitle: "KRISHOE | Premium Footwear in Nepal",
  description:
    "Shop premium KRISHOE footwear for sandals, slippers, casual shoes, heels, kids styles, and new arrivals in Nepal.",
  shortDescription: "Premium sandals, slippers, shoes, heels, and kids footwear in Nepal.",
  logoPath: "/images/logo.png",
  defaultImagePath: "/images/hero-banner.png",
  currency: "NPR",
  email: process.env.NEXT_PUBLIC_BUSINESS_EMAIL ?? "skschhapal@gmail.com",
  countryCode: "NP",
};

// Central business contact. Public NEXT_PUBLIC_* env vars override the
// defaults (which come from the shop's admin settings) so the real number,
// address, and socials can be changed per-deployment without code edits.
export const businessContact = {
  phoneDisplay: process.env.NEXT_PUBLIC_BUSINESS_PHONE ?? "+977 9855019351",
  phoneTel: process.env.NEXT_PUBLIC_BUSINESS_PHONE_TEL ?? "+9779855019351",
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "9779855019351",
  viberNumber: process.env.NEXT_PUBLIC_VIBER_NUMBER ?? "+9779855019351",
  email: process.env.NEXT_PUBLIC_BUSINESS_EMAIL ?? "skschhapal@gmail.com",
  streetAddress: process.env.NEXT_PUBLIC_BUSINESS_STREET ?? "Pulchowk, Narayangadh",
  addressLocality: process.env.NEXT_PUBLIC_BUSINESS_CITY ?? "Bharatpur",
  addressRegion: process.env.NEXT_PUBLIC_BUSINESS_REGION ?? "Chitwan",
  postalCode: process.env.NEXT_PUBLIC_BUSINESS_POSTAL ?? "44200",
  openingHours: "Mo-Sa 10:00-19:00",
  facebook: process.env.NEXT_PUBLIC_FACEBOOK_URL ?? "",
  instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? "",
  tiktok: process.env.NEXT_PUBLIC_TIKTOK_URL ?? "",
};

export function businessSocialLinks() {
  return [businessContact.facebook, businessContact.instagram, businessContact.tiktok].filter(
    (value): value is string => Boolean(value),
  );
}

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
  const sameAs = businessSocialLinks();

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    legalName: siteConfig.legalName,
    url: getSiteUrl(),
    logo: absoluteUrl(siteConfig.logoPath),
    email: siteConfig.email,
    telephone: businessContact.phoneTel,
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function localBusinessJsonLd() {
  const sameAs = businessSocialLinks();

  return {
    "@context": "https://schema.org",
    "@type": "ShoeStore",
    name: siteConfig.name,
    url: getSiteUrl(),
    image: absoluteUrl(siteConfig.defaultImagePath),
    logo: absoluteUrl(siteConfig.logoPath),
    email: siteConfig.email,
    telephone: businessContact.phoneTel,
    priceRange: "Rs.",
    currenciesAccepted: siteConfig.currency,
    areaServed: siteConfig.countryCode,
    openingHours: businessContact.openingHours,
    address: {
      "@type": "PostalAddress",
      streetAddress: businessContact.streetAddress,
      addressLocality: businessContact.addressLocality,
      addressRegion: businessContact.addressRegion,
      postalCode: businessContact.postalCode,
      addressCountry: siteConfig.countryCode,
    },
    ...(sameAs.length ? { sameAs } : {}),
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
