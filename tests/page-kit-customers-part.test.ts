import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");
const nepaliWords = (source: string) => (source.match(/[ऀ-ॿ]+/g) ?? []).length;

/**
 * The owner's sample, part 4 (2026-10-12): customers and money. Customers and
 * Payments were nearly all English.
 */
describe("Customers", () => {
  it("is in both languages, a short card a customer on a phone, and tabs", async () => {
    const page = await read("app/admin/customers/page.tsx");
    expect(nepaliWords(page)).toBeGreaterThan(60);
    expect(page).toContain('className="grid list-none gap-2 pl-0 md:hidden"');
    for (const key of ["all", "orders", "owing", "verify"]) expect(page).toContain(`key: "${key}"`);
  });
});

describe("Customer Voice", () => {
  it("asks before it deletes, and counts what waits for a reply first", async () => {
    const page = await read("app/admin/inbox/page.tsx");
    expect(page).toContain("<ConfirmDeleteButton");
    expect(page).toContain('<T en="to reply" ne="जवाफ बाँकी" />');
    // Once — the owner's screenshot (2026-10-12) showed it first and last.
    expect(page.split('<T en="to reply" ne="जवाफ बाँकी" />').length - 1).toBe(1);
    const button = await read("components/admin/ConfirmDeleteButton.tsx");
    expect(button).toContain("window.confirm(ask ? text(ask.en, ask.ne) : message)");
  });
});

describe("Wholesale", () => {
  it("sorts the enquiries by status, and says the status in both languages", async () => {
    const page = await read("app/admin/wholesale/page.tsx");
    expect(page).toContain('id="wholesale"');
    expect(page).toContain('Contacted: { en: "Called", ne: "फोन गरियो" },');
  });
});

describe("Payments", () => {
  it("is in both languages, rupees behind the eye, three tabs", async () => {
    const page = await read("app/admin/payments/page.tsx");
    expect(nepaliWords(page)).toBeGreaterThan(60);
    expect(page).toContain('{ en: "paid in", ne: "आएको", value: summary.paidTransactionAmount, money: true },');
    for (const key of ["review", "all", "channel"]) expect(page).toContain(`key: "${key}"`);
    expect(page).not.toContain(">Recent transaction trail<");
  });
});
