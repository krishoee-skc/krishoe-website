import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");
const nepaliWords = (source: string) => (source.match(/[ऀ-ॿ]+/g) ?? []).length;

/**
 * The owner's sample, part 2 (2026-10-12): the factory's four screens in the
 * shared frame — the day's job first, a strip of figures, tabs — and the two
 * that were English only now in both languages.
 */
describe("Factory today", () => {
  it("puts Add work first, above the figures, and the lists behind tabs", async () => {
    const board = await read("app/admin/factory/FactoryBoard.tsx");
    expect(board.indexOf('href="/admin/factory/add-work"')).toBeLessThan(board.indexOf("<StatStrip"));
    expect(board).toContain('id="factory-today"');
    for (const key of ["workers", "products", "owed"]) expect(board).toContain(`key: "${key}"`);
    expect(board).toContain('{ en: "wage earned today", ne: "आज कमाएको ज्याला", value: stats.totalAmount, money: true },');
  });
});

describe("Workers' photos", () => {
  it("keeps the page's explanation one press away", async () => {
    const page = await read("app/admin/factory/photos/page.tsx");
    expect(page).toContain("<PageHead");
    expect(page).toContain('<T en="What is this page?" ne="यो पाना के हो?" />');
  });
});

describe("Wages & kharcha", () => {
  it("is in both languages, Saturday's figure first and the books check in one line", async () => {
    const page = await read("app/admin/operations/production-accounts/page.tsx");
    expect(nepaliWords(page)).toBeGreaterThan(60);
    expect(page).not.toContain(">Production chain audit<");
    expect(page).toContain('{ en: "due on Saturday", ne: "शनिबार तिर्ने", value: weekPayable, money: true },');
    expect(page).toContain("<details");
  });
});

describe("Operations", () => {
  it("is four tabs, the forms first, each daily form a line that opens", async () => {
    const page = await read("app/admin/operations/page.tsx");
    for (const key of ["enter", "flow", "profit", "records"]) expect(page).toContain(`key: "${key}"`);
    const entry = await read("app/admin/operations/_components/OperationsQuickEntry.tsx");
    expect(entry).toContain('<T en="What are you entering?" ne="के टिप्दै हुनुहुन्छ?" />');
    expect(entry.match(/<summary className="flex min-h-12/g)?.length).toBe(3);
  });

  it("labels its records and flow figures in both languages", async () => {
    const records = await read("app/admin/operations/_components/OperationsRecords.tsx");
    const overview = await read("app/admin/operations/_components/OperationsOverview.tsx");
    expect(records).not.toMatch(/data-label="[^"]+"(?! data-label-ne)/);
    expect(records).not.toMatch(/<th[^>]*>[A-Za-z][^<{]*<\/th>/);
    expect(overview).not.toMatch(/<ReportLine label="/);
  });
});
