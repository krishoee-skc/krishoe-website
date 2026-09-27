import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { cleanQuery, findByCode, matchesSearch, type SellableItem } from "@/app/admin/pos/_components/pos-bill-rules";

/**
 * Four things the owner asked for on the counter bill, 2026-09-27:
 * the whole screen for the bill, a stock mark that does not read as a fault,
 * a search box that says what it takes, and a wholesale buyer's PAN in view.
 */

describe("the bill has the whole screen", () => {
  it("marks every part of the admin frame, and hides it while the counter strip is up", async () => {
    const css = await readFile("app/globals.css", "utf8");
    expect(css).toContain("body:has([data-counter-mode]) [data-admin-chrome]");
    expect(css).toContain("body:has([data-counter-mode]) [data-admin-shell]");

    for (const file of [
      "app/admin/AdminNav.tsx",
      "app/admin/AdminMobileNav.tsx",
      "app/admin/layout.tsx",
      "app/admin/WorkspaceBand.tsx",
      "app/admin/AdminTrail.tsx",
      "app/admin/AdminQuickDock.tsx",
    ]) {
      expect(await readFile(file, "utf8"), file).toContain("data-admin-chrome");
    }
    expect(await readFile("components/admin/SidebarProvider.tsx", "utf8")).toContain("data-admin-shell");
  });

  it("puts the strip on the bill view only, with a way back and the reports", async () => {
    const page = await readFile("app/admin/pos/page.tsx", "utf8");
    expect(page).toContain("{showReports ? null : <CounterBar />}");
    const bar = await readFile("app/admin/pos/_components/CounterBar.tsx", "utf8");
    expect(bar).toContain("data-counter-mode");
    expect(bar).toContain('href="/admin"');
    expect(bar).toContain('reportsHref = "/admin/pos?view=reports"');
    expect(bar).toContain("requestFullscreen");
  });

  it("drops the phone's bill bar to the foot once the dock is gone", async () => {
    const form = await readFile("app/admin/pos/_components/PosBillForm.tsx", "utf8");
    expect(form).toContain("<div data-pos-bar ");
    const css = await readFile("app/globals.css", "utf8");
    expect(css).toContain("body:has([data-counter-mode]) [data-pos-bar]");
  });
});

describe("the stock mark on a bill", () => {
  it("says the stock moved, instead of 'Stock 10/2'", async () => {
    const page = await readFile("app/admin/pos/page.tsx", "utf8");
    expect(page).not.toContain("`Stock ${posting?.linkedStockMovementCount");
    expect(page).not.toContain("Stock {row.linkedStockMovementCount}/");
    expect(page).toContain("✓ स्टक");
    expect(page).toContain("⚠ स्टक मिलेन — मिलाउनुहोस्");
  });
});

const item = (design: string, sku: string): SellableItem =>
  ({ design, sku, sizes: [], stockBySize: {}, retailRate: 0, wholesaleRate: 0 }) as unknown as SellableItem;

describe("the search box", () => {
  it("drops a leading # from a typed code", () => {
    expect(cleanQuery("  #571E0E15 ")).toBe("571E0E15");
    expect(cleanQuery("bantu")).toBe("bantu");
  });

  it("finds a shoe by #code, whole or in part", () => {
    const catalog = [item("bantu hill", "571E0E15"), item("lose hill panja", "0BDCB4B2")];
    expect(findByCode(catalog, "#571E0E15")?.item.design).toBe("bantu hill");
    expect(matchesSearch(catalog[0], "#571E", [])).toBe(true);
    expect(matchesSearch(catalog[1], "#571E", [])).toBe(false);
  });

  it("shows what a name, a code and a size look like, under the box", async () => {
    const picker = await readFile("app/admin/pos/_components/PosProductPicker.tsx", "utf8");
    expect(picker).not.toContain("Shoe, code or size (41)");
    expect(picker).toContain('{text("Code", "कोड")} → #{example.code}');
  });
});

describe("a wholesale buyer's PAN", () => {
  it("is out in the open on a wholesale bill, and under More on the rest", async () => {
    const form = await readFile("app/admin/pos/_components/PosBillForm.tsx", "utf8");
    expect(form).toContain('{channel === "Wholesale" ? panBox : null}');
    expect(form).toContain('{channel === "Wholesale" ? null : panBox}');
    // One box, one name: never two customerPan fields on the form at once.
    expect(form.match(/name="customerPan"/g)).toHaveLength(1);
  });
});
