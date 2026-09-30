import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { findProductByParam, productPath, productSlug } from "@/lib/product-url";
import { photoAdvice } from "@/lib/product-photo";
import { languagePair } from "@/lib/seo";
import { categoryNepali, nepaliCategory } from "@/lib/nepali-pages";
import { ruleSummary } from "@/app/admin/owner-summary-action";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * From the audit of 2026-10-01: a wrong WhatsApp number in llms.txt, shoe
 * addresses that were ids, a site Google read only in English, one WhatsApp
 * photo per shoe, and no "what do I do today" for the Owner.
 */
const bantu = { id: "571e0e15-0263-4873-a146-f09bb3cab6f8", name: "bantu hill", sku: "KR-201" };
const kitto = { id: "a1", name: "kitto#825", sku: "KR-101" };
const noCode = { id: "c0f93fc7", name: "close shoe chinies# 233", sku: "" };

describe("2. the number AI search is given", () => {
  it("gives WhatsApp the WhatsApp number, and the phone its own", async () => {
    const route = await read("app/llms.txt/route.ts");
    expect(route).toContain("- Order or ask on WhatsApp/Viber: ${businessContact.whatsappDisplay}. Phone: ${businessContact.phoneDisplay}.");
  });
});

describe("4. a shoe's address in words", () => {
  it("is its name and code", () => {
    expect(productSlug(bantu)).toBe("bantu-hill-kr-201");
    expect(productSlug(kitto)).toBe("kitto-825-kr-101");
    expect(productSlug(noCode)).toBe("close-shoe-chinies-233-c0f93fc7");
    expect(productPath(bantu)).toBe("/product/bantu-hill-kr-201");
    expect(productPath(bantu, "ne")).toBe("/ne/product/bantu-hill-kr-201");
  });

  it("still finds the shoe by its old id, and by an older name ending in its code", () => {
    const items = [bantu, kitto, noCode];
    expect(findProductByParam(items, bantu.id)).toBe(bantu);
    expect(findProductByParam(items, "bantu-hill-kr-201")).toBe(bantu);
    expect(findProductByParam(items, "old-name-kr-101")).toBe(kitto);
    expect(findProductByParam(items, "nothing-here")).toBeUndefined();
  });

  it("sends an old address on, permanently, and links by the words everywhere", async () => {
    const page = await read("app/product/[id]/page.tsx");
    expect(page).toContain("permanentRedirect(productPath(product));");
    expect(await read("components/ProductCard.tsx")).toContain("const href = productPath(product);");
    expect(await read("app/sitemap.ts")).toContain("url: `${baseUrl}${productPath(product)}`,");
    const seo = await read("lib/seo.ts");
    expect(seo).not.toContain("absoluteUrl(`/product/${product.id}`)");
  });
});

describe("6. the Nepali pages", () => {
  it("pair each page with its Nepali twin for search engines", () => {
    expect(languagePair("/shop", "/ne/shop", "en")).toEqual({
      en: "https://www.krishoe.com/shop",
      "ne-NP": "https://www.krishoe.com/ne/shop",
      "x-default": "https://www.krishoe.com/shop",
    });
    expect(languagePair("/ne/shop", "/shop", "ne")["ne-NP"]).toBe("https://www.krishoe.com/ne/shop");
  });

  it("names every shelf in Nepali", () => {
    for (const slug of ["ladies-sandals", "ladies-slippers", "casual-shoes", "party-heels", "mens-collection", "kids-collection", "new-arrivals"]) {
      expect(categoryNepali[slug], slug).toBeTruthy();
    }
    expect(nepaliCategory("ladies-sandals", "Ladies Sandals").title).toBe("लेडिज स्यान्डल | KRISHOE नेपाल");
  });

  it("builds them in Nepali on the server, and lists them in the sitemap", async () => {
    expect(await read("app/ne/layout.tsx")).toContain('<LanguageProvider initialLanguage="ne">');
    const provider = await read("components/LanguageProvider.tsx");
    expect(provider).toContain('useState<Language>(initialLanguage ?? "en")');
    expect(provider).toContain("if (initialLanguage) return;");
    for (const page of ["app/ne/page.tsx", "app/ne/shop/page.tsx", "app/ne/shop/[category]/page.tsx", "app/ne/product/[id]/page.tsx"]) {
      expect(await read(page), page).toMatch(/language: "ne"|createProductMetadata\(product, "ne"\)/);
    }
    const sitemap = await read("app/sitemap.ts");
    expect(sitemap).toContain("url: `${baseUrl}/ne/shop`");
    expect(sitemap).toContain('url: `${baseUrl}${productPath(product, "ne")}`,');
  });
});

describe("8. photos that would sell better", () => {
  it("says one photo and a WhatsApp snap, and nothing for a good set", () => {
    const whatsapp = "https://blob/products/whatsapp-image-2026-09-26-at-23.52.15.webp";
    expect(photoAdvice({ image: whatsapp, gallery: [whatsapp] }).map((item) => item.en)).toEqual([
      "One photo only — add 2–4 angles (side, top, sole, worn)",
      "A WhatsApp photo — a clear one on a plain white background sells better",
    ]);
    expect(photoAdvice({ image: "https://blob/a.webp", gallery: ["https://blob/a.webp", "https://blob/b.webp"] })).toEqual([]);
    expect(photoAdvice({ image: "", gallery: [] })).toEqual([]);
  });
});

describe("11. the Owner's summary", () => {
  it("falls back to the same facts in plain words, most urgent first", async () => {
    const points = await ruleSummary({
      today: { net: 3600, bills: 1, pairs: 6, newOrders: 0 },
      week: 6225,
      month: 58570,
      salesGoal: 100000,
      todos: ["३ जुत्ताको मूल्य छैन", "१ चेक साट्न बाँकी"],
      lowShoes: [{ name: "ladies magic#8013", stock: 5 }],
      factoryTodayPairs: 0,
      creditOwed: 0,
      workerDue: 1200,
    });
    expect(points[0]).toBe("३ जुत्ताको मूल्य छैन");
    expect(points).toContain("कामदारलाई तिर्न बाँकी रु. 1,200।");
    expect(points.length).toBeLessThanOrEqual(5);
  });

  it("asks the AI from the dashboard's own figures only, and never changes anything", async () => {
    const action = await read("app/admin/owner-summary-action.ts");
    expect(action).toContain('await requireAdminPermission("dashboard:read");');
    expect(action).toContain("Use only numbers that appear in the facts.");
    expect(action).not.toMatch(/queryPostgres|upsert|insert|update/i);
  });
});

describe("4. the old address moves with a real 308", () => {
  it("is sent on above the loading screen, so the answer is not already a 200", async () => {
    const layout = await read("app/product/[id]/layout.tsx");
    expect(layout).toContain("permanentRedirect(productPath(product));");
  });
});
