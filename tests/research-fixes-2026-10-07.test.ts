import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { isShopVideoUrl, isVideoUrl, photosOf, videoOf } from "@/lib/product-media";
import { weekMover } from "@/lib/notifications";
import { productJsonLd, itemListJsonLd } from "@/lib/seo";
import type { Product } from "@/lib/products";

/**
 * Owner, 2026-10-07: the fixes from the full look at the app — analytics the
 * site's own rules blocked, a laptop header cut off, the Nepali pages marked
 * English, colours too faint to read, a slimmer language question, a page for
 * people nearby, the shoe's return terms for Google, AI writing a Draft's
 * words, the week's mover on the phone, and a shoe's short video.
 */
const read = (file: string) => readFile(file, "utf8");

describe("the site's own rules let analytics, translation and videos through", () => {
  it("allows GA4's google.com collect, the shop's video store and the blob uploads", async () => {
    const config = await read("next.config.js");
    expect(config).toMatch(/"connect-src[^"]*https:\/\/www\.google\.com /);
    expect(config).toContain("\"media-src 'self' blob: https://*.public.blob.vercel-storage.com\"");
    expect(config).toMatch(/"connect-src[^"]*https:\/\/vercel\.com https:\/\/\*\.blob\.vercel-storage\.com"/);
    expect(config).toMatch(/"style-src 'self' 'unsafe-inline' https:\/\/www\.gstatic\.com"/);
  });
});

describe("pages read right", () => {
  it("marks the Nepali pages Nepali in the HTML the server sends", async () => {
    expect(await read("app/ne/layout.tsx")).toContain('<div lang="ne" className="contents">');
  });

  it("keeps the wide search box for wide screens, so Account fits a 1366 laptop", async () => {
    const search = await read("components/CommandSearch.tsx");
    expect(search).toContain("hover:border-brand-green/40 2xl:flex");
    expect(search).toContain("lg:grid 2xl:hidden");
  });

  it("asks about Nepali in one slim line, not a card", async () => {
    const invite = await read("components/LanguageInvite.tsx");
    expect(invite).toContain('role="region"');
    expect(invite).toContain("rounded-full border border-brand-gold/40");
  });

  it("reads the card's sizes aloud as words, not a label on a paragraph", async () => {
    const sizes = await read("components/CardSizes.tsx");
    expect(sizes).toContain('<span className="sr-only">');
    expect(sizes).not.toContain("aria-label={text(");
  });
});

describe("Google is told the shop's terms, and less of everything on every page", () => {
  const shoe = {
    id: "p1", sku: "KR-206", name: "Lose Hill Panja", slug: "", category: "Ladies Sandals", categorySlug: "ladies-sandals",
    price: "Rs. 950", priceValue: 95000, wholesalePriceValue: 0, minWholesaleQty: 0,
    image: "https://x.public.blob.vercel-storage.com/products/a.webp",
    gallery: ["https://x.public.blob.vercel-storage.com/products/a.webp", "https://x.public.blob.vercel-storage.com/products/videos/a.mp4"],
    rating: "0", description: "", longDescription: "", material: "", fit: "", colors: ["Maroon"], sizes: ["36", "37"], stock: 5,
    highlights: [], care: [], reviews: [], status: "Active", featured: false, bestSeller: false, newArrival: false,
  } as unknown as Product;

  it("gives each shoe the seven-day return policy, its sizes, and pictures only", () => {
    const data = productJsonLd(shoe) as { offers: { hasMerchantReturnPolicy: { merchantReturnDays: number; applicableCountry: string } }; image: string[]; size: string };
    expect(data.offers.hasMerchantReturnPolicy.merchantReturnDays).toBe(7);
    expect(data.offers.hasMerchantReturnPolicy.applicableCountry).toBe("NP");
    expect(data.image.every((url) => !url.endsWith(".mp4"))).toBe(true);
    expect(data.size).toBe("36, 37");
  });

  it("lists only the shoes' addresses on pages that are not the shoe's own", () => {
    const list = itemListJsonLd({ name: "x", url: "/shop", products: [shoe], summary: true });
    expect(list.itemListElement[0]).not.toHaveProperty("item");
  });
});

