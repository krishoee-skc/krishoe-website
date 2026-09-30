import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * The admin on a phone (owner, 2026-10-01): 12px and 10-11px text, 32-36px
 * buttons, the menu behind ☰ at the top, wide tables, the to-dos below the
 * money. Looks only — no bill, stock or ledger rule is touched here.
 */
describe("the admin on a phone", () => {
  it("reads the smallest text at 14px and grows short buttons to 44px, on a phone only", async () => {
    const css = await read("app/globals.css");
    const block = css.slice(css.indexOf("/* The admin on a phone (owner, 2026-10-01)"));
    expect(block).toContain("@media screen and (max-width: 767px)");
    expect(block).toContain(".admin-canvas .text-xs {\n    font-size: 0.875rem;");
    expect(block).toContain(".admin-canvas .text-\\[10px\\],");
    expect(block).toContain(".admin-canvas :is(button, a, summary).h-9 {\n    height: 2.75rem;");
  });

  it("opens the whole menu from the thumb bar", async () => {
    const dock = await read("app/admin/AdminQuickDock.tsx");
    expect(dock).toContain('export const OPEN_ADMIN_MENU = "krishoe:open-admin-menu";');
    expect(dock).toContain("window.dispatchEvent(new Event(OPEN_ADMIN_MENU))");
    const menu = await read("app/admin/AdminMobileNav.tsx");
    expect(menu).toContain("window.addEventListener(OPEN_ADMIN_MENU, openMenu);");
  });

  it("turns the remaining wide tables into cards, labelled in the reader's language", async () => {
    for (const file of [
      "app/admin/ProductsClient.tsx",
      "app/admin/products/codes/CodesForm.tsx",
      "app/admin/operations/_components/ProfitPerPair.tsx",
      "components/admin/EveningJobs.tsx",
    ]) {
      const source = await read(file);
      expect(source, file).toContain('<table className="reflow-table ');
      expect(source, file).toContain("reflow-primary");
    }
    expect(await read("app/admin/operations/_components/ProfitPerPair.tsx")).toContain('data-label="Stock" data-label-ne="स्टक"');
    const css = await read("app/globals.css");
    expect(css).toContain('html[lang="ne"] .reflow-table td[data-label-ne]::before {\n  content: attr(data-label-ne);');
  });

  it("says wholesale or retail on the phone's bill bar, and puts the to-dos first", async () => {
    const form = await read("app/admin/pos/_components/PosBillForm.tsx");
    expect(form).toContain('text("Bill & save ▲", "बिल र राख्ने ▲")');
    const dashboard = await read("components/admin/OwnerDashboard.tsx");
    expect(dashboard).toContain('<div id="what-now" className="max-lg:-order-1 grid');
  });
});
