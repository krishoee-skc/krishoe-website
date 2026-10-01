import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * A short bill printed from a phone came out on two A4 pages, with the admin's
 * search row on top (owner, 2026-10-01).
 */
describe("a bill on paper", () => {
  it("leaves the admin frame off the paper", async () => {
    const css = (await readFile("app/globals.css", "utf8")).replace(/\r\n/g, "\n");
    expect(css).toMatch(/@media print \{[\s\S]*\[data-admin-chrome\] \{\n\s*display: none !important;/);
    for (const file of ["app/admin/layout.tsx", "app/admin/AdminTrail.tsx", "app/admin/WorkspaceBand.tsx"]) {
      expect(await readFile(file, "utf8"), file).toContain("data-admin-chrome");
    }
  });

  it("is laid out at paper width when printed from a phone, and only then", async () => {
    const css = (await readFile("app/globals.css", "utf8")).replace(/\r\n/g, "\n");
    const phone = css.slice(css.indexOf("@media print and (max-width: 440px) {"));
    expect(phone).toContain("width: 180mm !important;");
    expect(phone).toContain("overflow: visible !important;");
    expect(phone).toContain("grid-template-columns: repeat(2, minmax(0, 1fr)) !important;");
    const page = await readFile("app/admin/pos/[id]/page.tsx", "utf8");
    expect(page).toContain('className="receipt-fields grid');
  });
});
