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
