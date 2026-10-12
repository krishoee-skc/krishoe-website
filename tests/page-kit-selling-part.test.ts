import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");
const nepaliWords = (source: string) => (source.match(/[ऀ-ॿ]+/g) ?? []).length;

/**
 * The owner's sample, part 3 (2026-10-12): costing, buying and selling in the
 * shared frame. Costing was English from top to bottom.
 */
describe("Costing", () => {
  it("is in both languages and in four tabs, every table still there", async () => {
    const page = await read("app/admin/costing/page.tsx");
    expect(nepaliWords(page)).toBeGreaterThan(200);
    for (const key of ["profit", "shoes", "material", "rates"]) expect(page).toContain(`key: "${key}"`);
    for (const table of ["designProfit", "finishedStock", "catalogMatch", "rawStock", "batchCosting", "materialRates", "profitPeriods"]) {
      expect(page).toContain(`{${table}}`);
    }
    expect(page).toContain('{ en: "gross profit", ne: "कुल नाफा", value: costing.summary.grossProfit, money: true');
    expect(page).not.toMatch(/<th className="py-2 pr-3">[A-Za-z]/);
  });
});

describe("Purchasing", () => {
  it("keeps the bill first, and the accounts in three tabs", async () => {
    const page = await read("app/admin/purchasing/page.tsx");
    expect(page).toContain('id="purchasing-accounts"');
    for (const key of ["suppliers", "bills", "check"]) expect(page).toContain(`key: "${key}"`);
    expect(page.indexOf("<PurchaseInvoiceForm")).toBeLessThan(page.indexOf("<StatStrip"));
  });
});

describe("Orders", () => {
  it("fits the payment form on a phone", async () => {
    const orders = await read("app/admin/OrdersClient.tsx");
    expect(orders).not.toContain("min-w-[560px]");
  });
});

describe("Cut a bill", () => {
  it("puts the reports in two tabs and every heading in both languages", async () => {
    const pos = await read("app/admin/pos/page.tsx");
    expect(pos).toContain('id="pos-reports"');
    expect(pos).toContain('<T en="Payment close" ne="भुक्तानी अनुसार बन्द" />');
    expect(pos).not.toMatch(/tracking-\[0\.16em\] text-brand-green-ink">[A-Z][a-z]+ close<\/h3>/);
  });
});

describe("Products", () => {
  it("shows a photo card a shoe on a phone, and website or draft", async () => {
    const list = await read("app/admin/ProductsClient.tsx");
    expect(list).toContain('className="grid list-none gap-2 pl-0 md:hidden"');
    expect(list).toContain('{ key: "draft", en: "📝 Draft", ne: "📝 Draft", count: draftCount }');
    expect(list).toContain('text("Add a photo → put on sale", "फोटो राखेर बिक्रीमा →")');
    const page = await read("app/admin/products/page.tsx");
    expect(page).toContain('<T en="Labels · codes · sync" ne="स्टिकर · कोड · मिलाउने" />');
  });
});
