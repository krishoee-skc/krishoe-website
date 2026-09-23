import { readFile } from "node:fs/promises";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A worker whose account "would not open".
 *
 * A new worker signs in with a temporary password and is made to change it.
 * The change-password screen then pointed them to /admin, where a Worker has no
 * permission — so they met "Forbidden" and took it for a broken account. The
 * same happened to a worker who signed in from /admin/login instead of
 * /worker/login.
 */

const session = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));

vi.mock("@/lib/admin-session", () => ({
  adminSessionCookieName: "krishoe-admin",
  verifyAdminSessionToken: async () => session.current,
}));
vi.mock("@/lib/customer-session", () => ({
  customerSessionCookieName: "krishoe-customer",
  verifyCustomerSessionToken: async () => null,
}));

async function visit(path: string) {
  const { proxy } = await import("@/proxy");
  const response = await proxy(new NextRequest(`https://www.krishoe.com${path}`));
  return response.headers.get("location");
}

beforeEach(() => {
  vi.resetModules();
  session.current = null;
});

describe("a signed-in worker", () => {
  it("is taken from the admin dashboard to the worker portal, not to Forbidden", async () => {
    session.current = { role: "Worker", staffId: "staff-1", mustChangePassword: false };
    expect(await visit("/admin")).toBe("https://www.krishoe.com/worker/dashboard");
    expect(await visit("/admin/orders")).toBe("https://www.krishoe.com/worker/dashboard");
  });

  it("can still reach the page that changes a temporary password", async () => {
    session.current = { role: "Worker", staffId: "staff-1", mustChangePassword: true };
    expect(await visit("/admin/change-password")).toBeNull();
    // …and is sent there from anywhere else until it is done.
    expect(await visit("/admin")).toBe("https://www.krishoe.com/admin/change-password");
  });

  it("opens the worker portal itself", async () => {
    session.current = { role: "Worker", staffId: "staff-1", mustChangePassword: false };
    expect(await visit("/worker/dashboard")).toBeNull();
  });
});

describe("everyone else", () => {
  it("keeps the owner on the admin dashboard", async () => {
    session.current = { role: "Owner", staffId: "owner-1", mustChangePassword: false };
    expect(await visit("/admin")).toBeNull();
  });
});

describe("after changing a temporary password", () => {
  it("points each role to its own home", async () => {
    const actions = await readFile("app/admin/access/actions.ts", "utf8");
    expect(actions).toContain('updated.role === "Worker" ? "/worker/dashboard"');
    expect(actions).toContain('href: home');
  });
});
