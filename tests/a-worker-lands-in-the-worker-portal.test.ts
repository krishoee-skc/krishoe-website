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

  it("is taken past the worker door to the dashboard when already signed in", async () => {
    session.current = { role: "Worker", staffId: "staff-1", mustChangePassword: false };
    expect(await visit("/worker/login")).toBe("https://www.krishoe.com/worker/dashboard");
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

  it("shows the owner the worker sign-in form, not someone else's dashboard", async () => {
    session.current = { role: "Owner", staffId: "owner-1", mustChangePassword: false };
    expect(await visit("/worker/login")).toBeNull();
    session.current = { role: "Owner", mustChangePassword: false }; // no staff record
    expect(await visit("/worker/login")).toBeNull();
  });
});

describe("after changing a temporary password", () => {
  it("points each role to its own home", async () => {
    const actions = await readFile("app/admin/access/actions.ts", "utf8");
    expect(actions).toContain('updated.role === "Worker" ? "/worker/dashboard"');
    expect(actions).toContain('href: home');
  });
});

describe("a mobile-only worker account", () => {
  it("is never taken for another account because both have no email", async () => {
    const { sameStaffEmail } = await vi.importActual<typeof import("@/lib/admin-settings")>("@/lib/admin-settings");
    // The bug: "" matched "", so each new phone-only worker was written over the last.
    expect(sameStaffEmail("", "")).toBe(false);
    expect(sameStaffEmail(null, undefined)).toBe(false);
    expect(sameStaffEmail("Owner@Shop.com ", "owner@shop.com")).toBe(true);
    expect(sameStaffEmail("a@shop.com", "b@shop.com")).toBe(false);
  });

  it("is looked up by email only when an email was given, on both backends", async () => {
    const settings = await readFile("lib/admin-settings.ts", "utf8");
    expect(settings.match(/sameStaffEmail\(member\.email, input\.email\)/g)).toHaveLength(2);
    expect(settings).not.toContain('normalizeEmail(member.email) === normalizeEmail(input.email ?? "")');
  });

  it("signs in with mobile and password — there is no email for a code to go to", async () => {
    const login = await readFile("app/admin/login/actions.ts", "utf8");
    expect(login).toContain('const codeHasNowhereToGo = staff.role === "Worker" && !staff.email?.trim();');
  });

  it("can only be a Worker; any other role is told it needs an email", async () => {
    const actions = await readFile("app/admin/settings/actions.ts", "utf8");
    expect(actions).toContain('if (role !== "Worker") {');
    expect(actions).toContain("needs an email for the sign-in security code");
  });
});

describe("changing a temporary password", () => {
  it("works for an account that signs in with a mobile number", async () => {
    const actions = await readFile("app/admin/access/actions.ts", "utf8");
    // It demanded session.email, which a mobile-only worker does not have.
    expect(actions).not.toContain("!session.email ||");
    expect(actions).toContain("const signInWith = account?.email?.trim() || account?.phone?.trim() || \"\";");
  });

  it("continues with a full page load, so the new session cookie is the one used", async () => {
    const forms = await readFile("components/admin/AdminAccessForms.tsx", "utf8");
    expect(forms).toContain('<a href={state.href} className="mt-3 inline-flex font-black underline">');
  });
});

describe("the worker door, opened by someone already signed in", () => {
  it("sends only a Worker on to the dashboard, so the owner is not bounced in a loop", async () => {
    const page = await readFile("app/worker/login/page.tsx", "utf8");
    // The loop: any session → dashboard → not a worker → login → dashboard…
    expect(page).not.toContain('if (await getAdminSession()) redirect("/worker/dashboard");');
    expect(page).toContain('getSessionAdminRole(session) === "Worker") redirect("/worker/dashboard")');
  });

  it("tells the owner who they are signed in as, and how to test a worker", async () => {
    const page = await readFile("app/worker/login/page.tsx", "utf8");
    expect(page).toContain("private window");
  });
});

describe("the change-password screen on a phone", () => {
  it("is not covered by the passkey offer, which sat over its button", async () => {
    const invite = await readFile("components/admin/PasskeyInvite.tsx", "utf8");
    expect(invite).toContain('pathname?.startsWith("/admin/change-password")');
    expect(invite).toContain('if (stage === "hidden" || changingPassword) return null;');
  });
});

describe("making a worker's sign-in", () => {
  it("moves Role to Worker when a factory worker is linked, so it is not left on Viewer", async () => {
    const form = await readFile("components/admin/StaffAccessManager.tsx", "utf8");
    expect(form).toContain('role.value === "Viewer"');
    expect(form).toContain('role.value = "Worker";');
  });

  it("forgives earlier wrong guesses once the password is right, before any emailed code", async () => {
    const login = await readFile("app/admin/login/actions.ts", "utf8");
    const cleared = login.indexOf("await clearAccountLoginRateLimit(email);");
    const codeStep = login.indexOf("const codeHasNowhereToGo");
    expect(cleared).toBeGreaterThan(0);
    expect(cleared).toBeLessThan(codeStep);
  });
});

describe("guessing a worker's password", () => {
  it("counts against the account however the mobile number or email is typed", async () => {
    const { loginAccountKey } = await vi.importActual<typeof import("@/lib/login-rate-limit")>("@/lib/login-rate-limit");
    expect(loginAccountKey("9801234567")).toBe(loginAccountKey("+977 980-123-4567"));
    expect(loginAccountKey("Ram@Shop.com ")).toBe(loginAccountKey("ram@shop.com"));
    expect(loginAccountKey("   ")).toBe("");
  });

  it("is stopped per account, not only per network address", async () => {
    const login = await readFile("app/admin/login/actions.ts", "utf8");
    expect(login).toContain("await checkAccountLoginRateLimit(email)");
    expect(login).toContain("await recordFailedAccountLogin(email)");
  });
});
