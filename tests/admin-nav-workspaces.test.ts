import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  adminNavGroups,
  adminNavLinks,
  workspaceForPath,
} from "@/app/admin/nav-links";

/**
 * Twenty-eight destinations in one flat list meant scanning the whole shop to
 * find "Factory Entry", fifty times a day. They are now split by the two halves
 * of the business — but splitting a menu is only safe if nothing falls out of
 * it, so this counts the destinations rather than trusting the eye.
 */
describe("admin navigation", () => {
  it("keeps every destination that existed before the split", async () => {
    const before = [
      "/admin/getting-started", "/admin", "/admin/factory", "/admin/search",
      "/admin/stock", "/admin/pos", "/admin/dues", "/admin/purchasing",
      "/admin/costing", "/admin/hr", "/admin/operations", "/admin/orders",
      "/admin/customers", "/admin/payments", "/admin/notifications",
      "/admin/alerts", "/admin/sms", "/admin/reviews", "/admin/feedback",
      "/admin/insights", "/admin/analytics", "/admin/activity",
      "/admin/security", "/admin/monitoring", "/admin/devices",
      "/admin/settings", "/admin/products", "/admin/messages",
    ];

    const now = adminNavLinks.map((link) => link.href);
    for (const href of before) {
      expect(now, href).toContain(href);
    }
    expect(now).toHaveLength(before.length);
  });

  it("lists each destination once, though Stock is drawn on both sides", () => {
    const hrefs = adminNavLinks.map((link) => link.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);

    const drawn = adminNavGroups.flatMap((group) =>
      group.links.map((link) => `${group.workspace}:${link.href}`),
    );
    expect(drawn).toContain("factory:/admin/stock");
    expect(drawn).toContain("shop:/admin/stock");
  });

  it("gives every group a workspace and at least one link", () => {
    for (const group of adminNavGroups) {
      expect(["factory", "shop", "both"], group.id).toContain(group.workspace);
      expect(group.links.length, group.id).toBeGreaterThan(0);
    }
  });
});

describe("workspaceForPath", () => {
  it("opens the side the page belongs to", () => {
    expect(workspaceForPath("/admin/factory")).toBe("factory");
    expect(workspaceForPath("/admin/operations")).toBe("factory");
    expect(workspaceForPath("/admin/orders")).toBe("shop");
    expect(workspaceForPath("/admin/pos")).toBe("shop");
  });

  it("follows a nested page to its section", () => {
    // /admin/pos/INV-1 is still POS, and must not fall back to the Dashboard's
    // "both" and strand the reader on whichever side was last open.
    expect(workspaceForPath("/admin/pos/INV-1")).toBe("shop");
    expect(workspaceForPath("/admin/factory/reports")).toBe("factory");
    expect(workspaceForPath("/admin/operations/ledger/LED-1")).toBe("factory");
  });

  it("leaves the side alone for a page that belongs to both", () => {
    expect(workspaceForPath("/admin/stock")).toBe("both");
    expect(workspaceForPath("/admin/settings")).toBe("both");
    expect(workspaceForPath("/admin")).toBe("both");
    expect(workspaceForPath("/admin/unknown-page")).toBe("both");
  });
});

/**
 * The three menus — sidebar, phone sheet, drawer — used to each map the flat
 * list themselves. They now share one hook, so a group added in one place
 * cannot appear in two menus out of three.
 */
describe("the three menus", () => {
  it("all draw from the same hook", async () => {
    for (const file of [
      "app/admin/AdminNav.tsx",
      "app/admin/AdminMobileNav.tsx",
      "app/admin/components/AdminDrawer.tsx",
    ]) {
      const source = await readFile(file, "utf8");
      expect(source, file).toContain("useAdminWorkspace(adminRole, pathname)");
      expect(source, file).toContain("WorkspaceSwitch");
    }
  });
});

/**
 * A link in the menu that leads nowhere is worse than no link: it reads as a
 * broken app. Every destination must have a page behind it.
 */
describe("every destination exists", () => {
  it("has a page on disk", async () => {
    for (const link of adminNavLinks) {
      const segments = link.href.replace(/^\/admin\/?/, "");
      const dir = segments ? path.join("app/admin", segments) : "app/admin";
      const entries = await readdir(dir).catch(() => [] as string[]);
      const grouped = await readdir("app/(admin-auth)/admin").catch(() => [] as string[]);

      const hasPage =
        entries.some((entry) => entry.startsWith("page."))
        || grouped.includes(segments);

      expect(hasPage, `${link.href} (${link.label}) has no page`).toBe(true);
    }
  });
});
