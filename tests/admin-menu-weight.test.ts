import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  adminNavGroups,
  adminNavLinks,
  adminSetupGroups,
  adminSetupLinks,
} from "@/app/admin/nav-links";
import { ADMIN_SEARCH_PAGES } from "@/lib/admin-search";

function visible(workspace: "factory" | "shop") {
  return adminNavGroups
    .filter((group) => group.workspace !== (workspace === "factory" ? "shop" : "factory"))
    .flatMap((group) => group.links);
}

/**
 * The owner opened the admin menu and said there were too many screens in it.
 * There were twenty-five on the shop side — and ten of those were things like
 * "Getting Started", "Measurement setup" and "Login devices": set up on the
 * first afternoon and never opened again, sitting beside Factory Entry and
 * Orders, which are opened fifty times a day.
 *
 * The count is what the complaint was about, so the count is what is pinned.
 */
describe("how much menu a shopkeeper has to read", () => {
  it("keeps the shop side to what the shop actually uses", () => {
    expect(visible("shop").length).toBeLessThanOrEqual(15);
  });

  it("keeps the factory side shorter still", () => {
    expect(visible("factory").length).toBeLessThanOrEqual(11);
  });

  it("has no group long enough to need scrolling past", () => {
    for (const group of adminNavGroups) {
      expect(group.links.length, group.titleEn).toBeLessThanOrEqual(5);
    }
  });
});

/**
 * Moving a screen out of the menu is only safe if it is still reachable.
 * Otherwise this is not tidying, it is losing things.
 */
describe("what happened to the ones that moved", () => {
  it("moved them rather than deleted them", () => {
    // Ten moved out of the menu; "Open on phone" was later deleted outright,
    // its worker QR already being at /admin/factory/worker-portal-qr. Then the
    // Security Center switch-board was added to the safety group, bringing it to
    // ten — pinned so a screen cannot quietly fall out of the list.
    expect(adminSetupLinks.length).toBe(10);

    const main = adminNavLinks.map((link) => link.href);
    for (const link of adminSetupLinks) {
      expect(main, link.href).not.toContain(link.href);
    }
  });

  it("lists every one of them on the Settings screen", async () => {
    const settings = await readFile("app/admin/settings/page.tsx", "utf8");

    // Rendered from the same list, so the two cannot drift apart.
    expect(settings).toContain("adminSetupGroups.map");
    expect(settings).toContain("सेटअप र प्रणाली");
    expect(adminSetupGroups.length).toBeGreaterThan(0);
  });

  it("lets Search find every one of them by name", () => {
    const searchable = new Set(ADMIN_SEARCH_PAGES.map((page) => page.href));

    // Eight of these were reachable only from the menu. Taking them out of it
    // without adding them here would have hidden them, not tidied them.
    for (const link of adminSetupLinks) {
      expect(searchable, link.href).toContain(link.href);
    }
  });

  it("lets Search find the customer inbox too", () => {
    const searchable = new Set(ADMIN_SEARCH_PAGES.map((page) => page.href));

    expect(searchable).toContain("/admin/inbox");
  });

  it("names each of them in Nepali as well as English", () => {
    for (const link of adminSetupLinks) {
      expect(link.label.length, link.href).toBeGreaterThan(0);
      expect(link.nepali.length, link.href).toBeGreaterThan(0);
    }
  });
});

/**
 * Photos is a screen for a job the owner notices on the Products screen — a
 * pair with no photograph — and Products already links to it.
 */
describe("the photos screen", () => {
  it("is reached from Products rather than from the menu", async () => {
    const products = await readFile("app/admin/products/page.tsx", "utf8");
    const hrefs = adminNavLinks.map((link) => link.href);

    expect(products).toContain('href="/admin/products/photos"');
    expect(hrefs).not.toContain("/admin/products/photos");
    expect(hrefs).toContain("/admin/products");
  });
});

describe("what stayed in the menu", () => {
  it("keeps the work that happens every day", () => {
    const hrefs = adminNavLinks.map((link) => link.href);

    for (const daily of [
      "/admin/factory",
      "/admin/orders",
      "/admin/pos",
      "/admin/products",
      "/admin/stock",
      "/admin/inbox",
    ]) {
      expect(hrefs, daily).toContain(daily);
    }
  });

  it("keeps the four things reached from anywhere", () => {
    const everywhere = adminNavGroups.find((group) => group.id === "everywhere");

    // The report hub sits here rather than analytics itself: eleven ways to
    // read the shop, one door, and money is read from both sides of the
    // business. Analytics is the first report inside it. Robot दरबार joins them:
    // the control room for the eight automated jobs, cross-cutting like the rest
    // of this group and so reached from either workspace.
    expect(everywhere?.links.map((link) => link.href)).toEqual([
      "/admin",
      "/admin/search",
      "/admin/robots",
      "/admin/reports",
      "/admin/settings",
    ]);
  });
});

/**
 * Tidying a menu is only tidying if nothing becomes unreachable. This is the
 * check that catches the difference, and it caught two: /admin/insights, which
 * was in neither the menu nor Search after the move, and /admin/products/photos.
 */
describe("nothing fell out of the app", () => {
  it("still reaches every screen that had a menu entry before", () => {
    const reachable = new Set([
      ...adminNavLinks.map((link) => link.href),
      ...adminSetupLinks.map((link) => link.href),
      ...ADMIN_SEARCH_PAGES.map((page) => page.href),
    ]);

    const before = [
      "/admin", "/admin/factory", "/admin/search", "/admin/stock", "/admin/pos",
      "/admin/dues", "/admin/purchasing", "/admin/costing",
      "/admin/operations", "/admin/orders", "/admin/customers", "/admin/payments",
      "/admin/notifications", "/admin/alerts", "/admin/sms", "/admin/analytics",
      "/admin/activity", "/admin/security", "/admin/monitoring", "/admin/devices",
      "/admin/settings", "/admin/products", "/admin/getting-started",
      "/admin/insights",
    ];

    for (const href of before) {
      expect(reachable, href).toContain(href);
    }
  });
});

/**
 * The screen at /admin/insights read product.reviews, which is where reviews
 * used to be kept — as JSON inside the products row, because the migration for
 * a table of their own sat unread in a folder nothing looks at. Reviews write
 * to customer_voice now, so it would have shown zero for ever while reviews
 * arrived somewhere else.
 */
describe("the design report", () => {
  it("reads reviews from where reviews now are", async () => {
    const page = await readFile("app/admin/insights/page.tsx", "utf8");

    expect(page).toContain("getReviewSummaryByProduct");
    expect(page).not.toContain("product.reviews.filter");
  });

  it("counts them in the database rather than one product at a time", async () => {
    const lib = await readFile("lib/customer-voice.ts", "utf8");

    // One query per pair on the shelf is fine at seven and not at seventy.
    expect(lib).toContain("GROUP BY product_id");
  });

  it("no longer shares its name with the inbox", async () => {
    const page = await readFile("app/admin/insights/page.tsx", "utf8");

    // Two screens called "ग्राहकको आवाज" is how the owner opens the wrong one.
    expect(page).not.toContain("Customer Voice | KRISHOE Admin");
    expect(page).toContain("कुन जुत्ता राम्रो");
  });
});
