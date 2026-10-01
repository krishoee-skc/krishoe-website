import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { searchProducts } from "@/lib/product-search";
import { sizeForFoot } from "@/components/SizeGuide";
import type { Product } from "@/lib/products";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * The shop, made premium (owner, 2026-10-01): one icon style in the shop's
 * green, two shoes to a row on a phone, no row drawn twice, the rating and a
 * WhatsApp order under the banner, a free-delivery bar, reviews that move,
 * a size slider, and search in Nepali.
 */
const shoe = (name: string, extra: Partial<Product> = {}) =>
  ({ id: name, name, sku: "", category: "Ladies Sandals", badge: "", colors: [], sizes: [], description: "", stock: 5, ...extra }) as unknown as Product;

describe("search in Nepali too", () => {
  it("finds the chappals, the hills and the sandals by their Nepali names", () => {
    const shop = [shoe("Doctor Chappal"), shoe("bantu hill"), shoe("lose hill panja")];
    expect(searchProducts(shop, "चप्पल").map((match) => match.product.name)).toEqual(["Doctor Chappal"]);
    expect(searchProducts(shop, "हिल").map((match) => match.product.name).sort()).toEqual(["bantu hill", "lose hill panja"]);
    expect(searchProducts(shop, "स्यान्डल")).toHaveLength(3);
    expect(searchProducts(shop, "doctor")).toHaveLength(1);
  });
});

describe("the size slider", () => {
  it("gives the smallest size that fits, the larger between two", () => {
    const sizes = [36, 37, 38, 39, 40];
    expect(sizeForFoot(sizes, 22.5)).toBe(36);
    expect(sizeForFoot(sizes, 23.2)).toBe(37);
    expect(sizeForFoot(sizes, 99)).toBe(40);
  });
});

describe("one icon style, no emojis in the shop", () => {
  it("draws with the shop's own line icons", async () => {
    for (const file of ["components/NavbarControls.tsx", "components/ProductCardActions.tsx", "components/TrustStrip.tsx", "components/Testimonials.tsx", "app/reviews/page.tsx"]) {
      expect(await read(file), file).not.toMatch(/[📦🏪💬📍👟🚚💵]|↩️/u);
    }
    const icons = await read("components/Icons.tsx");
    for (const name of ["WhatsAppIcon", "TruckIcon", "CashIcon", "ReturnIcon", "StoreIcon", "MapPinIcon", "RulerIcon"]) {
      expect(icons).toContain(`export function ${name}`);
    }
    const tabs = await read("components/BottomTabBar.tsx");
    expect(tabs).toContain('const ONE_TONE = "bg-brand-green-tint text-brand-green";');
    expect(tabs).not.toMatch(/iconBubble\("bg-\[#/);
  });
});

describe("the home page", () => {
  it("puts two shoes to a row on a phone, and draws no row twice", async () => {
    const css = await read("app/globals.css");
    expect(css).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
    const home = await read("app/page.tsx");
    expect(home).toContain("{products.length > HOME_ROW ? (");
    expect(home).toContain("data-hero-actions");
    expect(home).toContain('<T en="Order on WhatsApp" ne="WhatsApp मा अर्डर" />');
  });

  it("moves the reviews by themselves, and stops for a touch or less motion", async () => {
    const row = await read("components/AutoScrollRow.tsx");
    expect(row).toContain('if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;');
    expect(row).toContain('element.addEventListener("pointerdown", hold);');
    expect(await read("components/Testimonials.tsx")).toContain("<AutoScrollRow");
  });

  it("fills a bar toward free delivery in the cart, from Settings", async () => {
    expect(await read("components/CartClient.tsx")).toContain("data-free-delivery");
    expect(await read("app/cart/page.tsx")).toContain("<CartClient freeOverPaisa={delivery?.freeOverPaisa ?? 0} />");
  });
});
