import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { pageGroups } from "@/components/admin/PageGroupStrip";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/** The owner's sample, part 7घ ख (2026-10-14): three small rows, nothing merged. */
describe("pages about one thing, one tap apart", () => {
  it("has the three rows of the sample", () => {
    expect(pageGroups.security.links.map((link) => link.href)).toEqual([
      "/admin/security-overview",
      "/admin/security",
      "/admin/devices",
      "/admin/change-password",
    ]);
    expect(pageGroups.measure.links.map((link) => link.href)).toEqual([
      "/admin/insights",
      "/admin/analytics",
      "/admin/reports/channels",
      "/admin/measurement",
    ]);
    expect(pageGroups.health.links.map((link) => link.href)).toEqual([
      "/admin/alerts",
      "/admin/activity",
      "/admin/notifications",
      "/admin/sms",
      "/admin/monitoring",
      "/admin/robots",
    ]);
  });

  it("sits on top of every page in a row, except the password page", async () => {
    for (const [group, { links }] of Object.entries(pageGroups)) {
      for (const { href } of links) {
        if (href === "/admin/change-password") continue;
        const layout = await read(`app${href}/layout.tsx`);
        expect(layout).toContain(`<PageGroupStrip group="${group}" current="${href}" />`);
      }
    }
  });

  it("keeps each page's own permission and shows only the pages one may open", async () => {
    expect(await read("app/admin/security/layout.tsx")).toContain('permission="security:read"');
    expect(await read("app/admin/devices/layout.tsx")).toContain('permission="devices:read"');
    expect(await read("app/admin/insights/layout.tsx")).toContain('permission="insights:read"');
    expect(await read("app/admin/activity/layout.tsx")).toContain('permission="activity:read"');
    expect(await read("app/admin/notifications/layout.tsx")).toContain('permission="notifications:read"');
    const strip = await read("components/admin/PageGroupStrip.tsx");
    expect(strip).toContain("canAccessAdminPath(role, link.href)");
    expect(strip).toContain("Boolean(session.staffId)");
    expect(strip).toContain("print:hidden");
  });
});