describe("a page for people nearby", () => {
  it("is in both languages and in the sitemap", async () => {
    expect(await read("app/narayangadh/page.tsx")).toContain('pairPath: "/ne/narayangadh"');
    expect(await read("app/ne/narayangadh/page.tsx")).toContain('language: "ne"');
    const sitemap = await read("app/sitemap.ts");
    expect(sitemap).toContain("${baseUrl}/narayangadh");
    expect(sitemap).toContain("${baseUrl}/ne/narayangadh");
  });
});

describe("AI writes a Draft's words, and the owner still presses Save", () => {
  it("opens the form with the draft already being written", async () => {
    expect(await read("app/admin/products/DraftsPanel.tsx")).toContain("&ai=1");
    expect(await read("app/admin/products/page.tsx")).toContain('autoDraft={Boolean(editingProduct) && resolvedSearchParams?.ai === "1"}');
    expect(await read("app/admin/AiDraftButton.tsx")).toContain("if (!autoStart || autoStarted.current) return;");
  });
});

describe("the week's mover on the phone, worked out at home", () => {
  const sale = (createdAt: string, design: string, quantity: number) => ({ createdAt, kind: "Sale", status: "Paid", items: [{ design, quantity }] });

  it("names the shoe that moved most, this week against last", () => {
    const invoices = [
      sale("2026-10-06T06:00:00Z", "Doctor Chappal", 2),
      sale("2026-09-29T06:00:00Z", "Doctor Chappal", 8),
      sale("2026-10-05T06:00:00Z", "bantu hill", 3),
      sale("2026-09-28T06:00:00Z", "bantu hill", 2),
    ];
    expect(weekMover(invoices, "2026-10-07")).toBe("यो हप्ता Doctor Chappal ▼ 6 जोडी कम (8 → 2)");
  });

  it("says nothing when no shoe moved by two pairs", () => {
    expect(weekMover([sale("2026-10-06T06:00:00Z", "x", 1)], "2026-10-07")).toBeNull();
  });

  it("never sends the sales to the AI", async () => {
    const notifications = await read("lib/notifications.ts");
    const mover = notifications.slice(notifications.indexOf("export function weekMover"), notifications.indexOf("export async function tellOwnerTheDay"));
    expect(mover).not.toContain("askGemini");
  });
});

describe("a shoe's short video", () => {
  it("is told apart from the photos", () => {
    const list = ["https://s.public.blob.vercel-storage.com/products/a.webp", "https://s.public.blob.vercel-storage.com/products/videos/a-x1.mp4"];
    expect(isVideoUrl(list[1])).toBe(true);
    expect(photosOf(list)).toEqual([list[0]]);
    expect(videoOf(list)).toBe(list[1]);
  });

  it("is only ever the shop's own upload", () => {
    expect(isShopVideoUrl("https://s.public.blob.vercel-storage.com/products/videos/a-x1.mp4")).toBe(true);
    expect(isShopVideoUrl("https://evil.example/products/videos/a.mp4")).toBe(false);
    expect(isShopVideoUrl("https://s.public.blob.vercel-storage.com/backups/a.mp4")).toBe(false);
  });

  it("can never become the cover, and the last picture stays", async () => {
    const actions = await read("app/admin/products/photos/actions.ts");
    expect(actions).toContain("!product.gallery.includes(image) || isVideoUrl(image)");
    expect(actions).toContain("if (!isVideoUrl(image) && photosOf(rest).length === 0) {");
    expect(actions).toContain("if (!isShopVideoUrl(url)) {");
  });

  it("is uploaded only by staff who may change products, as a video, up to 20 MB", async () => {
    const route = await read("app/api/admin/products/video/route.ts");
    expect(route).toContain('await requireAdminPermission("products:write");');
    expect(route).toContain("allowedContentTypes: [...VIDEO_TYPES]");
    expect(route).toContain("maximumSizeInBytes: VIDEO_MAX_BYTES");
  });
});
