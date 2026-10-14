import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/** The owner's sample, part 8 (2026-10-14). */
describe("the worker's pay on a phone", () => {
  it("is a card a month on a phone, and the table on a computer and paper", async () => {
    const page = await read("app/worker/payslip/page.tsx");
    expect(page).toContain('className="mt-4 grid list-none gap-2 pl-0 md:hidden print:hidden"');
    expect(page).toContain('className="mt-4 hidden overflow-x-auto md:block print:block"');
    expect(page).toContain("{money(month.finalBalance)}");
  });
});

describe("the staff invitation", () => {
  it("is in both languages", async () => {
    const page = await read("app/(admin-auth)/admin/accept-invite/page.tsx");
    expect(page).toContain('<T en="Create your staff password" ne="आफ्नो password बनाउनुहोस्" />');
    expect(page).toContain('ne="यो निम्तो मिलेन, पुरानो भयो वा पहिल्यै प्रयोग भइसक्यो। पसलसँग नयाँ निम्तो माग्नुहोस्।"');
    expect(page).toContain("<AdminSetPasswordForm token={token} mode=\"invitation\" />");
  });
});
