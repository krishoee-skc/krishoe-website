import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { adminNavLinks } from "@/app/admin/nav-links";
import { canAccessAdminPath } from "@/lib/admin-role-permissions";

/**
 * The owner's question when the QR was proposed: if this opens the app, what
 * stops whoever else scans it?
 *
 * The answer has to hold in the code, not just in the explanation. A QR is a
 * signboard — everyone in the room can photograph it — so it carries an address
 * and nothing else. Scanning lands on a sign-in page that was already public on
 * the internet; the password, and the emailed code for staff, are what guard
 * the door, and neither is ever encoded.
 */
describe("the QR endpoint", () => {
  it("encodes only a sign-in path, never a credential", async () => {
    const route = await readFile("app/api/admin/open-on-phone/route.ts", "utf8");

    expect(route).toContain("absoluteUrl(path)");
    for (const secret of ["token", "password", "staffId", "workerId", "code"]) {
      expect(route.toLowerCase(), secret).not.toContain(`${secret}:`);
    }
  });

  it("only builds QRs for paths on a fixed list", async () => {
    const route = await readFile("app/api/admin/open-on-phone/route.ts", "utf8");

    // Taking the path straight from the query string would turn a KRISHOE
    // endpoint into a QR generator for any address a crafted link asked for.
    expect(route).toContain("const ALLOWED");
    expect(route).toContain("ALLOWED[key] ?? ALLOWED.admin");
    expect(route).not.toMatch(/text:\s*absoluteUrl\(\s*request\./);
  });

  it("is admin-only", async () => {
    const route = await readFile("app/api/admin/open-on-phone/route.ts", "utf8");
    expect(route).toContain("requireAdminPermission");
  });
});

describe("the page", () => {
  it("says what happens if someone else scans it", async () => {
    const page = await readFile("app/admin/open-on-phone/page.tsx", "utf8");
    expect(page).toContain("QR भनेको ठेगाना हो — साँचो होइन");
    expect(page).toContain("QR सँगै password चाहिँ कहिल्यै नलेख्नुहोस्");
  });

  it("hides itself from a role that cannot open it", () => {
    // Unlisted admin paths fall through to "allowed", which would have put this
    // in a Worker's menu and then refused them at the door.
    expect(canAccessAdminPath("Worker", "/admin/open-on-phone")).toBe(false);
    expect(canAccessAdminPath("Owner", "/admin/open-on-phone")).toBe(true);
  });

  it("is in the menu", () => {
    const link = adminNavLinks.find((item) => item.href === "/admin/open-on-phone");
    expect(link?.nepali).toBe("फोनमा खोल्ने");
  });
});

describe("the worker poster", () => {
  it("asks for the mobile number workers actually sign in with", async () => {
    const poster = await readFile("app/admin/hr/worker-portal-qr/page.tsx", "utf8");

    expect(poster).toContain("मोबाइल नम्बर");
    // Workers have no inbox; the portal moved off email months before this
    // sheet was last written.
    expect(poster).not.toContain("आफ्नो इमेल र पासवर्ड");
    expect(poster).toContain("पहिलो पटक पस्दा नयाँ पासवर्ड राख्नुहोस्");
  });

  it("is reachable by the people who run the factory", async () => {
    const poster = await readFile("app/admin/hr/worker-portal-qr/page.tsx", "utf8");
    const route = await readFile("app/api/admin/hr/worker-portal-qr/route.ts", "utf8");

    // It sat behind hr:write, a permission for a module holding no attendance
    // or payroll, while the people who need to print it work in the factory.
    expect(poster).toContain('requireAdminPermission("production:entry")');
    expect(route).toContain('requireAdminPermission("production:entry")');
  });
});
