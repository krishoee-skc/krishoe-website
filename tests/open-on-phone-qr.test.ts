import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { safeAdminNextPath } from "@/lib/safe-redirect";

/**
 * The QR codes on the "open on phone" screen.
 *
 * The owner asked for one per role — Viewer, Manager, Accountant and the rest.
 * There are not that many doors: Owner, Manager, Accountant and Viewer all sign
 * in at the same /admin/login, with the same password and the same emailed
 * code. Five QRs that merely looked different would be a lie, because someone
 * would scan "the Accountant one" expecting to arrive as the Accountant.
 *
 * So they differ only in where each person lands afterwards. These tests hold
 * that line: a QR carries a path and never a credential, and it never claims to
 * grant anything.
 */

describe("what a QR is allowed to carry", () => {
  it("encodes only paths on this site", async () => {
    const route = await readFile("app/api/admin/open-on-phone/route.ts", "utf8");
    const allowed = route.slice(route.indexOf("const ALLOWED"), route.indexOf("export async function"));

    for (const match of allowed.matchAll(/"([^"]+)":\s*"([^"]+)"/g)) {
      // A QR generator that accepts an arbitrary address is how a code on a
      // KRISHOE screen ends up pointing somewhere else entirely.
      expect(match[2], match[1]).toMatch(/^\//);
      expect(match[2], match[1]).not.toMatch(/^https?:/);
    }
  });

  it("carries no token, password or person", async () => {
    const route = await readFile("app/api/admin/open-on-phone/route.ts", "utf8");
    const allowed = route.slice(route.indexOf("const ALLOWED"), route.indexOf("export async function"));

    for (const word of ["token", "password", "secret", "staffId", "session"]) {
      expect(allowed.toLowerCase(), word).not.toContain(word.toLowerCase());
    }
  });

  it("sends every role through the one sign-in page", async () => {
    const route = await readFile("app/api/admin/open-on-phone/route.ts", "utf8");

    for (const role of ["owner", "manager", "accountant", "viewer", "factory"]) {
      const line = route.match(new RegExp(`${role}: "([^"]+)"`));
      expect(line?.[1], role).toContain("/admin/login");
    }
  });
});

describe("where each role lands", () => {
  it("points at a destination the login page will accept", () => {
    // safeAdminNextPath re-checks on arrival, so a destination that stopped
    // existing degrades to /admin rather than to a broken page — but a value
    // that is rejected outright would make the QR pointless.
    for (const path of [
      "/admin",
      "/admin/orders",
      "/admin/payments",
      "/admin/analytics",
      "/admin/factory",
    ]) {
      expect(safeAdminNextPath(path), path).toBe(path);
    }
  });

  it("could not be used to bounce someone off the site", () => {
    expect(safeAdminNextPath("https://evil.example/admin")).toBe("/admin");
    expect(safeAdminNextPath("//evil.example")).toBe("/admin");
    expect(safeAdminNextPath("/admin/login")).toBe("/admin");
  });
});

describe("what the screen tells the owner", () => {
  it("says a QR does not grant a role", async () => {
    const page = await readFile("app/admin/open-on-phone/page.tsx", "utf8");

    // The whole risk of per-role codes is someone believing the code is the
    // permission. The page has to say otherwise, in the same place.
    expect(page).toContain("QR ले अधिकार दिँदैन");
    expect(page).toContain("role");
  });
});
