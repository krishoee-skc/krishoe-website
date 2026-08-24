import type { Metadata } from "next";
import {
  CATEGORY_WORDS,
  FOOTWEAR_WORDS,
  PLACE_WORDS,
  productSearchWords,
} from "@/lib/search-words";
import { categories, formatPrice, type Category, type Product } from "@/lib/products";

export const siteConfig = {
  name: "KRISHOE",
  legalName: "SHREE KRISHNA CHHAPAL",
  defaultTitle: "KRISHOE | Premium Footwear in Nepal",
  description:
    "Shop premium KRISHOE footwear for sandals, slippers, casual shoes, heels, kids styles, and new arrivals in Nepal.",
  shortDescription: "Premium sandals, slippers, shoes, heels, and kids footwear in Nepal.",
  logoPath: "/images/logo.png",
  defaultImagePath: "/images/hero-krishoe-gold-v2.png",
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
  // WhatsApp/Viber ordering number (separate from the shop's landline/phone).
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "9779766630193",
  whatsappDisplay: process.env.NEXT_PUBLIC_WHATSAPP_DISPLAY ?? "+977 9766630193",
  viberNumber: process.env.NEXT_PUBLIC_VIBER_NUMBER ?? "+9779766630193",
  email: process.env.NEXT_PUBLIC_BUSINESS_EMAIL ?? "skschhapal@gmail.com",
  streetAddress: process.env.NEXT_PUBLIC_BUSINESS_STREET ?? "Kamalnagar, Narayangadh",
  addressLocality: process.env.NEXT_PUBLIC_BUSINESS_CITY ?? "Bharatpur",
  addressRegion: process.env.NEXT_PUBLIC_BUSINESS_REGION ?? "Chitwan",
  postalCode: process.env.NEXT_PUBLIC_BUSINESS_POSTAL ?? "44200",
  openingHours: "Mo-Sa 10:00-19:00",
  // Canonical profile URLs, deliberately without the tracking parameters that
  // come attached to a shared or QR-scanned link (?mibextid, ?igsi, ?_t and
  // friends). Those are per-share tokens: noise in the footer, and the wrong
  // thing to hand Google in `sameAs`, which wants the stable profile address.
  //
  // The Facebook one is the KRISHOE business Page (id 61593622372780), not the
  // owner's personal profile it used to point at — a shopper following the
  // footer link was landing on a private account.
  //
  // The username the owner claimed on 2026-08-23, which is the shortest and
  // steadiest address the Page has: it survives the id, it is legible in a
  // footer, and it is the one thing here that can be printed on a card or a
  // shoebox. It answers 200 directly — no redirect, unlike the two forms that
  // came before it.
  facebook: process.env.NEXT_PUBLIC_FACEBOOK_URL ?? "https://www.facebook.com/krishoe.np",
  // krishoe.np, matching the Facebook Page username. The shop used to point at
  // shree_krishna_chhapal — the account the owner posted from before there was a
  // business profile. The two are now connected under one Meta business
  // portfolio, so a shopper following the footer should land on the one the shop
  // actually posts from.
  instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? "https://www.instagram.com/krishoe.np",
  tiktok: process.env.NEXT_PUBLIC_TIKTOK_URL ?? "https://www.tiktok.com/@s.k.c.shoes666",
};

/**
 * The social profiles that are actually configured, each with its label.
 *
 * Trimmed before the emptiness check for the same reason getSiteUrl trims: a
 * value pasted into a hosting dashboard can arrive as " " or with a trailing
 * newline, and a plain truthiness test treats those as real. That would put a
 * dead link in the footer and, worse, feed a malformed URL to Google through
 * the `sameAs` fields below.
 *
 * Returned as a list rather than a URL-keyed lookup so two platforms can never
 * collide on the same key and lose a label.
 */
export function businessSocialProfiles() {
  return [
    { label: "Facebook", url: businessContact.facebook },
    { label: "Instagram", url: businessContact.instagram },
    { label: "TikTok", url: businessContact.tiktok },
  ]
    .map((profile) => ({ ...profile, url: profile.url.trim() }))
    .filter((profile) => profile.url.length > 0);
}

