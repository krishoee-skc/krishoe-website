import type { Metadata } from "next";
import {
  CATEGORY_WORDS,
  FOOTWEAR_WORDS,
  PLACE_WORDS,
  productSearchWords,
} from "@/lib/search-words";
import { categories, formatPrice, productReviewStats, type Category, type Product } from "@/lib/products";

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
  /**
   * Where the shop is, as a point on the map.
   *
   * The address alone tells a search engine the town; the coordinates tell it
   * the distance. "Shoe shop near me", typed by somebody standing in Bharatpur,
   * is ranked on that distance — so an address without a point competes from
   * behind against every shop that has one.
   *
   * The default is Narayangadh's own centre (27.6956, 84.4232), looked up
   * rather than guessed. It is the town, not the doorway: set
   * NEXT_PUBLIC_BUSINESS_LAT and _LNG to the exact pin from Google Maps —
   * right-click the shop, and the first two numbers in the menu are these.
   */
  latitude: process.env.NEXT_PUBLIC_BUSINESS_LAT ?? "27.6956",
  longitude: process.env.NEXT_PUBLIC_BUSINESS_LNG ?? "84.4232",
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
  /**
   * The shop's YouTube channel, once it exists.
   *
   * Empty on purpose, and the one difference from the three above: those carry
   * a default because the accounts are real and the owner posts from them. No
   * KRISHOE channel had been created when this was written, and a footer icon
   * leading to a 404 — or a `sameAs` naming a channel that is not the shop's —
   * is worse than no icon at all. Google reads `sameAs` as a claim of identity.
   *
   * Set NEXT_PUBLIC_YOUTUBE_URL to the channel address and it appears in the
   * footer and the schema with no code change; businessSocialProfiles() drops
   * anything empty. Use the channel's own URL (youtube.com/@handle), not a
   * single video's.
   */
  youtube: process.env.NEXT_PUBLIC_YOUTUBE_URL ?? "",
  /**
   * The shop's Google Business Profile, once it exists.
   *
   * This is the single strongest local signal there is — it is what puts a shop
   * in the map box above the ordinary results, and it carries the reviews,
   * photos and opening hours a shopper reads before deciding to come. Named in
   * sameAs, it tells Google that the profile and this website are one business
   * rather than two things with the same name.
   *
   * Deliberately empty until the owner creates the profile: a sameAs pointing
   * at nothing is worse than no sameAs. Set NEXT_PUBLIC_GOOGLE_BUSINESS_URL to
   * the profile's share link and it joins the schema with no code change. It is
   * kept out of businessSocialProfiles() on purpose — that list draws the
   * footer's social icons, and a map is not a social account.
   */
  googleBusiness:
    process.env.NEXT_PUBLIC_GOOGLE_BUSINESS_URL ??
    "https://maps.app.goo.gl/gkZXYXWtKZcLVYdk9",
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
    { label: "YouTube", url: businessContact.youtube },
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
  // The fallback is the address that actually resolves. krishoe.com was bought
  // on 2026-08-29 and is live; the apex 308-redirects to www, so www.krishoe.com
  // is the host that actually serves the shop and holds the TLS certificate —
  // that is the canonical every sitemap entry, canonical link and QR code should
  // point at. NEXT_PUBLIC_SITE_URL is set to the same value in production; this
  // fallback only guards a missing variable.
  return (configured || "https://www.krishoe.com").replace(/\/+$/, "");
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
  // The Google Business Profile belongs here but not in the footer's icon row,
  // so it is added to sameAs directly rather than through the social list.
  const profile = businessContact.googleBusiness.trim();
  const sameAs = [...businessSocialLinks(), ...(profile ? [profile] : [])];

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
    // Distance is how "near me" is ranked, and an address is not a distance.
    geo: {
      "@type": "GeoCoordinates",
      latitude: businessContact.latitude,
      longitude: businessContact.longitude,
    },
    // The map link a shopper actually taps, and a second signal to Google that
    // this address and this point are the same shop.
    hasMap: `https://www.google.com/maps/search/?api=1&query=${businessContact.latitude},${businessContact.longitude}`,
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
  // The rating Google shows must be the one real reviews add up to, not the
  // manual `rating` field — otherwise a search snippet could promise 4.8 stars
  // over reviews that average 3.2, which the shopper then reads on the page.
  const { average: ratingValue } = productReviewStats(product.reviews);
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

  if (ratingValue > 0 && approvedReviews.length > 0) {
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
