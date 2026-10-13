import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");
const nepaliWords = (source: string) => (source.match(/[ऀ-ॿ]+/g) ?? []).length;

/**
 * The owner's sample, part 7ग (2026-10-13): the factory's other pages.
 */
describe("Saturday payments", () => {
  it("is in both languages, three figures, four tabs, no left-over numbering", async () => {
    const page = await read("app/admin/operations/production-accounts/payments/page.tsx");
    expect(nepaliWords(page)).toBeGreaterThan(60);
    expect(page).toContain('id="wages-payments"');
    for (const key of ["saturday", "balances", "recent", "cash"]) expect(page).toContain(`key: "${key}"`);
    expect(page).toContain('{ en: "to pay this Saturday", ne: "यो शनिबार दिनुपर्ने", value: weeklyPayable, money: true');
    expect(page).not.toContain("7. Worker cash");
    const fields = await read("app/admin/operations/production-accounts/payments/WorkerCashFields.tsx");
    expect(fields).toContain('{ value: "Saturday Kharcha", en: "Saturday kharcha", ne: "शनिबारको खर्च" },');
  });
});

describe("Wage rates", () => {
  it("shows the rates in force first, the forms behind tabs, in both languages", async () => {
    const page = await read("app/admin/operations/production-accounts/rates/page.tsx");
    expect(nepaliWords(page)).toBeGreaterThan(50);
    expect(page).toContain('id="wage-rates"');
    expect(page.indexOf('key: "current"')).toBeLessThan(page.indexOf('key: "add"'));
    expect(page).toContain('key: "special"');
    expect(page).not.toContain("2. Item-stage wage");
  });
});

describe("Workers", () => {
  it("is a short card a person, correcting and the app folded, owed behind the eye", async () => {
    const team = await read("app/admin/factory/workers/TeamList.tsx");
    expect(team).toContain('📱 {text("Worker app", "कामदारको app")}');
    expect(team).toContain("<Amount>{money(balances[worker.id] ?? 0)}</Amount>");
    expect(team).not.toContain("Workers and HR linkage");
    expect(team).toContain('text("Worker ledger", "कामदारको खाता")');
  });
});

describe("Items", () => {
  it("shows the ones to link first, in both languages", async () => {
    const items = await read("app/admin/factory/items/ItemList.tsx");
    expect(items).toContain('{ key: "todo" as const, en: "⚠ To link", ne: "⚠ जोड्न बाँकी", count: blockedCount },');
    expect(items).not.toContain("Item Master linkage");
    expect(items).not.toContain("Production Item Master carries BOM");
  });
});

describe("Monthly report", () => {
  it("hides rupees behind the eye and reads two lines a worker on a phone", async () => {
    const report = await read("app/admin/factory/reports/PayrollReport.tsx");
    expect(report).toContain("value={<Amount>{money(totalBalance)}</Amount>}");
    expect(report).toContain('<ul className="grid list-none gap-2 pl-0 md:hidden print:hidden">');
  });
});

describe("Worker QR", () => {
  it("sends the sign-in link on WhatsApp", async () => {
    const qr = await read("app/admin/factory/worker-portal-qr/page.tsx");
    expect(qr).toContain("const shareUrl = `https://wa.me/?text=");
    expect(qr).toContain('📤 <T en="Send on WhatsApp" ne="WhatsApp मा पठाउने" />');
  });
});

describe("Cost of a pair", () => {
  it("is three tabs, no numbering", async () => {
    const lots = await read("app/admin/operations/production-accounts/lots/page.tsx");
    expect(lots).toContain('id="cost-of-a-pair"');
    for (const key of ["cost", "add", "approved"]) expect(lots).toContain(`key: "${key}"`);
    expect(lots).not.toContain("1. Cost of a pair");
    expect(lots).not.toContain("2. Add a shoe");
  });
});
