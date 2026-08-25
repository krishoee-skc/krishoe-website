import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildInsight } from "@/lib/reports";
import { campaignSources, campaignUrl } from "@/lib/campaign-links";

/**
 * Eleven ways to look at the shop, six of them hard to find.
 *
 * Four analysis screens were in no menu at all, and two more — monitoring and
 * the activity log — lived only inside Settings. That was right for the screens
 * Settings was built to hide, which are opened once on the first afternoon and
 * never again; it was wrong for a report meant to be read every week. A report
 * nobody can find is a report nobody reads.
 */
const NAV = "app/admin/nav-links.ts";
const HUB = "app/admin/reports/page.tsx";

describe("finding the reports", () => {
  it("puts one door in the menu everybody sees", async () => {
    const nav = await readFile(NAV, "utf8");
    const everywhere = nav.slice(nav.indexOf('id: "everywhere"'), nav.indexOf("adminSetupGroups"));

    expect(everywhere).toContain('href: "/admin/reports"');
    expect(everywhere).toContain('nepali: "हिसाब"');
  });

  it("still checks who is allowed to read one", async () => {
    const permissions = await readFile("lib/admin-role-permissions.ts", "utf8");

    // Seeing that a report exists is not the same as reading it; each screen
    // behind the hub keeps its own check.
    expect(permissions).toContain('["/admin/reports", "insights:read"]');
  });

  it("lists the six that were buried, not only the ones already in a menu", async () => {
    const reports = await readFile("lib/reports.ts", "utf8");

    for (const href of [
      "/admin/monitoring",
      "/admin/activity",
      "/admin/insights",
      "/admin/workers/analytics",
      "/admin/factory/reports",
      "/admin/costing",
    ]) {
      expect(reports, href).toContain(href);
    }
  });

  it("counts everything in one query rather than eleven", async () => {
    const reports = await readFile("lib/reports.ts", "utf8");

    // Eleven loads on a page whose whole job is to open quickly would be its
    // own kind of joke. Calls, not the import line above them.
    expect((reports.match(/await queryPostgres/g) ?? []).length).toBe(1);
  });
});

/**
 * An empty screen is the shop's first weeks, not a fault in the screen.
 *
 * "No data" tells the reader their app is broken. Saying what would fill it,
 * with the button that starts, turns the same empty box into the next thing to
 * do.
 */
describe("what an empty report says", () => {
  it("never says No data", async () => {
    // The comments explain what the screen refuses to say, so read the markup.
    const hub = (await readFile(HUB, "utf8"))
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    const reports = await readFile("lib/reports.ts", "utf8");

    for (const phrase of ["No data", "no data", "डाटा छैन", "खाली छ।"]) {
      expect(hub, phrase).not.toContain(phrase);
    }
    // Every card that can be empty carries the instruction and the button.
    expect(reports).toContain("emptyNe");
    expect(reports).toContain("actionHref");
  });

  it("tells a shop with no purchases why its profit is a guess", () => {
    const insight = buildInsight({
      pos_invoices: 4,
      ledger_balance: 0,
      performance: 0,
      audit: 0,
      stock_moves: 0,
      factory_work: 0,
      reviews: 0,
      purchases: 0,
      orders: 0,
      out_of_stock: 0,
      workers: 8,
    });

    expect(insight?.href).toBe("/admin/purchasing");
    expect(insight?.titleNe).toContain("नाफा");
  });

  it("puts sold-out shoes ahead of everything else, because advertising is next", () => {
    const insight = buildInsight({
      pos_invoices: 4,
      ledger_balance: 0,
      performance: 0,
      audit: 0,
      stock_moves: 0,
      factory_work: 0,
      reviews: 0,
      purchases: 0,
      orders: 0,
      out_of_stock: 4,
      workers: 8,
    });

    // Bringing shoppers to shoes they cannot buy is worse than not bringing
    // them, so this outranks the profit note above.
    expect(insight?.href).toBe("/admin/operations");
    expect(insight?.titleNe).toContain("4");
  });

  it("says nothing at all when there is nothing to say", () => {
    const insight = buildInsight({
      pos_invoices: 4,
      ledger_balance: 0,
      performance: 0,
      audit: 0,
      stock_moves: 0,
      factory_work: 0,
      reviews: 0,
      purchases: 3,
      orders: 0,
      out_of_stock: 0,
      workers: 8,
    });

    // An advice box that is always there stops being read.
    expect(insight).toBeNull();
  });
});

/**
 * Which advert worked, not merely that an advert worked.
 *
 * Google files Facebook, Instagram and TikTok as one channel called Organic
 * Social. For a shop deciding where to spend its next hour, "twenty-one from
 * social" is almost useless.
 */
describe("telling Facebook from Instagram", () => {
  it("tags the link with the place it will be posted", () => {
    expect(campaignUrl("/shop", "facebook")).toContain("utm_source=facebook");
    expect(campaignUrl("/shop", "instagram")).toContain("utm_source=instagram");
  });

  it("sets a medium too, or Google can still file it as Unassigned", () => {
    expect(campaignUrl("/shop", "facebook")).toContain("utm_medium=social");
    // A printed flyer is not social traffic and should not be counted as it.
    expect(campaignUrl("/shop", "flyer")).toContain("utm_medium=offline");
  });

  it("keeps every source lowercase, so one campaign is not split in two", () => {
    for (const source of campaignSources) {
      expect(source.id, source.id).toBe(source.id.toLowerCase());
    }
  });

  it("builds an absolute link, because it is going into somebody else's app", () => {
    expect(campaignUrl("/shop", "facebook")).toMatch(/^https?:\/\//);
  });

  it("will not mint a QR for a path nobody chose", async () => {
    const route = await readFile("app/api/admin/campaign-qr/route.ts", "utf8");

    // The route takes query parameters and returns an image; an unvalidated
    // path would let any admin session make a QR pointing anywhere.
    expect(route).toContain("campaignPlaces.find");
    expect(route).toContain("campaignSources.find");
    expect(route).toContain("requireAdminPermission");
  });
});
