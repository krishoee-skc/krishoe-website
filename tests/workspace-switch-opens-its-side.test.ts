import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { navLinkForPath, pathIsOnSide, workspaceDestination } from "@/app/admin/nav-links";

/**
 * The owner was on POS, pressed "Factory", and the menu turned to the factory
 * while the page stayed on the bill. The switch now opens its side.
 */
const anyone = () => true;

describe("pressing Factory or Shop", () => {
  it("opens the factory from a shop screen", () => {
    expect(workspaceDestination("factory", "/admin/pos", null, anyone)).toBe("/admin/factory");
  });

  it("opens the shop from a factory screen", () => {
    expect(workspaceDestination("shop", "/admin/factory", null, anyone)).toBe("/admin/orders");
  });

  it("opens a side from the Dashboard too", () => {
    expect(workspaceDestination("factory", "/admin", null, anyone)).toBe("/admin/factory");
  });

  it("returns to the screen last used on that side", () => {
    expect(workspaceDestination("shop", "/admin/factory", "/admin/pos", anyone)).toBe("/admin/pos");
    expect(workspaceDestination("factory", "/admin/pos", "/admin/purchasing", anyone)).toBe("/admin/purchasing");
  });

  it("stays put when already on that side", () => {
    expect(workspaceDestination("factory", "/admin/factory", null, anyone)).toBeNull();
    expect(workspaceDestination("shop", "/admin/pos/INV-1", null, anyone)).toBeNull();
    // Stock is drawn on both sides, so standing there you are on either.
    expect(workspaceDestination("factory", "/admin/stock", null, anyone)).toBeNull();
    expect(workspaceDestination("shop", "/admin/stock", null, anyone)).toBeNull();
  });

  it("ignores a remembered screen that is not on that side, or not in the admin", () => {
    expect(workspaceDestination("shop", "/admin/factory", "/admin/purchasing", anyone)).toBe("/admin/orders");
    expect(workspaceDestination("shop", "/admin/factory", "https://example.com/admin/pos", anyone)).toBe("/admin/orders");
    expect(workspaceDestination("shop", "/admin/factory", "//example.com", anyone)).toBe("/admin/orders");
  });

  it("opens only a screen this role may open", () => {
    const noOrders = (href: string) => href !== "/admin/orders";
    expect(workspaceDestination("shop", "/admin/factory", null, noOrders)).toBe("/admin/pos");
    expect(workspaceDestination("shop", "/admin/factory", "/admin/pos", (href) => href === "/admin/dues")).toBe("/admin/dues");
    expect(workspaceDestination("shop", "/admin/factory", null, () => false)).toBeNull();
  });
});

describe("the side a screen is on", () => {
  it("knows the Dashboard is on neither side's own list", () => {
    expect(pathIsOnSide("/admin", "factory")).toBe(false);
    expect(pathIsOnSide("/admin", "shop")).toBe(false);
    expect(pathIsOnSide("/admin/operations/production-accounts", "factory")).toBe(true);
  });

  it("names a nested screen by its section", () => {
    expect(navLinkForPath("/admin/pos/INV-1")?.href).toBe("/admin/pos");
    expect(navLinkForPath("/admin/operations/production-accounts")?.href).toBe("/admin/operations/production-accounts");
    expect(navLinkForPath("/admin/factory/workers")?.nepali).toBe("काम टिप्ने");
  });
});

describe("wiring", () => {
  it("every menu's switch goes through the hook that opens the side", async () => {
    const hook = await readFile("app/admin/useAdminWorkspace.ts", "utf8");
    expect(hook).toContain("workspaceDestination(");
    expect(hook).toContain("router.push(destination)");
    expect(hook).toContain("canAccessAdminPath(adminRole, href)");
  });

  it("draws the coloured band above every admin screen", async () => {
    const layout = await readFile("app/admin/layout.tsx", "utf8");
    expect(layout).toContain("<WorkspaceBand />");
  });

  it("defines the maroon the shop band and the change-password button are drawn in", async () => {
    const config = await readFile("tailwind.config.js", "utf8");
    expect(config).toMatch(/\bmaroon: "#[0-9A-Fa-f]{6}"/);
  });
});
