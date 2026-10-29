import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  adminNavGroups,
  adminOffMenuLinks,
  navGroupForHref,
  navLinkForPath,
  workspaceForPath,
} from "@/app/admin/nav-links";
import { pageGroups } from "@/components/admin/PageGroupStrip";

/**
 * Owner, 2026-10-20, the side-menu sample, ख: "Workers' photos" in the menu
 * and "Photos" on the factory row were one page. Pages with a second door
 * leave the menu — Workers' photos (factory row, bell) and Search (the box at
 * the top) — and the three opened least, reached only from the menu, move to
 * a row on the pages they belong with: Cheques and Discount codes beside
 * Payments, Wholesale beside Customers.
 */
const side = (workspace: string) =>
  adminNavGroups
    .filter((group) => group.workspace === workspace || group.workspace === "both")
    .flatMap((group) => group.links.map((link) => link.label));

describe("the side menu, as sample ख draws it", () => {
  it("Factory: nine names", () => {
    expect(side("factory")).toEqual([
      "Factory today", "Wages & kharcha", "Operations", "Stock",
      "Costing", "Purchasing",
      "Dashboard", "Report", "Settings",
    ]);
  });

  // Transactions joined Money last, not first (owner, 2026-10-28).
  it("Shop: twelve names", () => {
    expect(side("shop")).toEqual([
      "Orders", "Cut a bill", "Item / Goods", "Stock", // renamed by the owner 2026-10-29
      "Customers", "Customer Voice",
      "Payments", "Credit / Dues", "Transactions",
      "Dashboard", "Report", "Settings",
    ]);
  });
});

describe("the pages that left the menu are not lost", () => {
  it("keep their side, their name and their colour", () => {
    expect(adminOffMenuLinks.map((link) => link.href)).toEqual([
      "/admin/factory/photos", "/admin/wholesale", "/admin/cheques", "/admin/coupons", "/admin/search",
      // The five names of the simple menu (owner, 2026-10-29).
      "/admin/hub/home", "/admin/hub/sales", "/admin/hub/money", "/admin/hub/factory", "/admin/hub/all",
    ]);
    expect(workspaceForPath("/admin/factory/photos")).toBe("factory");
    expect(workspaceForPath("/admin/cheques")).toBe("shop");
    expect(workspaceForPath("/admin/coupons")).toBe("shop");
    expect(workspaceForPath("/admin/wholesale")).toBe("shop");
    expect(workspaceForPath("/admin/search")).toBe("both");
    expect(navLinkForPath("/admin/cheques")?.label).toBe("Cheques");
    expect(navLinkForPath("/admin/factory/photos")?.label).toBe("Workers' photos");
    expect(navGroupForHref("/admin/coupons")?.id).toBe("shop-money");
    expect(navGroupForHref("/admin/wholesale")?.id).toBe("shop-customers");
  });

  it("a ☆ on one of them still reads its own name", async () => {
    const shortcuts = await readFile("app/admin/admin-shortcuts.ts", "utf8");
    expect(shortcuts).toContain("[...adminNavLinks, ...adminOffMenuLinks, ...adminSetupLinks]");
    expect(await readFile("app/admin/AdminNav.tsx", "utf8")).toContain("const group = navGroupForHref(href);");
  });
});

describe("the rows they moved to", () => {
  it("Money and Customers rows, in the sample's order", () => {
    expect(pageGroups.money.links.map((link) => link.en)).toEqual(["Payments", "Credit / Dues", "Cheques", "Discount codes", "Transactions"]);
    expect(pageGroups.customers.links.map((link) => link.en)).toEqual(["Customers", "Customer Voice", "Wholesale"]);
  });

  it("sits on top of each of the seven pages", async () => {
    const pages: Array<[string, string]> = [
      ["payments", "money"], ["dues", "money"], ["cheques", "money"], ["coupons", "money"],
      ["customers", "customers"], ["inbox", "customers"], ["wholesale", "customers"],
    ];
    for (const [page, group] of pages) {
      const layout = await readFile(`app/admin/${page}/layout.tsx`, "utf8");
      expect(layout, page).toContain(`<PageGroupStrip group="${group}" current="/admin/${page}" />`);
    }
    // The three that had a permission layout keep it.
    expect(await readFile("app/admin/payments/layout.tsx", "utf8")).toContain('permission="payments:read"');
    expect(await readFile("app/admin/dues/layout.tsx", "utf8")).toContain('permission="dues:read"');
    expect(await readFile("app/admin/customers/layout.tsx", "utf8")).toContain('permission="customers:read"');
  });

  it("the factory row names the photos page as the bell does", async () => {
    const nav = await readFile("app/admin/factory/_components/factory-nav.tsx", "utf8");
    expect(nav).toContain('label: "कामदारको फोटो", english: "Workers\' photos"');
  });
});
