import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { stockByShoe } from "@/lib/dashboard-figures";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * Owner, 2026-10-11: "Shop stock" listed the website shoes' whole stock, three
 * of four at the factory, and "181 pairs" left out the 399 in draft. Now one
 * card says all of it, where it is and whether it is on the website, with what
 * to do, and a bar a shoe. Figures from the live shop that day.
 */
const products = [
  { name: "lose hill panja", status: "Active", stock: 60, priceValue: 95_000 },
  { name: "close shoe chinies# 233", status: "Active", stock: 55, priceValue: 120_000 },
  { name: "kitto 770", status: "Draft", stock: 200, priceValue: 0 },
  { name: "barmi buckl", status: "Draft", stock: 0, priceValue: 0 },
  { name: "Doctor Chappal", status: "Active", stock: 0, priceValue: 50_000 },
];
const places = [
  { design: "lose hill panja", factory: 60, shop: 0, total: 60 },
  { design: "close shoe chinies# 233", factory: 0, shop: 55, total: 55 },
  { design: "kitto 770", factory: 0, shop: 200, total: 200 },
  { design: "kitto 770", factory: 0, shop: 100, total: 0 },
];

describe("every shoe's stock, and where it is", () => {
  const stock = stockByShoe(products, places);

  it("counts every pair, the drafts' too, and says which are on the website", () => {
    expect(stock.all).toBe(315);
    expect(stock.web).toBe(115);
    expect(stock.draft).toBe(200);
    expect(stock.draftShoes).toBe(1);
  });

  it("splits it factory and shop, and keeps pairs placed too many apart", () => {
    expect(stock.factory).toBe(60);
    expect(stock.shop).toBe(255);
    expect(stock.over).toBe(100);
    expect(stock.lines.find((line) => line.name === "kitto 770")).toMatchObject({ total: 200, shop: 200, over: 100 });
    expect(stock.mismatched).toEqual([{ name: "kitto 770", over: 100, noPlace: 0 }]);
  });

  it("names a website shoe with none at the shop", () => {
    expect(stock.noneAtShop).toEqual([{ name: "lose hill panja", factory: 60 }]);
  });

  it("values every pair, and says which have no price", () => {
    expect(stock.value).toBe(60 * 950 + 55 * 1200);
    expect(stock.noPrice).toBe(1);
  });

  it("keeps a sold-out website shoe on the list and leaves an empty draft off", () => {
    expect(stock.lines.map((line) => line.name)).toContain("Doctor Chappal");
    expect(stock.lines.map((line) => line.name)).not.toContain("barmi buckl");
  });
});

describe("the dashboard card", () => {
  it("says all the pairs, the split, the three things to do, and a bar a shoe", async () => {
    const screen = await read("components/admin/OwnerDashboard.tsx");
    expect(screen).toContain('text("👟 Stock by shoe", "👟 जुत्ता अनुसार स्टक")');
    expect(screen).not.toContain('text("🛒 Shop stock", "🛒 पसलको स्टक")');
    expect(screen).toContain("pairs in all · ${stock.web} on the website · ${stock.draft} in draft");
    expect(screen).toContain('key: "places"');
    expect(screen).toContain('key: "drafts"');
    expect(screen).toContain('key: "none-at-shop"');
    expect(screen).toContain('href: "/admin/stock#move-pairs"');
    expect(screen).toContain('href: "/admin/stock#not-on-website"');
  });

  it("keeps the amount behind its eye", async () => {
    const screen = await read("components/admin/OwnerDashboard.tsx");
    expect(screen).toContain('openFigures.has("/admin/stock") ? (');
  });

  it("lands each line where it is put right", async () => {
    const where = await read("app/admin/stock/WherePairsAre.tsx");
    expect(where).toContain('<section id="every-shoe"');
    expect(where).toContain('<section id="move-pairs"');
    expect(where).toContain("useState<Set<string>>(() => new Set(countFirst && canCount ? [countFirst] : []))");
    const stockPage = await read("app/admin/stock/page.tsx");
    expect(stockPage).toContain("countFirst={countFirst}");
    const page = await read("app/admin/stock/page.tsx");
    expect(page).toContain('<section id="not-on-website"');
  });
});
