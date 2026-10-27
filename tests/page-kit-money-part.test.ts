import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * The owner's sample, part 5 (2026-10-12): dues, cheques, discount codes and
 * the dashboard.
 */
describe("Credit / Dues", () => {
  it("has two tabs, days instead of 'Aging', a call beside each number, rupees behind the eye", async () => {
    const page = await read("app/admin/dues/page.tsx");
    for (const key of ["collect", "pay"]) expect(page).toContain(`key: "${key}"`);
    expect(page).toContain('<T en={`${days} days`} ne={`${days} दिन भयो`} />');
    expect(page).toContain("href={`tel:${phone.replace(/[^\\d+]/g, \"\")}`}");
    expect(page).not.toContain(">Aging<");
    expect(page).toContain("money: true");
  });
});

describe("Cheques", () => {
  it("keeps its tabs and puts the rupees behind the eye", async () => {
    const page = await read("app/admin/cheques/page.tsx");
    expect(page).toContain("<StatStrip");
    expect(page).toContain('tabLink("dates"');
  });
});

describe("Discount codes", () => {
  it("shows the codes first and folds making one behind a button", async () => {
    const page = await read("app/admin/coupons/page.tsx");
    expect(page).toContain('<T en="New code" ne="नयाँ कोड" />');
    expect(page.indexOf("<details")).toBeLessThan(page.indexOf("<EnterWalkForm"));
  });
});

describe("Dashboard", () => {
  // The dashboard sample (owner, 2026-10-27): one page that scrolls, no tabs
  // on a phone; the Money box stays one line there until it is opened.
  it("is one page on a phone, the money folded, the goal's rupees behind the eye", async () => {
    const dash = await read("components/admin/OwnerDashboard.tsx");
    expect(dash).not.toContain("<PageTabs");
    expect(dash).toContain('openFigures.size > 0 ? "grid" : "hidden lg:grid"');
    expect(dash).toContain('openFigures.size > 0 ? rupees(target, "en") : "Rs. ••••"');
    const kit = await read("components/admin/PageKit.tsx");
    expect(kit).toContain('${openOnWide ? "lg:hidden" : ""}');
  });
});