export function businessSocialLinks() {
  return businessSocialProfiles().map((profile) => profile.url);
}

export function getSiteUrl() {
  // Trim before anything else. A dashboard-pasted env value can carry a
  // trailing newline, and without this it survives into every absolute URL we
  // emit — the live sitemap was serving `<loc>https://host\n/shop</loc>`, and
  // the same broken string would be encoded into printed QR codes.
  const configured = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  // The fallback is the address that actually resolves. It used to be
  // https://krishoe.com, which nobody has registered — checked, and it does not
  // answer at all. Every canonical link, every sitemap entry and every QR code
  // would have pointed at a dead host the moment this variable went missing,
  // and Google would have been told the whole shop lives there. Change this the
  // day the domain is really bought, not before.
  return (configured || "https://krishoe-website.vercel.app").replace(/\/+$/, "");
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
  categorySlug,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
  /** Adds the words someone looking for that particular shelf would type. */
  categorySlug?: string;
}): Metadata {
  const pageTitle = title.includes(siteConfig.name) ? title : `${title} | ${siteConfig.name}`;
  const canonical = absoluteUrl(path);
  const imageUrl = absoluteUrl(image);

  return {
    title: pageTitle,
    description,
    // Every page a shopper could land on from a search carries the words they
    // would have typed. Only the product pages had any, and those were
    // Devanagari alone.
    keywords: shopSearchWords(categorySlug),
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

/**
 * What Google is given to show for one pair of shoes.
 *
 * A search result is two lines of text and it decides whether anyone clicks.
 * These used to be the product's name and its marketing sentence, which told a
 * searcher nothing they were actually deciding on — what it costs, whether it
 * is in stock, whether it reaches them.
 *
 * The description below answers those in the order a Nepali shopper asks them,
 * in both languages, because a search here is as likely to be typed in Nepali
 * as in English. Every claim in it is one the shop already keeps: the price is
 * the live price, the stock line follows real stock, and delivery and
 * cash-on-arrival are how the shop actually works.
 *
 * Google shows roughly 155 characters, so the price and availability come
 * first — they are what a shopper is scanning for.
 */
export function productSearchDescription(product: Product) {
  const price = formatPrice(product.priceValue);
  const availability =
    product.stock > 0 ? "अहिले उपलब्ध · In stock" : "अहिले सकियो · Currently sold out";

  return [
    `${product.name} — ${price}`,
    availability,
    "नेपालमै बनेको, सिधै कारखानाबाट",
    "नेपालभरि delivery · सामान पाएपछि पैसा (COD)",
  ].join(" · ");
}

export function createProductMetadata(product: Product): Metadata {
  // The category carries the words people search for — "sandal", "chappal",
  // "shoes" — which the product's own name often does not.
  const title = `${product.name} — ${product.category} | KRISHOE Nepal`;
  const description = productSearchDescription(product);
  const canonical = absoluteUrl(`/product/${product.id}`);
  const imageUrl = absoluteUrl(product.image);

  return {
    title,
    description,
    // Devanagari alone was the whole list, and almost nobody types Devanagari
    // into a search box — they type jutta, chappal, bachha ko jutta. This
    // shop's own Instagram was shree_krishna_chhapal.
    keywords: productSearchWords({
      name: product.name,
      category: product.category,
      categorySlug: product.categorySlug,
    }),
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
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
      description,
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

/**
 * The keyword list for the shop and its category pages.
 *
 * These are the pages a search for "chappal nepal" or "bachha ko jutta" should
 * land on, and they carried no keywords at all — only the individual product
 * pages did, and only in Devanagari.
 */
export function shopSearchWords(categorySlug?: string): string[] {
  return [
    ...new Set([
      "KRISHOE",
      ...(categorySlug ? (CATEGORY_WORDS[categorySlug] ?? []) : []),
      ...FOOTWEAR_WORDS,
      ...PLACE_WORDS,
    ]),
  ];
}
