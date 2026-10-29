import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  adminRoles,
  canAccessAdminPath,
  getAdminPagePermission,
  type AdminRole,
} from "@/lib/admin-role-permissions";

/**
 * Who may open which admin page — every role against every page (owner,
 * 2026-10-26, security phase 2).
 *
 * The proxy refuses a page only when lib/admin-role-permissions.ts names a
 * permission for it; a page it does not name is open to every signed-in staff
 * role. So a new admin page with no rule is quietly open to all, and this test
 * is where that is caught. The grid below is today's access, written out: a
 * change to it has to be a decision, made here on purpose.
 */

function pageFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? pageFiles(path.join(dir, entry.name))
      : entry.name === "page.tsx"
        ? [path.join(dir, entry.name)]
        : [],
  );
}

const adminPaths = [...pageFiles("app/admin"), ...pageFiles("app/(admin-auth)")]
  .map((file) =>
    file
      .split(path.sep)
      .join("/")
      .replace(/^app/, "")
      .replace("/(admin-auth)", "")
      .replace(/\/page\.tsx$/, "")
      .replace(/\/\[[^\]]+\]/g, "/x"),
  )
  .map((route) => route || "/admin")
  .sort();

/** Open to anyone signed in, rightly: the doors in, and the pages a refusal lands on. */
const OPEN_ON_PURPOSE = [
  "/admin/login",
  "/admin/login/link",
  "/admin/forgot-password",
  "/admin/reset-password",
  "/admin/accept-invite",
  "/admin/change-password",
  "/admin/forbidden",
];

/**
 * Open to every staff role today with no rule and no check of their own. All
 * three only show things; whether a Sales or an Accountant login should see
 * them is the owner's to decide (told 2026-10-26). Until then they stay as
 * they are, listed, so nothing else can join them unnoticed.
 */
// The owner decided the last three on 2026-10-29 (the staff-role sample).
const OPEN_AWAITING_THE_OWNER: string[] = [];

/** No proxy rule, but the page checks for itself before it shows anything. */
const CHECKED_BY_THE_PAGE: Record<string, string> = { "/admin/inbox": "feedback:read" };

/** The roles that sign in to the admin. A Worker is sent to the worker app. */
const staffRoles = adminRoles.filter((role) => role !== "Worker");

/** As proxy.ts applies it: the page rule, and the Factory role kept to /admin/factory. */
function opens(role: AdminRole, page: string) {
  if (role === "Factory" && page !== "/admin/factory" && !page.startsWith("/admin/factory/")) return false;
  return canAccessAdminPath(role, page);
}

describe("every admin page has a rule", () => {
  it("or is open on purpose, or is waiting for the owner's word", () => {
    const unruled = adminPaths.filter((page) => page !== "/admin" && !getAdminPagePermission(page));
    expect(unruled.sort()).toEqual(
      [...OPEN_ON_PURPOSE, ...OPEN_AWAITING_THE_OWNER, ...Object.keys(CHECKED_BY_THE_PAGE)].sort(),
    );
  });

  it("where the page checks for itself, the check is really there", () => {
    for (const [page, permission] of Object.entries(CHECKED_BY_THE_PAGE)) {
      const source = readFileSync(`app${page}/page.tsx`, "utf8");
      expect(source, page).toContain(`requireAdminPermission("${permission}")`);
    }
  });

  it("finds the pages it is checking", () => {
    expect(adminPaths.length).toBeGreaterThan(50);
    expect(adminPaths).toContain("/admin/factory/salary");
    expect(adminPaths).toContain("/admin/settings");
  });
});

describe("what each role opens today", () => {
  // O Owner · M Manager · A Accountant · H HR · I Inventory · S Sales · F Factory · V Viewer
  const letter: Record<string, AdminRole> = { O: "Owner", M: "Manager", A: "Accountant", H: "HR", I: "Inventory", S: "Sales", F: "Factory", V: "Viewer" };
  const grid: Record<string, string> = {
    "/admin": "OMAHISV",
    "/admin/factory": "OMHF",
    // Monthly salaries: for those who pay wages, not the factory supervisor.
    "/admin/factory/salary": "OMH",
    "/admin/factory/ledger": "OMHF",
    "/admin/pos": "OMASV",
    "/admin/orders": "OMASV",
    "/admin/products": "OMISV",
    "/admin/stock": "OMAISV",
    "/admin/customers": "OMASV",
    "/admin/dues": "OMASV",
    "/admin/payments": "OMASV",
    "/admin/purchasing": "OMAIV",
    "/admin/costing": "OMAIV",
    "/admin/operations": "OMIV",
    "/admin/reports": "OMSV",
    // The Owner's and the Manager's (owner, 2026-10-29). Devices stays for all:
    // it lists only the person's own sign-ins and passkeys.
    "/admin/activity": "OM",
    "/admin/security": "OM",
    "/admin/monitoring": "OM",
    "/admin/devices": "OMAHISV",
    "/admin/settings": "O",
    "/admin/coupons": "O",
    "/admin/security-overview": "OM",
    "/admin/robots": "O",
    "/admin/getting-started": "OM",
  };

  for (const [page, allowed] of Object.entries(grid)) {
    it(page, () => {
      const expected = [...allowed].map((code) => letter[code]).sort();
      const actual = staffRoles.filter((role) => opens(role, page)).sort();
      expect(actual).toEqual(expected);
    });
  }

  it("lets the Owner open every admin page", () => {
    for (const page of adminPaths) expect(opens("Owner", page), page).toBe(true);
  });
});

describe("the two roles the proxy holds back", () => {
  const proxy = readFileSync("proxy.ts", "utf8");

  it("sends a Worker to the worker app from every admin page but changing the password", () => {
    expect(proxy).toContain('getSessionAdminRole(adminSession) === "Worker" &&\n    !pathname.startsWith("/admin/change-password")'.replace(/\n/g, proxy.includes("\r\n") ? "\r\n" : "\n"));
    expect(proxy).toContain('return NextResponse.redirect(new URL("/worker/dashboard", request.url));');
  });

  it("keeps the Factory role inside /admin/factory", () => {
    expect(proxy).toContain('getSessionAdminRole(adminSession) === "Factory" &&\n    !pathname.startsWith("/admin/factory")'.replace(/\n/g, proxy.includes("\r\n") ? "\r\n" : "\n"));
  });
});
